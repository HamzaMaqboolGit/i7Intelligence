/* eslint-disable @typescript-eslint/no-explicit-any -- Test responses are verified with runtime assertions across different collection shapes. */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import sharp from "sharp";
import assert from "node:assert/strict";
import { modules } from "../lib/cms/registry";
try {
  process.loadEnvFile(".env.local");
} catch {}
const prisma = new PrismaClient(),
  base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const results: { name: string; result: string }[] = [];
const cookie = readFileSync(".local-test-session", "utf8");
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  session = cookie,
  origin = base,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(session ? { Cookie: session } : {}),
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data, headers: r.headers };
}
function pass(name: string) {
  results.push({ name, result: "passed" });
  console.log("PASS", name);
}
async function main() {
  assert.equal(
    (await request("/api/admin/portfolio", "GET", undefined, "")).status,
    401,
  );
  pass("Unauthorized CMS API rejected");
  assert.equal(
    (
      await request(
        "/api/admin/portfolio",
        "POST",
        {},
        cookie,
        "https://invalid.test",
      )
    ).status,
    403,
  );
  pass("Cross-origin mutations rejected");
  const marker = `qa-${Date.now()}`;
  const created: { module: string; record: any }[] = [];
  for (const module of [
    "pages",
    "sections",
    "portfolio",
    "services",
    "blog",
    "categories",
    "testimonials",
    "team",
    "careers",
    "faqs",
    "contacts",
    "bookings",
    "clients",
    "subscribers",
    "navigation",
    "locations",
  ]) {
    const config = modules[module];
    const data: Record<string, unknown> = {};
    for (const f of config.fields) {
      if (f.type === "list") data[f.key] = [];
      else if (f.type === "checkbox") data[f.key] = false;
      else if (f.type === "number")
        data[f.key] =
          f.key === "latitude"
            ? 25
            : f.key === "longitude"
              ? 67
              : f.key === "year"
                ? 2026
                : 5;
      else if (f.type === "email") data[f.key] = `${marker}@example.test`;
      else if (f.type === "date")
        data[f.key] = new Date(Date.now() + 86400000).toISOString();
      else if (f.type === "rich")
        data[f.key] = "<p>Synthetic QA content.</p><script>alert(1)</script>";
      else if (f.type === "image") data[f.key] = "/art/project-0.svg";
      else if (f.type === "url") data[f.key] = "/contact";
      else data[f.key] = `QA ${f.label}`;
    }
    if ("structuredData" in data)
      data.structuredData =
        '{"@context":"https://schema.org","@type":"WebPage"}';
    if (module === "navigation") data.placement = "header";
    if (module === "subscribers") data.consent = true;
    if (module === "sections") data.kind = "gallery";
    const raw = {
      title: `QA ${module} ${marker}`,
      slug: `${marker}-${module}`,
      description: "Synthetic test content; not a real business record.",
      status: config.statuses[0],
      sortOrder: 9999,
      data,
    };
    const made = await request(`/api/admin/${module}`, "POST", raw);
    assert.equal(
      made.status,
      201,
      `${module} create ${JSON.stringify(made.data)}`,
    );
    let record = made.data;
    created.push({ module, record });
    const list = await request(
      `/api/admin/${module}?q=${encodeURIComponent("QA " + module)}`,
    );
    assert(list.data.records.some((r: any) => r.id === record.id));
    const updated = await request(`/api/admin/${module}`, "PATCH", {
      ...record,
      title: `${record.title} updated`,
    });
    assert.equal(updated.status, 200, `${module} update`);
    record = updated.data;
    created[created.length - 1].record = record;
    if (data.body) assert(!String(record.data.body).includes("<script"));
    pass(`${module} create/read/update persisted`);
  }
  const project = created.find((r) => r.module === "portfolio")!;
  assert(
    !(
      await (await fetch(base + `/portfolio/${project.record.slug}`)).text()
    ).includes(project.record.title),
  );
  const published = await request("/api/admin/portfolio", "PATCH", {
    ...project.record,
    status: "published",
  });
  assert.equal(published.status, 200);
  const html = await (
    await fetch(base + `/portfolio/${project.record.slug}`)
  ).text();
  assert(html.includes(project.record.title));
  pass("Draft not publicly accessible; publish updates public route");
  const location = created.find((r) => r.module === "locations")!;
  const badLocation = await request("/api/admin/locations", "PATCH", {
    ...location.record,
    data: { ...location.record.data, latitude: 100 },
  });
  assert.equal(badLocation.status, 400);
  pass("Invalid map coordinates rejected");
  const booking = created.find((r) => r.module === "bookings")!;
  let changed = await request("/api/admin/bookings", "PATCH", {
    ...booking.record,
    status: "confirmed",
  });
  assert.equal(changed.status, 200);
  changed = await request("/api/admin/bookings", "PATCH", {
    ...changed.data,
    status: "completed",
  });
  assert.equal(changed.status, 200);
  assert.equal(
    (
      await request("/api/admin/bookings", "PATCH", {
        ...changed.data,
        status: "pending",
      })
    ).status,
    400,
  );
  pass("Booking state machine rejects terminal-state reversal");
  const testimonial = created.find((r) => r.module === "testimonials")!;
  assert.equal(
    (
      await request("/api/admin/testimonials", "PATCH", {
        ...testimonial.record,
        status: "published",
      })
    ).status,
    400,
  );
  pass("Unapproved testimonial publication rejected");
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#101D33" },
  })
    .png()
    .toBuffer();
  const upload = new FormData();
  upload.set("file", new File([png], "qa-image.png", { type: "image/png" }));
  const mediaResponse = await fetch(base + "/api/admin/media-upload", {
    method: "POST",
    headers: { Cookie: cookie, Origin: base },
    body: upload,
  });
  const media = await mediaResponse.json();
  assert.equal(mediaResponse.status, 201, JSON.stringify(media));
  assert.equal((await fetch(base + media.data.image)).status, 200);
  const spoof = new FormData();
  spoof.set(
    "file",
    new File(["<script>test</script>"], "bad.png", { type: "image/png" }),
  );
  const spoofResponse = await fetch(base + "/api/admin/media-upload", {
    method: "POST",
    headers: { Cookie: cookie, Origin: base },
    body: spoof,
  });
  assert.equal(spoofResponse.status, 400);
  pass("Image decoded, optimized and served; MIME spoof rejected");
  created.push({ module: "media", record: media });
  const contact = await request(
    "/api/contact",
    "POST",
    {
      name: "Synthetic QA contact",
      email: `${marker}@example.test`,
      service: "QA verification",
      subject: "Synthetic QA inquiry",
      consent: true,
      message:
        "Synthetic contact test for persistent notification verification.",
      website: "",
    },
    "",
  );
  assert.equal(contact.status, 201);
  const notices = await request("/api/admin/notifications");
  assert(
    notices.data.records.some((n: any) => n.notification.type === "contact"),
  );
  const notice = notices.data.records[0];
  assert.equal(
    (
      await request("/api/admin/notifications", "PATCH", {
        id: notice.notificationId,
      })
    ).status,
    200,
  );
  const readNotice = await prisma.notificationReceipt.findUnique({
    where: {
      notificationId_userId: {
        notificationId: notice.notificationId,
        userId: (
          await prisma.user.findUniqueOrThrow({
            where: {
              email: JSON.parse(readFileSync(".local-admin.json", "utf8"))
                .email,
            },
          })
        ).id,
      },
    },
  });
  assert(readNotice?.readAt);
  pass("Contact creates persistent notification; mark-read persists");
  const users: string[] = [];
  for (const roleName of ["Viewer", "Editor"]) {
    const role = await prisma.role.findUniqueOrThrow({
        where: { name: roleName },
      }),
      id = randomUUID(),
      email = `${marker}-${roleName.toLowerCase()}@example.test`,
      password = randomBytes(20).toString("hex");
    await prisma.user.create({
      data: {
        id,
        name: `QA ${roleName}`,
        email,
        emailVerified: true,
        roles: { create: { roleId: role.id } },
        accounts: {
          create: {
            id: randomUUID(),
            accountId: id,
            providerId: "credential",
            password: await hash(password, {
              algorithm: 2,
              memoryCost: 19456,
              timeCost: 2,
              parallelism: 1,
            }),
          },
        },
      },
    });
    users.push(id);
    const login = await request(
      "/api/auth/sign-in/email",
      "POST",
      { email, password },
      "",
    );
    assert.equal(login.status, 200);
    const roleCookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    assert.equal(
      (await request("/api/admin/portfolio", "GET", undefined, roleCookie))
        .status,
      200,
    );
    assert.equal(
      (await request("/api/admin/users", "GET", undefined, roleCookie)).status,
      403,
    );
    if (roleName === "Viewer")
      assert.equal(
        (await request("/api/admin/portfolio", "POST", {}, roleCookie)).status,
        403,
      );
    else
      assert.equal(
        (await request("/api/admin/contacts", "GET", undefined, roleCookie))
          .status,
        403,
      );
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal(
      (await request("/api/admin/portfolio", "GET", undefined, roleCookie))
        .status,
      401,
    );
    pass(`${roleName} role boundaries and expired session enforced`);
  }
  for (const { module, record } of created) {
    assert.equal(
      (await request(`/api/admin/${module}`, "DELETE", { id: record.id }))
        .status,
      200,
    );
    assert(
      !(
        await request(
          `/api/admin/${module}?q=${encodeURIComponent("QA " + module)}`,
        )
      ).data.records.some((r: any) => r.id === record.id),
    );
  }
  assert(
    !(
      await (await fetch(base + `/portfolio/${project.record.slug}`)).text()
    ).includes(project.record.title),
  );
  assert.equal((await fetch(base + media.data.image)).status, 404);
  pass("All tested deletes soft-delete persistently; public URLs disappear");
  await prisma.user.updateMany({
    where: { id: { in: users } },
    data: { disabled: true },
  });
  await prisma.session.deleteMany({ where: { userId: { in: users } } });
  const rows = await prisma.contactMessage.findMany({
    where: { data: { path: "$.email", string_contains: marker } },
  });
  for (const r of rows)
    await prisma.contactMessage.update({
      where: { id: r.id },
      data: { deletedAt: new Date(), status: "archived" },
    });
  const adminCreds = JSON.parse(readFileSync(".local-admin.json", "utf8"));
  const login = await request(
    "/api/auth/sign-in/email",
    "POST",
    { email: adminCreds.email, password: adminCreds.password },
    "",
  );
  assert.equal(login.status, 200);
  const logoutCookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.equal(
    (await request("/api/auth/sign-out", "POST", {}, logoutCookie)).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/portfolio", "GET", undefined, logoutCookie))
      .status,
    401,
  );
  pass("Logout revokes the database session");
  const signup = await request(
    "/api/auth/sign-up/email",
    "POST",
    {
      email: `${marker}-signup@example.test`,
      password: randomBytes(20).toString("hex"),
      name: "QA blocked",
    },
    "",
  );
  assert(signup.status >= 400);
  pass("Public registration disabled");
  writeFileSync(
    "docs/upgrade/INTEGRATION-RESULTS.json",
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
  );
}
main()
  .catch((error) => {
    console.error(error);
    writeFileSync(
      "docs/upgrade/INTEGRATION-RESULTS.json",
      JSON.stringify(
        { timestamp: new Date().toISOString(), results, error: String(error) },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
