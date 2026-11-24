import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const folder = "docs/refinements/purchase-release";
mkdirSync(folder, { recursive: true });
const order = {
  reference: "QA-PREVIEW",
  currency: "usd",
  subtotal: 1299,
  discount: 200,
  tax: 0,
  total: 1099,
  paymentStatus: "paid",
  billing: {
    name: "Preview Customer",
    email: "preview@example.invalid",
    address: { line1: "123 Example Street", city: "Karachi", country: "PK" },
  },
  items: [
    {
      id: "preview-item",
      title: "Creative Studio Template",
      quantity: 1,
      unitAmount: 1299,
    },
  ],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  let response = { orders: [order] };
  await page.route("**/api/store/order?reference=QA-PREVIEW", (route) =>
    route.fulfill({ json: response }),
  );
  for (const width of [1440, 390])
    for (const mode of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        "http://127.0.0.1:3000/checkout/success?reference=QA-PREVIEW",
      );
      await expect(
        page.getByRole("heading", {
          name: "Congratulations on your purchase!",
        }),
      ).toBeVisible();
      await page.evaluate(
        (mode) =>
          window.dispatchEvent(
            new window.CustomEvent("site-theme-updated", {
              detail: { websiteThemeMode: mode },
            }),
          ),
        mode,
      );
      await expect(
        page.getByText("Creative Studio Template", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("preview@example.invalid", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Total paid", { exact: true })).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        "Horizontal overflow",
      );
      await page.waitForTimeout(900);
      await page.screenshot({
        path: `${folder}/${mode}-${width}.png`,
        fullPage: true,
      });
    }
  response = { orders: [{ ...order, paymentStatus: "pending" }] };
  await page.reload();
  await expect(page.getByRole("status")).toContainText("being verified");
  await expect(
    page.getByRole("heading", { name: "Congratulations on your purchase!" }),
  ).toHaveCount(0);
  response = { orders: [] };
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Order access is required",
  );
  await expect(
    page.getByRole("heading", { name: "Congratulations on your purchase!" }),
  ).toHaveCount(0);
  console.log(
    "PASS: purchase confirmation displays fixture products/billing in light/dark desktop/mobile without overflow; pending and unowned states never show congratulations. No order or payment data was written.",
  );
} finally {
  await browser.close();
}
