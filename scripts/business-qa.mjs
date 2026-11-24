import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
  cookie = readFileSync(".local-test-session", "utf8"),
  stamp = Date.now(),
  email = `qa-business-${stamp}@example.test`,
  results = [];
async function post(path, data, authenticated = false) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(authenticated ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(data),
  });
  return { status: response.status, data: await response.json() };
}
const booking = await post("/api/public/booking", {
  name: "QA public booking",
  email,
  service: "Discovery call",
  requestedAt: new Date(Date.now() + 86400000).toISOString(),
  timezone: "Asia/Karachi",
  message: "Synthetic request, not a real booking.",
});
assert.equal(booking.status, 201);
results.push("Public booking request persists");
const invalid = await post("/api/public/booking", {
  name: "QA public booking",
  email,
  service: "Discovery call",
  requestedAt: new Date(Date.now() - 86400000).toISOString(),
  timezone: "Asia/Karachi",
  message: "Invalid past time.",
});
assert.equal(invalid.status, 400);
results.push("Past booking request rejected");
assert.equal(
  (await post("/api/public/newsletter", { email, consent: false })).status,
  400,
);
assert.equal(
  (await post("/api/public/newsletter", { email, consent: true })).status,
  201,
);
assert.equal(
  (await post("/api/public/newsletter", { email, consent: true })).status,
  201,
);
results.push("Newsletter requires consent and handles repeated subscriptions");
for (const module of ["bookings", "subscribers"]) {
  const response = await fetch(
    `${base}/api/admin/${module}?q=${module === "bookings" ? "QA public booking" : encodeURIComponent(email)}`,
    { headers: { Cookie: cookie } },
  );
  const list = await response.json();
  const rows = list.records.filter((r) => r.data.email === email);
  assert.equal(rows.length, 1);
  for (const row of rows) {
    const removed = await fetch(`${base}/api/admin/${module}`, {
      method: "DELETE",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ id: row.id }),
    });
    assert.equal(removed.status, 200);
  }
}
writeFileSync(
  "docs/upgrade/BUSINESS-RESULTS.json",
  JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
);
results.forEach((r) => console.log("PASS", r));
