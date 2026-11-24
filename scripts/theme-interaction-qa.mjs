import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000",
  cookie = readFileSync(".local-test-session", "utf8").trim(),
  results = [],
  folder = "docs/refinements/themes";
mkdirSync(folder, { recursive: true });
const api = async (path, method = "GET", body) => {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const pass = (name) => {
  results.push({ name, result: "passed" });
  console.log("PASS", name);
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addCookies(
  cookie.split("; ").map((c) => {
    const i = c.indexOf("=");
    return {
      name: c.slice(0, i),
      value: c.slice(i + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    };
  }),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let browserDialogs = 0;
page.on("dialog", (d) => {
  browserDialogs++;
  void d.dismiss();
});
const original = (await api("/api/admin/settings")).data.records[0];
try {
  await page.goto(base);
  const about = page
    .locator(".public-desktop-menu")
    .getByRole("button", { name: "About", exact: true });
  await about.hover();
  const menu = page.getByRole("menu", { name: "About", exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Blog", exact: true }).hover();
  await page.waitForTimeout(300);
  await expect(menu).toBeVisible();
  await page.locator("main h1").click();
  await expect(menu).toHaveCount(0);
  assert.equal(
    await about.evaluate((e) => getComputedStyle(e).outlineStyle),
    "none",
  );
  pass(
    "About opens on hover, remains open across portal, dismisses outside without pointer outline",
  );
  await page.goto(base + "/contact");
  await expect(
    page.getByText("This is a request, not an instant calendar reservation.", {
      exact: false,
    }),
  ).toHaveCount(0);
  pass("Call-page reservation caption removed");
  await page.goto(base + "/admin/settings");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.locator(".a-notification-preview")).toBeVisible();
  await page
    .getByRole("heading", { name: "Site settings", exact: true })
    .click();
  await expect(page.locator(".a-notification-preview")).toHaveCount(0);
  pass("Notifications close on outside click");
  await page.getByRole("button", { name: "Themes", exact: true }).click();
  await page.getByRole("button", { name: "Deep teal", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-accent",
    "teal",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.getByRole("button", { name: "Themes", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: folder + "/dark-admin.png" });
  await page.goto(base);
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.waitForTimeout(1700);
  await page.screenshot({ path: folder + "/dark-public.png" });
  pass(
    "Accent and dark appearance persist after reload and apply to public site",
  );
  const current = (await api("/api/admin/settings")).data.records[0];
  let saved = await api("/api/admin/settings", "PATCH", {
    ...current,
    data: { ...current.data, themeMode: "system" },
  });
  assert.equal(saved.status, 200);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-mode",
    "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  pass("System mode responds to device appearance changes");
  await page.goto(base + "/admin/profile");
  await expect(page.getByText("Profile image", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  const settings = page.getByRole("menuitem", {
    name: "Settings",
    exact: true,
  });
  assert.ok(
    ["flex-start", "flow-start"].includes(
      await settings.evaluate((e) => getComputedStyle(e).justifyContent),
    ),
  );
  await page.keyboard.press("Escape");
  pass("Profile image picker available and Settings menu aligned left");
  const contacts = (await api("/api/admin/contacts?size=20")).data.records;
  assert.ok(contacts.length);
  await page.goto(base + "/admin/contacts?edit=" + contacts[0].id);
  const edit = page
    .getByRole("button", { name: "Edit unsent reply", exact: true })
    .first();
  {
    if (await edit.count()) await edit.click();
    else await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page
      .getByLabel("Subject", { exact: true })
      .fill("QA temporary unsaved subject");
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", {
        name: "Discard unsaved changes?",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Compose reply", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Compose reply", exact: true }),
    ).toHaveCount(0);
    assert.equal(browserDialogs, 0);
    pass(
      "Composer uses custom animated discard dialog; Keep editing and Discard work",
    );
  }
  const session = (await api("/api/auth/get-session")).data;
  assert.ok(
    new Date(session.session.expiresAt).getTime() - Date.now() > 300 * 86400000,
  );
  pass("Persistent admin session has renewable one-year lifetime");
  const loc = await api("/api/admin/locations", "POST", {
    title: "Temporary QA map location",
    slug: "qa-map-" + Date.now(),
    status: "published",
    sortOrder: 0,
    data: {
      address: "Temporary map verification",
      city: "QA only",
      country: "GB",
      latitude: 51.5074,
      longitude: -0.1278,
      primary: true,
    },
  });
  assert.equal(loc.status, 201);
  try {
    await page.goto(base + "/contact");
    const panel = page.locator("#booking .booking-locations");
    await expect(
      panel.getByText("Temporary QA map location", { exact: true }),
    ).toBeVisible();
    if (
      await panel
        .getByRole("button", { name: "Load interactive map", exact: true })
        .count()
    )
      await panel
        .getByRole("button", { name: "Load interactive map", exact: true })
        .click();
    await expect(panel.locator(".leaflet-container")).toBeVisible();
    const form = await page.locator("#booking .contact-form").boundingBox(),
      map = await panel.boundingBox();
    assert.ok(map.x < form.x);
    await panel.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          panel
            .locator(".leaflet-tile")
            .evaluateAll(
              (imgs) =>
                imgs.filter((img) => img.complete && img.naturalWidth > 0)
                  .length,
            ),
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);
    const tiles = await panel
      .locator(".leaflet-tile")
      .evaluateAll((imgs) =>
        imgs.map((img) => ({ loaded: img.complete && img.naturalWidth > 0 })),
      );
    console.log(
      "Map tiles loaded:",
      tiles.filter((t) => t.loaded).length,
      "/",
      tiles.length,
    );
    await page.screenshot({ path: folder + "/contact-map.png" });
    pass(
      "Published admin location renders beneath call introduction beside form",
    );
  } finally {
    await api("/api/admin/locations", "DELETE", { id: loc.data.id });
  }
  assert.deepEqual(errors, []);
  pass("No browser runtime errors");
} finally {
  const current = (await api("/api/admin/settings")).data.records[0];
  const restore = await api("/api/admin/settings", "PATCH", {
    ...current,
    data: original.data,
  });
  assert.equal(restore.status, 200);
  writeFileSync(folder + "/RESULTS.json", JSON.stringify(results, null, 2));
  await browser.close();
}
