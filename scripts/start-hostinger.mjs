import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid port number.");

// Hostinger creates the MySQL database separately from the application. Apply
// committed Prisma migrations before starting Next.js so a fresh database is
// usable immediately. `migrate deploy` is idempotent and never resets data.
const migration = spawnSync(process.execPath, [path.resolve("scripts/prisma.mjs"), "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
if (migration.status !== 0)
  throw new Error("Database migrations failed; refusing to start the application.");
for (const location of [
  process.env.MEDIA_DIRECTORY || "./storage/media",
  process.env.STORE_FILE_DIRECTORY || "./storage/store-private",
]) {
  await mkdir(path.resolve(location), { recursive: true, mode: 0o700 });
}
const child = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    String(port),
  ],
  { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
