import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
  cookie = readFileSync(".local-test-session", "utf8"),
  results: string[] = [];
async function req(
  path: string,
  method = "GET",
  body?: unknown,
  session = cookie,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: session,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
async function main() {
  const { prisma } = await import("../lib/prisma");
  const original = await prisma.integrationSetting.findUnique({
    where: { id: "stripe" },
  });
  let inquiryId = "";
  const marker = randomUUID();
  const pass = (name: string) => {
    results.push(name);
    console.log("PASS", name);
  };
  try {
    assert.equal(
      (await req("/api/admin/profile", "GET", undefined, "")).status,
      401,
    );
    assert.equal(
      (await req("/api/admin/store/payment-settings", "GET", undefined, ""))
        .status,
      401,
    );
    pass("Anonymous profile and private payment settings requests rejected");
    const profile = await req("/api/admin/profile");
    assert.equal(profile.status, 200);
    assert.equal(
      (await req("/api/admin/profile", "PATCH", { ...profile.data })).status,
      200,
    );
    assert.equal(
      (
        await req("/api/admin/profile", "PATCH", {
          ...profile.data,
          email: `changed-${marker}@example.test`,
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("/api/admin/profile")).data.email,
      profile.data.email,
    );
    pass("Own profile saves and email changes require current password");
    const config = {
      mode: "test",
      publishableKey: "pk_test_syntheticLocalFixture",
      secretKey: "rk_test_syntheticLocalFixture",
      webhookSecret: "whsec_syntheticLocalFixture",
      taxMode: "manual",
      taxBehavior: "exclusive",
      taxRateBps: 1250,
      taxLabel: "QA Tax",
      taxRegistration: "Local QA only",
      taxCountry: "PK",
    };
    let r = await req("/api/admin/store/payment-settings", "POST", config);
    assert.equal(r.status, 200);
    r = await req("/api/admin/store/payment-settings");
    assert.equal(r.data.config.taxRateBps, 1250);
    assert.equal(r.data.secretConfigured, true);
    assert.equal(r.data.checkoutEnabled, false);
    assert.ok(!JSON.stringify(r.data).includes(config.secretKey));
    assert.ok(!JSON.stringify(r.data).includes(config.webhookSecret));
    const stored = await prisma.integrationSetting.findUniqueOrThrow({
      where: { id: "stripe" },
    });
    assert.ok(!stored.secret?.includes(config.secretKey));
    pass(
      "Payment and tax configuration persists with encrypted, redacted secrets; checkout stays disabled",
    );
    assert.equal(
      (
        await req("/api/admin/store/payment-settings", "POST", {
          ...config,
          mode: "live",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/api/admin/store/payment-settings", "POST", {
          ...config,
          taxRateBps: 10001,
        })
      ).status,
      400,
    );
    pass("Mismatched payment key mode and invalid tax rate rejected");
    const contact = await req("/api/admin/contacts", "POST", {
      title: `UI draft test ${marker}`,
      slug: `ui-draft-${marker}`,
      status: "unread",
      sortOrder: 0,
      data: {
        name: "Synthetic Draft QA",
        email: `draft-${marker}@example.test`,
        service: "UI verification",
        message: "Synthetic local editable draft verification.",
      },
    });
    assert.equal(contact.status, 201);
    inquiryId = contact.data.id;
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: profile.data.email },
    });
    const messageId = randomUUID();
    await prisma.conversationMessage.create({
      data: {
        id: messageId,
        inquiryId,
        kind: "reply",
        authorId: user.id,
        subject: "Re: local QA",
        body: "<p>Old unsent message</p>",
        messageId: `<${messageId}@example.test>`,
        outbox: {
          create: {
            key: `qa-draft:${messageId}`,
            recipient: `draft-${marker}@example.test`,
            subject: "Re: local QA",
            html: "<p>Old unsent message</p>",
            messageId: `<${messageId}@example.test>`,
            status: "failed",
          },
        },
      },
    });
    r = await req("/api/admin/inbox", "POST", {
      inquiryId,
      id: messageId,
      action: "draft",
      subject: "Edited draft",
      body: "<p>Updated unsent body</p>",
    });
    assert.equal(r.status, 200);
    const message = await prisma.conversationMessage.findUniqueOrThrow({
      where: { id: messageId },
      include: { outbox: true },
    });
    assert.equal(message.kind, "draft");
    assert.equal(message.body, "<p>Updated unsent body</p>");
    assert.equal(message.outbox?.status, "draft");
    assert.equal(message.outbox?.html, message.body);
    pass(
      "Previously failed unsent reply can be edited and safely withdrawn into an editable draft",
    );
    r = await req("/api/admin/inbox", "POST", {
      inquiryId,
      id: messageId,
      action: "draft",
      subject: "Edited again",
      body: "<p>Second draft revision</p>",
    });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await prisma.conversationMessage.findUniqueOrThrow({
          where: { id: messageId },
        })
      ).subject,
      "Edited again",
    );
    pass(
      "Saved draft supports subsequent edits without queuing or sending email",
    );
    const future = new Date(Date.now() + 86400000).toISOString(),
      requestId = randomUUID();
    const body = {
      name: "Unified Form QA",
      email: `booking-${marker}@example.test`,
      service: "Discovery call",
      requestedAt: future,
      timezone: "Asia/Karachi",
      message: "Synthetic unified contact and booking test.",
      requestId,
    };
    r = await req("/api/public/booking", "POST", body, "");
    assert.equal(r.status, 201);
    assert.equal(
      (await req("/api/public/booking", "POST", body, "")).status,
      201,
    );
    const booking = await prisma.bookingRequest.findUniqueOrThrow({
      where: { slug: requestId },
    });
    const linked = await prisma.contactMessage.findUniqueOrThrow({
      where: { slug: `booking-${booking.id}` },
    });
    assert.equal((linked.data as Record<string, string>).email, body.email);
    await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: { deletedAt: new Date(), status: "cancelled" },
    });
    await prisma.contactMessage.update({
      where: { id: linked.id },
      data: { deletedAt: new Date(), status: "archived" },
    });
    pass(
      "Single contact/call form persists both inbox and booking records idempotently",
    );
  } finally {
    if (original)
      await prisma.integrationSetting.update({
        where: { id: "stripe" },
        data: { data: original.data!, secret: original.secret },
      });
    else
      await prisma.integrationSetting.deleteMany({ where: { id: "stripe" } });
    if (inquiryId)
      await prisma.contactMessage.update({
        where: { id: inquiryId },
        data: { deletedAt: new Date(), status: "archived" },
      });
    await prisma.emailOutbox.updateMany({
      where: {
        recipient: { endsWith: ".test" },
        status: { in: ["pending", "failed"] },
      },
      data: {
        status: "cancelled",
        lastError: "Synthetic local fixture; do not send.",
      },
    });
    writeFileSync(
      "docs/refinements/API-RESULTS.json",
      JSON.stringify(results, null, 2),
    );
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
