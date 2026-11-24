/* eslint-disable @typescript-eslint/no-explicit-any -- Runtime assertions validate local HTTP fixtures. */
import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
process.loadEnvFile(".env.local");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const cookie = readFileSync(".local-test-session", "utf8");
const results: { name: string; result: string }[] = [];
function pass(name: string) {
  results.push({ name, result: "passed" });
  console.log("PASS", name);
}
async function req(
  path: string,
  method = "GET",
  body?: unknown,
  session = cookie,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Cookie: session,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function main() {
  const { prisma } = await import("../lib/prisma");
  const { sendOutbox, encryptSecret, safeEmailHtml } =
    await import("../lib/email");
  const original = await prisma.emailSetting.findUnique({
    where: { id: "smtp" },
  });
  const marker = randomUUID();
  let accepted = 0,
    reject = false;
  const payloads: string[] = [];
  const server = createServer((socket) => {
    socket.write("220 mock SMTP ready\r\n");
    let buffer = "",
      dataMode = false,
      body = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (dataMode) {
          if (line === ".") {
            dataMode = false;
            if (reject) socket.write("550 Message rejected for test\r\n");
            else {
              accepted++;
              payloads.push(body);
              socket.write("250 Accepted by mock\r\n");
            }
            body = "";
          } else body += line + "\n";
          continue;
        }
        if (/^EHLO|^HELO/.test(line)) socket.write("250 mock.local\r\n");
        else if (/^MAIL|^RCPT|^RSET|^NOOP/.test(line))
          socket.write("250 OK\r\n");
        else if (line === "DATA") {
          dataMode = true;
          socket.write("354 End with dot\r\n");
        } else if (line === "QUIT") {
          socket.write("221 Bye\r\n");
          socket.end();
        } else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock failed");
  try {
    assert.equal(
      (await req("/api/admin/email", "GET", undefined, "")).status,
      401,
    );
    assert.equal(
      (await req("/api/admin/inbox?id=x", "GET", undefined, "")).status,
      401,
    );
    pass("Anonymous email and conversation API access rejected");
    const input = {
      name: "Completion QA",
      email: `qa-${marker}@example.test`,
      phone: "",
      subject: `QA inquiry ${marker}`,
      service: "Website design",
      message:
        "Synthetic local workflow verification. This is not a real customer inquiry.",
      consent: true,
    };
    assert.equal(
      (await req("/api/contact", "POST", { ...input, consent: false }, ""))
        .status,
      400,
    );
    pass("Contact consent enforced server-side");
    const submission = await req("/api/contact", "POST", input, "");
    assert.equal(submission.status, 201);
    assert.match(submission.data.reference, /^INQ-/);
    const inquiry = await prisma.contactMessage.findFirstOrThrow({
      where: { title: input.subject },
    });
    pass("Contact submission saved with unique inquiry reference");
    const ack = await prisma.emailOutbox.findUniqueOrThrow({
      where: { key: `ack:${inquiry.id}` },
    });
    assert.equal(ack.status, "pending");
    assert.equal(ack.recipient, input.email);
    pass("Acknowledgment stored in durable outbox transaction");
    assert.ok(
      await prisma.notification.findFirst({
        where: { type: "contact", description: { contains: "Completion QA" } },
      }),
    );
    pass("Contact administrator notification persisted");
    const draft = {
      inquiryId: inquiry.id,
      id: randomUUID(),
      action: "draft",
      subject: `Re: ${input.subject}`,
      body: "<p>Hello from the local QA test.</p><script>alert(1)</script>",
    };
    assert.equal((await req("/api/admin/inbox", "POST", draft)).status, 200);
    assert.equal(
      (
        await req("/api/admin/inbox", "POST", {
          ...draft,
          action: "note",
          id: randomUUID(),
        })
      ).status,
      200,
    );
    const history = await req(`/api/admin/inbox?id=${inquiry.id}`);
    assert.equal(history.data.inquiry.conversation.length, 2);
    assert.ok(!history.data.inquiry.conversation[0].body.includes("script"));
    pass("Rich reply draft and private internal note persist; HTML sanitized");
    const config = {
      host: "127.0.0.1",
      port: address.port,
      encryption: "none",
      username: "",
      senderName: "QA Mock",
      senderEmail: "studio@example.test",
      replyTo: "reply@example.test",
      adminEmail: "",
      provider: "Local test fixture",
      enabled: true,
    };
    await prisma.emailSetting.upsert({
      where: { id: "smtp" },
      create: {
        id: "smtp",
        data: config,
        secret: encryptSecret("synthetic-qa-password"),
      },
      update: { data: config, secret: encryptSecret("synthetic-qa-password") },
    });
    const settings = await req("/api/admin/email");
    assert.equal(settings.status, 200);
    assert.equal(settings.data.passwordConfigured, true);
    assert.ok(!JSON.stringify(settings.data).includes("synthetic-qa-password"));
    pass("SMTP secrets encrypted at rest and omitted from API response");
    const send = await req("/api/admin/inbox", "POST", {
      ...draft,
      action: "send",
    });
    assert.equal(send.status, 400);
    assert.match(send.data.error, /allowlist/i);
    const stored = await prisma.conversationMessage.findUniqueOrThrow({
      where: { id: draft.id },
      include: { outbox: true },
    });
    assert.equal(stored.outbox?.status, "pending");
    pass("Unsafe SMTP destination blocked while reply remains durably queued");
    process.env.SMTP_TEST_HOST = "127.0.0.1";
    assert.equal(
      process.env.NODE_ENV,
      "test",
      "Run with NODE_ENV=test to enable the isolated mock transport",
    );
    const outcome = await sendOutbox(stored.outbox!.id);
    assert.equal(outcome.status, "accepted");
    assert.equal(accepted, 1);
    assert.ok(payloads[0].includes("Message-ID:"));
    assert.equal(
      (
        await prisma.contactMessage.findUniqueOrThrow({
          where: { id: inquiry.id },
        })
      ).status,
      "replied",
    );
    pass("Mock SMTP accepted direct reply and conversation status updated");
    await Promise.all([
      sendOutbox(stored.outbox!.id),
      sendOutbox(stored.outbox!.id),
    ]);
    assert.equal(accepted, 1);
    pass("Repeated and concurrent retries do not duplicate an accepted email");
    reject = true;
    await assert.rejects(() => sendOutbox(ack.id), /rejected/);
    assert.equal(
      (await prisma.emailOutbox.findUniqueOrThrow({ where: { id: ack.id } }))
        .status,
      "failed",
    );
    pass("SMTP rejection persisted with actionable delivery log");
    reject = false;
    await sendOutbox(ack.id);
    assert.equal(accepted, 2);
    pass("Definitively failed email safely retried once");
    assert.equal(
      safeEmailHtml(
        '<img src="file:///etc/passwd"><a href="javascript:alert(1)">unsafe</a>',
      ).includes("javascript"),
      false,
    );
    pass("Email HTML blocks executable links and file references");
    const nav = await req("/api/admin/navigation", "POST", {
      title: `QA Menu ${marker}`,
      status: "published",
      sortOrder: 1,
      data: { url: "/contact", placement: "mobile", newTab: true, parent: "" },
    });
    assert.equal(nav.status, 201);
    const updated = await req("/api/admin/navigation", "PATCH", {
      ...nav.data,
      sortOrder: 4,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.sortOrder, 4);
    assert.equal(
      (await req("/api/admin/navigation", "DELETE", { id: nav.data.id }))
        .status,
      200,
    );
    pass("Mobile navigation create/edit/order/delete persist");
    const unsafe = await req("/api/admin/navigation", "POST", {
      title: `Unsafe ${marker}`,
      status: "published",
      sortOrder: 1,
      data: { url: "javascript:alert(1)", placement: "header" },
    });
    assert.equal(unsafe.status, 400);
    pass("Navigation rejects unsafe URL schemes");
    const logs = await req("/api/admin/logs?entity=contacts");
    assert.equal(logs.status, 200);
    assert.ok(logs.data.records.every((r: any) => r.entity === "contacts"));
    pass("Activity resource filter uses stored records");
    await prisma.contactMessage.update({
      where: { id: inquiry.id },
      data: { deletedAt: new Date(), status: "archived" },
    });
  } finally {
    if (original)
      await prisma.emailSetting.update({
        where: { id: "smtp" },
        data: { data: original.data!, secret: original.secret },
      });
    else await prisma.emailSetting.deleteMany({ where: { id: "smtp" } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    writeFileSync(
      "docs/completion/WORKFLOW-RESULTS.json",
      JSON.stringify(results, null, 2),
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
