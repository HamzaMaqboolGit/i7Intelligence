import { PrismaClient } from "@prisma/client";
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
try {
  process.loadEnvFile(".env.production");
} catch {}
try {
  process.loadEnvFile(".env.local");
} catch {}
const failures = [];
for (const key of [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_SITE_URL",
  "BETTER_AUTH_SECRET",
])
  if (!process.env[key] || process.env[key].includes("REPLACE_"))
    failures.push(`${key} is missing or still a placeholder`);
for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_SITE_URL"]) {
  try {
    if (new URL(process.env[key]).protocol !== "https:")
      failures.push(`${key} must be HTTPS in production`);
  } catch {
    failures.push(`${key} must be a valid URL`);
  }
}
if ((process.env.BETTER_AUTH_SECRET || "").length < 32)
  failures.push("BETTER_AUTH_SECRET must contain at least 32 characters");
const db = new PrismaClient();
try {
  await db.$queryRaw`SELECT 1`;
  console.log("PASS: database connection");
  const users = await db.user.count();
  console.log(
    users
      ? "PASS: imported administrator accounts exist"
      : "ACTION: run the first-admin bootstrap on this empty installation",
  );
  await db.siteSetting.count();
  console.log("PASS: CMS schema is installed");
} catch {
  failures.push(
    "Database is unreachable or schema is missing; check DATABASE_URL and import/migrations",
  );
} finally {
  await db.$disconnect();
}
for (const location of [
  process.env.MEDIA_DIRECTORY || "./storage/media",
  process.env.STORE_FILE_DIRECTORY || "./storage/store-private",
])
  try {
    await mkdir(location, { recursive: true, mode: 0o700 });
    await access(location, constants.R_OK | constants.W_OK);
    console.log("PASS: private storage directory is writable");
  } catch {
    failures.push("A storage directory is not writable");
  }
console.log(
  "Payments: checkout remains disabled until the Stripe integration is completed.",
);
if (failures.length) {
  failures.forEach((v) => console.error("FAIL:", v));
  process.exitCode = 1;
} else console.log("Deployment configuration checks passed.");
