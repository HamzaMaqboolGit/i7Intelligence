import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import Stripe from "stripe";
import { NextRequest } from "next/server";
// This test uses an isolated, temporary database with NO administrator/user accounts.
async function main() {
  const admin = JSON.parse(
    readFileSync(
      process.env.QA_MYSQL_ADMIN_CONFIG ||
        "/private/tmp/royal-studio-mysql-admin.json",
      "utf8",
    ),
  );
  const root = await mysql.createConnection({
    ...admin,
    multipleStatements: true,
  });
  const name = `agency_purchase_qa_${randomBytes(6).toString("hex")}`;
  await root.query(`CREATE DATABASE \`${name}\``);
  let db: Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
  try {
    db = await mysql.createConnection({
      ...admin,
      database: name,
      multipleStatements: true,
    });
    await db.query(
      readFileSync(
        "exports/hostinger_20261124_0039/private-bundle/database/01-schema.sql",
        "utf8",
      ),
    );
    process.env.DATABASE_URL = `mysql://${encodeURIComponent(admin.user)}:${encodeURIComponent(admin.password)}@localhost/${name}?socket=${encodeURIComponent(admin.socketPath)}`;
    process.env.BETTER_AUTH_SECRET =
      "qa-only-key-not-used-outside-this-process-123456";
    process.env.SMTP_ENCRYPTION_KEY = process.env.BETTER_AUTH_SECRET;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
    const { prisma } = await import("../lib/prisma");
    try {
      const { encryptSecret, safeEmailHtml } = await import("../lib/email");
      const { POST } = await import("../app/api/store/webhook/route");
      await prisma.integrationSetting.create({
        data: {
          id: "stripe",
          data: { mode: "test", taxMode: "none" },
          secret: encryptSecret(
            JSON.stringify({
              secretKey: "sk_test_qaOnlyNotARealKey",
              webhookSecret: "whsec_qaOnly",
            }),
          ),
        },
      });
      const cart = await prisma.storeCart.create({
        data: {
          tokenHash: "test-cart",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const customer = await prisma.storeCustomer.create({
        data: { name: "Test Customer", email: "test@example.invalid" },
      });
      const product = await prisma.storeProduct.create({
        data: {
          title: "QA digital product",
          slug: "qa-product",
          status: "published",
          data: {},
        },
      });
      await prisma.storeProductFile.create({
        data: {
          productId: product.id,
          storageKey: "qa.zip",
          name: "download.zip",
          mime: "application/zip",
          size: 1,
        },
      });
      const makeOrder = (reference: string, session: string) =>
        prisma.storeOrder.create({
          data: {
            reference,
            requestKey: reference,
            cartId: cart.id,
            customerId: customer.id,
            accessHash: reference,
            currency: "usd",
            subtotal: 1000,
            total: 1000,
            stripeSessionId: session,
            billing: { name: "Test Customer", email: "test@example.invalid" },
            items: {
              create: {
                productId: product.id,
                title: product.title,
                kind: "digital",
                package: "standard",
                unitAmount: 1000,
                quantity: 1,
                snapshot: { downloadDays: 10, downloadLimit: 3 },
              },
            },
          },
        });
      const order = await makeOrder("QA-ORDER", "cs_test_qa");
      const stripe = new Stripe("sk_test_qaOnlyNotARealKey");
      const send = async (
        id: string,
        type: string,
        object: object,
        valid = true,
      ) => {
        const payload = JSON.stringify({
          id,
          type,
          object: "event",
          livemode: false,
          data: { object },
        });
        const signature = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: valid ? "whsec_qaOnly" : "wrong",
        });
        return POST(
          new NextRequest("https://example.invalid/api/store/webhook", {
            method: "POST",
            body: payload,
            headers: { "stripe-signature": signature },
          }),
        );
      };
      const session = {
        id: "cs_test_qa",
        object: "checkout.session",
        metadata: { orderId: order.id },
        livemode: false,
        currency: "usd",
        amount_total: 1000,
        payment_status: "paid",
        payment_intent: "pi_qa",
        customer_details: {
          name: "Test Customer",
          email: "test@example.invalid",
          address: { line1: "123 Test Road", city: "Test City", country: "US" },
        },
      };
      assert.equal(
        (await send("evt_bad", "checkout.session.completed", session, false))
          .status,
        400,
      );
      assert.equal(
        (
          await send("evt_unpaid", "checkout.session.completed", {
            ...session,
            payment_status: "unpaid",
          })
        ).status,
        200,
      );
      assert.equal(
        (await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "pending",
      );
      assert.equal(
        (
          await send(
            "evt_paid",
            "checkout.session.async_payment_succeeded",
            session,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await send(
            "evt_paid",
            "checkout.session.async_payment_succeeded",
            session,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await send(
            "evt_paid_duplicate",
            "checkout.session.completed",
            session,
          )
        ).status,
        200,
      );
      assert.equal(
        (await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "paid",
      );
      assert.equal(await prisma.storeEntitlement.count(), 1);
      assert.equal(await prisma.emailOutbox.count(), 1);
      const mismatch = await makeOrder("QA-MISMATCH", "cs_mismatch");
      assert.equal(
        (
          await send("evt_mismatch", "checkout.session.completed", {
            ...session,
            id: "cs_mismatch",
            metadata: { orderId: mismatch.id },
            amount_total: 1,
          })
        ).status,
        503,
      );
      assert.equal(
        (
          await prisma.storeOrder.findUniqueOrThrow({
            where: { id: mismatch.id },
          })
        ).paymentStatus,
        "pending",
      );
      assert.equal(
        (
          await send("evt_refund", "charge.refunded", {
            id: "ch_qa",
            payment_intent: "pi_qa",
            amount_refunded: 1000,
          })
        ).status,
        200,
      );
      assert.equal(
        (await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } }))
          .paymentStatus,
        "refunded",
      );
      assert.ok((await prisma.storeEntitlement.findFirstOrThrow()).revokedAt);
      const clean = safeEmailHtml(
        '<table style="background-color:#ffffff"><tr><td style="padding:20px"><h1>Hello</h1><a href="javascript:alert(1)" onclick="bad()">Link</a><script>bad()</script></td></tr></table>',
      );
      assert.ok(clean.includes("<table"));
      assert.ok(clean.includes("padding:20px"));
      assert.ok(!/javascript:|onclick|<script/.test(clean));
      assert.equal(await prisma.user.count(), 0);
      console.log(
        "PASS: isolated payment webhook QA: invalid signature, unpaid, paid, duplicate deliveries, wrong amount, refund revocation, queued HTML email, safe template HTML; no admin accounts created.",
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    await db?.end();
    await root.query(`DROP DATABASE \`${name}\``);
    await root.end();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
