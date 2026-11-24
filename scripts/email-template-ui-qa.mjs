import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  let template = {
    key: "contact_ack",
    subject: "Thank you",
    body: "<p>Hello {{customer_name}}</p>",
  };
  await page.route("**/api/admin/email", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      assert.equal(body.action, "template");
      template = { key: body.key, subject: body.subject, body: body.body };
      await route.fulfill({ json: { ok: true } });
    } else
      await route.fulfill({
        json: {
          config: {},
          templates: [template],
          logs: [],
          passwordConfigured: false,
        },
      });
  });
  await page.goto("http://127.0.0.1:3000/checkout/success");
  await page.addScriptTag({ path: ".local-runtime/email-qa.js" });
  const host = page.locator("#email-qa");
  await host.getByRole("button", { name: "Templates", exact: true }).click();
  const source = host.getByRole("textbox", { name: "HTML email body" });
  await expect(source).toBeVisible();
  await source.fill(
    "<h1>Welcome customer</h1><p>Your order is ready.</p><script>window.parent.__emailUnsafe=true</script>",
  );
  await host
    .getByRole("button", { name: "Email preview", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[title="Email template preview"]')
      .getByRole("heading", { name: "Welcome customer" }),
  ).toBeVisible();
  assert.equal(await page.evaluate(() => window.__emailUnsafe), undefined);
  await host.getByRole("button", { name: "HTML source", exact: true }).click();
  await source.fill("<p>Hello {{customer_name}}</p>");
  await host.getByRole("button", { name: "Wrap in branded layout" }).click();
  await expect(source).toHaveValue(/<table/);
  await expect(
    host.getByRole("button", { name: "Visual editor", exact: true }),
  ).toBeDisabled();
  await host
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(source).toHaveValue(/<table/);
  await host
    .getByRole("button", { name: "Email preview", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[title="Email template preview"]')
      .getByText("Hello {{customer_name}}"),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "docs/refinements/purchase-release/email-preview.png",
    fullPage: true,
  });
  console.log(
    "PASS: actual email editor HTML source, table layout, sandboxed preview and mocked save/reload; no email sent or stored data changed.",
  );
} finally {
  await browser.close();
}
