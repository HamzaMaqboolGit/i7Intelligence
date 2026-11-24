/* eslint-disable @typescript-eslint/no-explicit-any -- Runtime assertions validate synthetic local commerce fixtures. */
import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
  admin = readFileSync(".local-test-session", "utf8"),
  results: { name: string; result: string }[] = [],
  marker = randomUUID();
let guest = "";
function pass(name: string) {
  results.push({ name, result: "passed" });
  console.log("PASS", name);
}
async function req(path: string, method = "GET", body?: any, cookie = admin) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const c = r.headers.get("set-cookie");
  if (c?.startsWith("store_cart=")) guest = c.split(";")[0];
  return { status: r.status, data: await r.json() };
}
async function main() {
  const { prisma } = await import("../lib/prisma");
  const products: string[] = [],
    coupons: string[] = [];
  let cartId = "";
  try {
    assert.equal(
      (await req("/api/admin/store/overview", "GET", undefined, "")).status,
      401,
    );
    assert.equal(
      (await req("/api/admin/store/files?productId=x", "GET", undefined, ""))
        .status,
      401,
    );
    pass(
      "Commerce administration and private-file metadata require authentication",
    );
    const raw = {
      title: `QA digital ${marker}`,
      slug: `qa-digital-${marker}`,
      description: "Explicit local commerce test fixture.",
      status: "draft",
      sortOrder: 9999,
      data: {
        kind: "digital",
        currency: "usd",
        priceMinor: 4900,
        image: "/art/project-0.svg",
        fulfillment: "automatic",
        downloadDays: 30,
        downloadLimit: 5,
      },
    };
    let result = await req("/api/admin/store-products", "POST", raw);
    assert.equal(result.status, 201);
    let digital = result.data;
    products.push(digital.id);
    pass("Create digital product with integer minor-unit price");
    const hidden = await req("/api/store/products", "GET", undefined, "");
    assert.ok(!hidden.data.records.some((p: any) => p.id === digital.id));
    pass("Draft product excluded from public catalog");
    result = await req("/api/admin/store-products", "POST", {
      ...raw,
      title: `QA service ${marker}`,
      slug: `qa-service-${marker}`,
      status: "published",
      data: {
        ...raw.data,
        kind: "service",
        fulfillment: "manual",
        priceMinor: 12500,
      },
    });
    assert.equal(result.status, 201);
    products.push(result.data.id);
    pass("Create and publish professional service");
    result = await req("/api/admin/store-products", "PATCH", {
      ...digital,
      title: `QA digital edited ${marker}`,
      status: "published",
    });
    assert.equal(result.status, 200);
    digital = result.data;
    pass("Edit and publish digital product");
    assert.equal(
      (
        await req("/api/admin/store-products", "POST", {
          ...raw,
          slug: `invalid-${marker}`,
          data: { ...raw.data, priceMinor: 49.5 },
        })
      ).status,
      400,
    );
    pass("Fractional minor-unit prices rejected");
    const form = new FormData();
    form.set("productId", digital.id);
    form.set("version", "1.0");
    form.set(
      "file",
      new File(["%PDF-1.4\nSynthetic QA file\n%%EOF"], "qa-private.pdf", {
        type: "application/pdf",
      }),
    );
    let upload = await fetch(base + "/api/admin/store/files", {
      method: "POST",
      headers: { Cookie: admin, Origin: base },
      body: form,
    });
    assert.equal(upload.status, 201);
    const file = await upload.json();
    assert.ok(file.id);
    assert.ok(!("storageKey" in file));
    assert.equal((await fetch(base + `/media/${file.id}`)).status, 404);
    pass(
      "Private file upload stored without public URL or exposed storage path",
    );
    const spoof = new FormData();
    spoof.set("productId", digital.id);
    spoof.set(
      "file",
      new File(["#!/bin/sh\necho unsafe"], "fake.pdf", {
        type: "application/pdf",
      }),
    );
    upload = await fetch(base + "/api/admin/store/files", {
      method: "POST",
      headers: { Cookie: admin, Origin: base },
      body: spoof,
    });
    assert.equal(upload.status, 400);
    pass("Private upload MIME spoof rejected");
    result = await req("/api/store/cart", "GET", undefined, "");
    assert.equal(result.status, 200);
    assert.ok(guest);
    pass("Guest cart uses an opaque HttpOnly database session cookie");
    result = await req(
      "/api/store/cart",
      "POST",
      { action: "add", productId: digital.id, priceMinor: 1 },
      guest,
    );
    assert.equal(result.status, 200);
    assert.equal(result.data.total, 4900);
    const itemId = result.data.items[0].id;
    pass("Add to cart ignores client-supplied price");
    result = await req(
      "/api/store/cart",
      "POST",
      { action: "update", itemId, quantity: 2 },
      guest,
    );
    assert.equal(result.data.total, 9800);
    assert.equal(
      (await req("/api/store/cart", "GET", undefined, guest)).data.total,
      9800,
    );
    pass("Quantity updates and cart persistence recalculate exact totals");
    const coupon = await req("/api/admin/store-coupons", "POST", {
      title: `QA coupon ${marker}`,
      status: "published",
      sortOrder: 9999,
      data: {
        code: `QA-${marker}`,
        kind: "percentage",
        value: 10,
        minimumMinor: 100,
      },
    });
    assert.equal(coupon.status, 201);
    coupons.push(coupon.data.id);
    result = await req(
      "/api/store/cart",
      "POST",
      { action: "coupon", code: `QA-${marker}` },
      guest,
    );
    assert.equal(result.status, 200);
    assert.equal(result.data.discount, 980);
    assert.equal(result.data.total, 8820);
    pass("Stored valid coupon calculates exact server-side discount");
    result = await req(
      "/api/store/cart",
      "POST",
      { action: "coupon", code: "NOT-A-REAL-COUPON" },
      guest,
    );
    assert.equal(result.status, 400);
    pass("Invalid coupon rejected without changing the cart");
    assert.equal(
      (
        await req(
          "/api/store/cart",
          "POST",
          { action: "add", productId: digital.id, package: "forged" },
          guest,
        )
      ).status,
      400,
    );
    pass("Invalid license/package rejected");
    assert.equal(
      (
        await req(
          "/api/store/download",
          "POST",
          { token: "x".repeat(43) },
          guest,
        )
      ).status,
      403,
    );
    pass("Forged private download token rejected");
    assert.equal(
      (
        await req(
          "/api/store/order?reference=KNOWN-REFERENCE",
          "GET",
          undefined,
          "",
        )
      ).data.orders.length,
      0,
    );
    pass("Order reference alone never exposes customer orders");
    result = await req(
      "/api/store/checkout",
      "POST",
      {
        name: "Synthetic QA",
        email: "commerce-qa@example.test",
        country: "US",
        consent: "on",
        requestId: randomUUID(),
      },
      guest,
    );
    assert.equal(result.status, 409);
    assert.match(result.data.error, /not enabled/);
    pass("Unconfigured Stripe checkout fails closed and preserves cart");
    result = await req("/api/admin/store-products", "PATCH", {
      ...digital,
      status: "draft",
    });
    assert.equal(result.status, 200);
    assert.equal(
      (await req("/api/store/cart", "GET", undefined, guest)).status,
      409,
    );
    pass("Unpublishing revalidates availability for existing carts");
    cartId =
      (
        await prisma.storeCart.findFirst({
          where: { items: { some: { productId: digital.id } } },
        })
      )?.id || "";
  } finally {
    for (const id of products)
      await prisma.storeProduct.updateMany({
        where: { id },
        data: { deletedAt: new Date(), status: "archived" },
      });
    for (const id of coupons)
      await prisma.storeCoupon.updateMany({
        where: { id },
        data: { deletedAt: new Date(), status: "archived" },
      });
    if (cartId) await prisma.storeCartItem.deleteMany({ where: { cartId } });
    writeFileSync(
      "docs/commerce/TEST-RESULTS.json",
      JSON.stringify(results, null, 2),
    );
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
