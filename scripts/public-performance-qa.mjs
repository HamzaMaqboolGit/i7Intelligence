import { chromium, expect } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000",
  browser = await chromium.launch({ headless: true }),
  results = [];
const pass = (name, details) => {
  results.push({ name, result: "passed", details });
  console.log("PASS", name, details || "");
};
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.evaluate(() => (window.__publicMarker = "persistent-document"));
  let documents = 0;
  page.on("request", (r) => {
    if (r.resourceType() === "document" && r.isNavigationRequest()) documents++;
  });
  await page
    .locator(".header")
    .getByRole("link", { name: "Services", exact: true })
    .click();
  await expect(page).toHaveURL(base + "/services");
  assert.equal(
    await page.evaluate(() => window.__publicMarker),
    "persistent-document",
  );
  assert.equal(documents, 0);
  await page
    .locator(".header")
    .getByRole("link", { name: "Shop", exact: true })
    .click();
  await expect(page).toHaveURL(base + "/shop");
  assert.equal(
    await page.evaluate(() => window.__publicMarker),
    "persistent-document",
  );
  assert.equal(documents, 0);
  pass(
    "Services and shop navigation preserve the document without full-page reloads",
  );
  await page.goto(base + "/blog");
  const article = page.locator(".article-card").first();
  if (await article.count()) {
    await page.evaluate(() => (window.__articleMarker = "same-document"));
    documents = 0;
    await article.click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    assert.equal(
      await page.evaluate(() => window.__articleMarker),
      "same-document",
    );
    assert.equal(documents, 0);
    pass("Blog card uses client navigation without a document reload");
  }
  await fetch(base).then((r) => r.text());
  const times = [];
  for (let n = 0; n < 7; n++) {
    const start = performance.now(),
      r = await fetch(base);
    await r.text();
    assert.equal(r.status, 200);
    times.push(Math.round(performance.now() - start));
  }
  pass("Warm homepage measured", {
    milliseconds: times,
    medianMs: [...times].sort((a, b) => a - b)[3],
    scope:
      "Local machine only; Hostinger speed depends on hosting and database",
  });
  assert.deepEqual(errors, []);
  pass("No public browser runtime errors");
} finally {
  await browser.close();
  writeFileSync(
    "docs/refinements/PERFORMANCE-RESULTS.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        results,
        adminBrowserValidation:
          "Not run: automatic approval rejected creation of a temporary privileged account. No account changes made.",
      },
      null,
      2,
    ),
  );
}
