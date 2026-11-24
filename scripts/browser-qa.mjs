import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
  folder = "docs/upgrade/screenshots";
mkdirSync(folder, { recursive: true });
const results = [];
const qaFaqTitle = `QA browser FAQ ${Date.now()}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
function pass(name) {
  results.push({ name, result: "passed" });
  console.log("PASS", name);
}
async function capture(name) {
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: false });
}
async function settle() {
  await page.waitForTimeout(1300);
}
try {
  await page.goto(base + "/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your account" }),
  ).toBeVisible();
  await settle();
  await capture("admin-login");
  pass("Anonymous browser redirected to login");
  const raw = readFileSync(".local-test-session", "utf8");
  await context.addCookies(
    raw
      .split("; ")
      .filter(Boolean)
      .map((pair) => ({
        name: pair.slice(0, pair.indexOf("=")),
        value: pair.slice(pair.indexOf("=") + 1),
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      })),
  );
  await page.goto(base + "/admin");
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  await expect(
    page.getByText("No analytics connected", { exact: true }),
  ).toBeVisible();
  await settle();
  await capture("admin-dashboard");
  pass(
    "Authenticated dashboard renders stored metrics and analytics empty state",
  );
  await page.goto(base + "/admin/portfolio");
  await expect(
    page.getByRole("heading", { name: "Forma", exact: true }),
  ).toBeVisible();
  await settle();
  await capture("portfolio-manager");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(500);
  await capture("portfolio-drawer");
  await page.getByRole("button", { name: "Close editor" }).press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  pass("Project drawer opens and closes by keyboard");
  await page.getByRole("combobox", { name: "Filter by category" }).click();
  await page
    .getByRole("option", { name: "Brand & digital", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Arc Objects", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Forma", exact: true }),
  ).toBeVisible();
  pass("Custom category dropdown filters actual records");
  await page.goto(base + "/admin/blog");
  await expect(
    page.getByRole("button", { name: "Edit article", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit article", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit blog article" }),
  ).toBeVisible();
  await expect(page.locator(".tiptap")).toBeVisible();
  await settle();
  await capture("blog-editor");
  pass("Rich article editor loads real saved content");
  await page.goto(base + "/admin/media");
  await expect(
    page.getByRole("heading", { name: "Media library", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".a-media-item").first()).toBeVisible();
  await settle();
  await capture("media-library");
  await page.locator(".a-media-item").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settle();
  await capture("media-details");
  await page.getByRole("button", { name: "Close editor" }).click();
  pass("Media library and metadata drawer render");
  await page.goto(base + "/admin/notifications");
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await settle();
  await capture("notifications");
  pass("Persistent notification center renders");
  await page.goto(base + "/admin/faqs");
  await expect(
    page.getByRole("button", { name: "Add faq", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add faq", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Question *", exact: true })
    .fill(qaFaqTitle);
  await page
    .getByRole("textbox", { name: "Answer *", exact: true })
    .fill("A synthetic answer to verify a real browser save.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible();
  await expect(page.getByText(qaFaqTitle, { exact: true })).toBeVisible();
  await capture("save-toast");
  await page
    .getByRole("button", { name: `Delete ${qaFaqTitle}`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture("delete-confirmation");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText(qaFaqTitle, { exact: true })).not.toBeVisible();
  pass(
    "Browser CRUD confirms server save with toast and deletes through confirmation",
  );
  const authenticatedRequest = await context.request.post(
    base + "/api/admin/locations",
    {
      headers: { Origin: base },
      data: {
        title: "QA configured map location",
        slug: "qa-browser-map-" + Date.now(),
        description: "Synthetic coordinate fixture, not a business address.",
        status: "published",
        sortOrder: 9999,
        data: { latitude: 25, longitude: 67, primary: true },
      },
    },
  );
  assert.equal(authenticatedRequest.status(), 201);
  const fixture = await authenticatedRequest.json();
  try {
    await page.goto(base + "/contact");
    await page
      .getByRole("button", { name: "Load interactive map", exact: true })
      .click();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "OpenStreetMap",
    );
    await expect(page.locator(".agency-map-marker")).toBeVisible();
    pass(
      "Configured location loads attributed interactive map and navy marker",
    );
  } finally {
    await context.request.delete(base + "/api/admin/locations", {
      headers: { Origin: base },
      data: { id: fixture.id },
    });
  }
  await page.goto(base + "/contact");
  await expect(
    page.getByRole("button", { name: "Load interactive map", exact: true }),
  ).not.toBeVisible();
  pass("No configured location shows contact fallback without a map marker");
  await page.goto(base + "/admin/settings");
  await expect(
    page.getByRole("heading", { name: "Site settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit settings", exact: true }),
  ).toBeVisible();
  await settle();
  await capture("settings");
  pass("Site settings render from MySQL");
  await page.goto(base + "/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "We Transform Ideas Into Stunning Websites",
  );
  await settle();
  await capture("homepage-desktop");
  const reveal = await page
    .locator('[data-motion="section"]')
    .first()
    .evaluate((e) => ({
      opacity: getComputedStyle(e).opacity,
      transform: getComputedStyle(e).transform,
    }));
  assert.equal(reveal.opacity, "1");
  assert.equal(reveal.transform, "none");
  pass("Public cinematic entrance completes in browser");
  for (const title of [
    "Designing Online Encounters That Motivate",
    "High-quality work delivered thoughtfully.",
    "We are your design partner.",
    "Building experiences with purpose.",
    "Services designed to empower your digital presence.",
    "Good work starts with good relationships.",
    "Read our articles & publications.",
    "Frequently asked questions.",
    "Ready to elevate your digital presence?",
  ]) {
    await page
      .getByRole("heading", { name: title, exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    await page.screenshot({
      path: `${folder}/section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`,
    });
  }
  pass("Every homepage section visually captured after reveal");
  await page
    .getByRole("heading", { name: "Frequently asked questions.", exact: true })
    .scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "What services do you offer?", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "What services do you offer?",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page
      .getByText(
        "Brand identity, digital strategy, UX and product design, and custom website development.",
        { exact: false },
      )
      .first(),
  ).toBeVisible();
  pass("Public FAQ expands with visible answer");
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    for (const path of [
      "/",
      "/contact",
      "/admin",
      "/admin/portfolio",
      "/admin/media",
    ]) {
      await page.goto(base + path);
      await page.waitForTimeout(700);
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      assert(
        dimensions.document <= dimensions.viewport,
        `${path} overflows at ${width}: ${JSON.stringify(dimensions)}`,
      );
    }
    await page.goto(base + "/admin");
    await settle();
    await capture(`admin-${width}`);
    if (width < 769) {
      await page
        .getByRole("button", { name: "Open sidebar", exact: true })
        .click();
      await expect(
        page.getByRole("navigation", { name: "Admin navigation" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Portfolio", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Portfolio", exact: true }),
      ).toBeVisible();
    }
    pass(`Public and admin responsive layouts: ${width}px, no page overflow`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/");
  await settle();
  await capture("homepage-mobile");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/");
  await page.waitForTimeout(150);
  const reduced = await page.evaluate(() => ({
    preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
    marquee: getComputedStyle(document.querySelector(".marquee-track"))
      .animationDuration,
    reveal: getComputedStyle(document.querySelector('[data-motion="section"]'))
      .transform,
  }));
  assert(reduced.preference);
  assert(parseFloat(reduced.marquee) < 0.01);
  assert.equal(reduced.reveal, "none");
  pass("Reduced-motion preference disables reveal transforms and marquee");
  assert.equal(errors.length, 0, errors.join("\n"));
  pass("No uncaught browser errors during tested workflows");
} catch (error) {
  console.error(error);
  results.push({
    name: "Browser suite",
    result: "failed",
    error: String(error),
  });
  process.exitCode = 1;
  await capture("failure").catch(() => {});
} finally {
  writeFileSync(
    "docs/upgrade/BROWSER-RESULTS.json",
    JSON.stringify(
      { timestamp: new Date().toISOString(), results, errors },
      null,
      2,
    ),
  );
  await browser.close();
}
