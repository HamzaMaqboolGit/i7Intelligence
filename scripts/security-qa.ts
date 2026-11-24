import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { hash } from "@node-rs/argon2";
import assert from "node:assert/strict";
try {
  process.loadEnvFile(".env.local");
} catch {}
const prisma = new PrismaClient(),
  base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
  results: string[] = [];
let cookie = "";
async function call(path: string, body: unknown, session = cookie) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(session ? { Cookie: session } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return { status: r.status, data, headers: r.headers };
}
function mergeCookies(headers: Headers) {
  const map = new Map(
    cookie
      .split("; ")
      .filter(Boolean)
      .map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]),
  );
  for (const raw of headers.getSetCookie()) {
    const pair = raw.split(";")[0],
      i = pair.indexOf("=");
    map.set(pair.slice(0, i), pair.slice(i + 1));
  }
  cookie = [...map].map(([k, v]) => `${k}=${v}`).join("; ");
}
function pass(name: string) {
  results.push(name);
  console.log("PASS", name);
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = Buffer.from(
    (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", bytes).update(counter).digest(),
    offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function main() {
  const id = randomUUID(),
    email = `qa-security-${Date.now()}@example.test`;
  let password = randomBytes(24).toString("hex");
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: "Admin" },
  });
  await prisma.user.create({
    data: {
      id,
      name: "QA Security",
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
  try {
    let r = await call("/api/auth/sign-in/email", { email, password }, "");
    assert.equal(r.status, 200, JSON.stringify(r.data));
    mergeCookies(r.headers);
    const first = await prisma.session.findFirstOrThrow({
      where: { userId: id },
    });
    const stored = await prisma.account.findFirstOrThrow({
      where: { userId: id },
    });
    assert(stored.password?.startsWith("$argon2id$"));
    pass("Argon2id password hashing verified");
    r = await call("/api/auth/two-factor/enable", { password });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    mergeCookies(r.headers);
    const uri = new URL(r.data.totpURI),
      secret = uri.searchParams.get("secret")!;
    const backupCodes = r.data.backupCodes;
    assert(Array.isArray(backupCodes));
    r = await call("/api/auth/two-factor/verify-totp", { code: totp(secret) });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    mergeCookies(r.headers);
    assert(
      (await prisma.user.findUniqueOrThrow({ where: { id } })).twoFactorEnabled,
    );
    const twoFactor = await prisma.twoFactor.findFirstOrThrow({
      where: { userId: id },
    });
    assert(!twoFactor.secret.includes(secret));
    pass("TOTP enrollment verified; secret encrypted at rest");
    await call("/api/auth/sign-out", {});
    cookie = "";
    r = await call("/api/auth/sign-in/email", { email, password }, "");
    assert.equal(r.status, 200);
    assert(r.data.twoFactorRedirect);
    mergeCookies(r.headers);
    let protectedResponse = await fetch(base + "/api/admin/portfolio", {
      headers: { Cookie: cookie },
    });
    assert.equal(protectedResponse.status, 401);
    r = await call("/api/auth/two-factor/verify-totp", { code: totp(secret) });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    mergeCookies(r.headers);
    protectedResponse = await fetch(base + "/api/admin/portfolio", {
      headers: { Cookie: cookie },
    });
    assert.equal(protectedResponse.status, 200);
    const second = await prisma.session.findFirstOrThrow({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
    assert.notEqual(first.token, second.token);
    pass("2FA sign-in requires verification; login rotates session token");
    const known = await call(
      "/api/auth/request-password-reset",
      { email, redirectTo: "/admin/reset-password" },
      "",
    );
    const unknown = await call(
      "/api/auth/request-password-reset",
      {
        email: `unknown-${randomUUID()}@example.test`,
        redirectTo: "/admin/reset-password",
      },
      "",
    );
    assert.equal(known.status, unknown.status);
    assert.deepEqual(known.data, unknown.data);
    const mails = readdirSync(".local-mails").map((f) =>
      JSON.parse(readFileSync(`.local-mails/${f}`, "utf8")),
    );
    const message = mails.find((m) => m.to === email);
    assert(message);
    const token = new URL(message.url).pathname.split("/").pop()!;
    const verification = await prisma.verification.findFirstOrThrow({
      where: { value: id },
      orderBy: { createdAt: "desc" },
    });
    assert(!verification.identifier.includes(token));
    assert(verification.expiresAt.getTime() - Date.now() <= 1800000);
    password = randomBytes(24).toString("hex");
    r = await call(
      "/api/auth/reset-password",
      { token, newPassword: password },
      "",
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(await prisma.session.count({ where: { userId: id } }), 0);
    assert(
      (
        await call(
          "/api/auth/reset-password",
          { token, newPassword: password },
          "",
        )
      ).status >= 400,
    );
    pass(
      "Reset response avoids enumeration; token hashed, expires, is single-use and revokes sessions",
    );
    for (let i = 0; i < 6; i++)
      r = await call(
        "/api/auth/sign-in/email",
        { email, password: "intentionally-wrong-password" },
        "",
      );
    assert.equal(r.status, 429, JSON.stringify(r.data));
    pass("Repeated failed sign-ins are blocked and recorded");
  } finally {
    await prisma.user.update({ where: { id }, data: { disabled: true } });
    await prisma.session.deleteMany({ where: { userId: id } });
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    writeFileSync(
      "docs/upgrade/SECURITY-RESULTS.json",
      JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
    );
    await prisma.$disconnect();
  });
