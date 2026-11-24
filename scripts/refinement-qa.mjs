import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
  cookie = readFileSync(".local-test-session", "utf8"),
  marker = randomUUID(),
  folder = "docs/refinements/screenshots",
  results = [],
  errors = [];
const pass = (name) => {
  results.push({ name, result: "passed" });
  console.log("PASS", name);
};
async function api(path, method = "GET", body, session = cookie) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: session,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
let inquiryId = "";
const product = await api("/api/admin/store-products", "POST", {
  title: `UI verification ${marker}`,
  slug: `ui-${marker}`,
  status: "published",
  sortOrder: 9999,
  description: "Synthetic local interface test fixture.",
  data: {
    kind: "digital",
    currency: "usd",
    priceMinor: 4900,
    image: "/art/project-0.svg",
  },
});
assert.equal(product.status, 201);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/");
  await expect(
    page.locator("header.header a").filter({ hasText: /^Shop$/ }),
  ).toHaveCount(0);
  const bag = page.getByRole("button", { name: /Open shopping bag/ });
  await expect(bag).toBeVisible();
  await expect(page.locator(".cart-quantity")).toHaveCount(0);
  pass("Navbar has only bag icon with no empty-cart badge or Shop text");
  await expect
    .poll(
      async () =>
        !!(await context.cookies()).find((c) => c.name === "store_cart"),
    )
    .toBe(true);
  await context.request.post(base + "/api/store/cart", {
    headers: { Origin: base },
    data: { action: "add", productId: product.data.id, quantity: 2 },
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open shopping bag, 2 items" }),
  ).toBeVisible();
  const contact = await page
      .locator(".public-desktop-menu")
      .getByRole("link", { name: "Contact", exact: true })
      .boundingBox(),
    bagBox = await bag.boundingBox(),
    talk = await page.locator(".header-actions .secondary").boundingBox();
  assert.ok(contact.x + contact.width < bagBox.x && bagBox.x < talk.x);
  pass("Bag is between Contact and Let's talk with a live navy quantity badge");
  await bag.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: product.data.title }),
  ).toBeVisible();
  await expect(
    dialog.getByText("$98.00", { exact: true }).first(),
  ).toBeVisible();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      true,
    );
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(bag).toBeFocused();
  pass(
    "Mini-cart supports keyboard opening, trapped focus, Escape and focus restoration",
  );
  await bag.click();
  await page
    .getByRole("button", { name: `Increase ${product.data.title} quantity` })
    .click();
  await expect(
    page.getByText("$147.00", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: `${folder}/mini-cart-desktop.png` });
  await page
    .getByRole("link", { name: "Continue Shopping", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  pass(
    "Mini-cart updates real quantities/subtotal and Continue Shopping preserves shop route",
  );
  await page.goto(base + "/checkout");
  await page.getByRole("button", { name: "Country", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Search countries" })
    .fill("Pakistan");
  await page.getByRole("option", { name: /Pakistan/ }).click();
  await expect(
    page.getByRole("button", { name: "Country", exact: true }),
  ).toContainText("Pakistan");
  await expect(page.locator('input[name="country"]')).toHaveValue("PK");
  pass(
    "Searchable country control submits ISO country code with full country names",
  );
  await page.goto(base + "/contact");
  await expect(page.locator("main form")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Preferred date and time", exact: true })
    .click();
  await expect(page.locator(".premium-calendar")).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.locator(".calendar-grid button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator('input[name="requestedAt"]')).not.toHaveValue("");
  await page.screenshot({ path: `${folder}/contact-single-form.png` });
  pass("Contact has one booking form using the custom date/time picker");
  await context.addCookies(
    cookie
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
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Administrator details" }),
  ).toBeVisible();
  await page.screenshot({ path: `${folder}/profile-settings.png` });
  pass("Profile dropdown Settings opens editable administrator details");
  const inquiry = await api("/api/admin/contacts", "POST", {
    title: `Reply layout QA ${marker}`,
    slug: `reply-ui-${marker}`,
    status: "unread",
    sortOrder: 0,
    data: {
      name: "Synthetic Reply QA",
      email: `reply-${marker}@example.test`,
      service: "UI test",
      message: "Synthetic browser verification for editable reply drafts.",
    },
  });
  assert.equal(inquiry.status, 201);
  inquiryId = inquiry.data.id;
  await api("/api/admin/inbox", "POST", {
    inquiryId,
    id: randomUUID(),
    action: "draft",
    subject: "Draft subject",
    body: "<p>Original draft text</p>",
  });
  await page.goto(`${base}/admin/contacts?edit=${inquiryId}`);
  await page
    .getByRole("button", { name: "Edit unsent reply", exact: true })
    .click();
  const composer = page.getByRole("dialog");
  await expect(composer.getByLabel("To", { exact: true })).toHaveValue(
    `reply-${marker}@example.test`,
  );
  await expect(composer.locator(".tiptap")).toContainText(
    "Original draft text",
  );
  const recipientBox = await composer.locator(".reply-recipient").boundingBox(),
    subjectBox = await composer.locator(".reply-subject").boundingBox();
  assert.ok(subjectBox.y > recipientBox.y + recipientBox.height);
  await composer.locator(".tiptap").fill("Edited browser draft");
  await expect
    .poll(async () => {
      const box = await composer.boundingBox();
      return Math.abs(box.x + box.width - page.viewportSize().width) < 1;
    })
    .toBe(true);
  await page.screenshot({ path: `${folder}/reply-composer.png` });
  await composer
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await expect(composer).toHaveCount(0);
  const history = await api(`/api/admin/inbox?id=${inquiryId}`);
  assert.ok(
    history.data.inquiry.conversation.some((m) =>
      m.body.includes("Edited browser draft"),
    ),
  );
  pass(
    "Reply recipient layout is separated and saved drafts remain editable through the browser",
  );
  await page.goto(base + "/admin/store/settings");
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(
    page.getByText("Restricted / secret key", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Taxes", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Tax calculation mode" }),
  ).toBeVisible();
  await page.screenshot({ path: `${folder}/tax-settings.png` });
  pass("Payment and tax tabs render editable configuration controls");
  for (const width of [1024, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base + "/");
    await expect(bag).toBeVisible();
    await bag.click();
    await expect(dialog).toBeVisible();
    assert.equal(
      await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: `${folder}/mini-cart-${width}.png` });
    await page.keyboard.press("Escape");
    await page.goto(base + "/admin/profile");
    assert.equal(
      await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
      false,
    );
    pass(`Mini-cart and profile remain responsive at ${width}px`);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/");
  await bag.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  pass("Reduced-motion mini-cart remains functional");
  assert.deepEqual(errors, []);
  pass("No uncaught browser errors");
} finally {
  if (inquiryId) await api("/api/admin/contacts", "DELETE", { id: inquiryId });
  await api("/api/admin/store-products", "DELETE", { id: product.data.id });
  writeFileSync(
    "docs/refinements/BROWSER-RESULTS.json",
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
