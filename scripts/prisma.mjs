import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
try {
  process.loadEnvFile(".env.local");
} catch {}
if (process.argv.includes("migrate") && process.env.DATABASE_ADMIN_URL)
  process.env.DATABASE_URL = process.env.DATABASE_ADMIN_URL;
if (
  process.argv.includes("migrate") &&
  process.env.ALLOW_LOCAL_MIGRATION === "1"
) {
  const { password } = JSON.parse(
    readFileSync("/private/tmp/royal-studio-mysql-admin.json", "utf8"),
  );
  process.env.DATABASE_URL = `mysql://root:${password}@127.0.0.1:3307/royal_studio`;
}
const child = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});
process.exit(child.status ?? 1);
