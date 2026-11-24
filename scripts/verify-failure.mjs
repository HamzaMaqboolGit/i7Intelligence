import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
try {
  process.loadEnvFile(".env.local");
} catch {}
const base = "http://127.0.0.1:3002";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3002",
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL:
        "mysql://unavailable:unavailable@127.0.0.1:3399/agency?connect_timeout=1",
      BETTER_AUTH_URL: base,
      NEXT_PUBLIC_SITE_URL: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk;
});
server.stderr.on("data", () => {});
try {
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (output.includes("Ready")) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > 20000) {
        clearInterval(timer);
        reject(new Error("Failure-test server did not start"));
      }
    }, 100);
  });
  const r = await fetch(base + "/api/contact", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "QA failure test",
      email: "qa-failure@example.test",
      service: "QA",
      message:
        "Synthetic test while the database is intentionally unavailable.",
    }),
  });
  assert.equal(r.status, 503);
  const result = await r.json();
  assert(!JSON.stringify(result).includes("unavailable@"));
  assert(!JSON.stringify(result).includes("Prisma"));
  writeFileSync(
    "docs/upgrade/FAILURE-RESULTS.json",
    JSON.stringify(
      {
        databaseUnavailable: { status: r.status, safeMessage: result.error },
        result: "passed",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS Database outage returns 503 with safe error text; live database was not stopped.",
  );
} finally {
  server.kill("SIGTERM");
}
