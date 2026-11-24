import { throttle } from "@/lib/public-requests";
import { prisma } from "@/lib/prisma";
import { checkoutStripe } from "@/lib/store/stripe";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { countryCodes } from "@/lib/countries";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { getCart, totals, token, digest } from "@/lib/store/cart";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email(),
        country: z
          .string()
          .length(2)
          .refine((v) => countryCodes.includes(v)),
        consent: z.literal("on"),
        requestId: z.string().uuid(),
      })
      .parse(await jsonBody(request, 10000));
    const { cart } = await getCart(request);
    if (!cart?.items.length) throw new HttpError(400, "Your cart is empty.");
    const config = await checkoutStripe();
    const summary = await totals(cart, input.email.toLowerCase());
    if (summary.total <= 0)
      throw new HttpError(
        400,
        "This cart does not require card payment. Contact support to arrange access.",
      );
    const origin = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.BETTER_AUTH_URL ||
        "http://127.0.0.1:3000",
    ).origin;
    if (config.mode === "live" && !origin.startsWith("https://"))
      throw new HttpError(409, "Live checkout requires HTTPS.");
    const requestKey = digest(
      `${cart.id}:${cart.version}:${input.email.toLowerCase()}:${input.country}`,
    );
    let order = await prisma.storeOrder.findUnique({
      where: { requestKey },
      include: { items: true },
    });
    if (order && order.paymentStatus !== "pending")
      throw new HttpError(
        409,
        "This cart already has an order. Review your orders before starting another purchase.",
      );
    if (!order) {
      order = await prisma.$transaction(async (tx) => {
        await throttle(tx, `checkout-cart:${cart.id}`);
        const customer = await tx.storeCustomer.upsert({
          where: { email: input.email.toLowerCase() },
          create: {
            email: input.email.toLowerCase(),
            name: input.name,
            country: input.country,
          },
          update: {},
        });
        return tx.storeOrder.create({
          data: {
            reference: `ORD-${randomBytes(8).toString("hex").toUpperCase()}`,
            requestKey,
            cartId: cart.id,
            customerId: customer.id,
            accessHash: digest(token()),
            currency: summary.currency,
            subtotal: summary.subtotal,
            discount: summary.discount,
            tax: 0,
            total: summary.total,
            coupon: summary.coupon,
            billing: {
              name: input.name,
              email: input.email.toLowerCase(),
              country: input.country,
              cartVersion: cart.version,
            },
            items: {
              create: summary.items.map((item) => ({
                productId: item.productId,
                title: item.title,
                kind: String(item.kind),
                package: item.package,
                quantity: item.quantity,
                unitAmount: item.unitAmount,
                snapshot: (cart.items.find((i) => i.id === item.id)?.product
                  .data || {}) as Prisma.InputJsonValue,
              })),
            },
          },
          include: { items: true },
        });
      });
    }
    if (order.stripeSessionId) {
      const existing = await config.client.checkout.sessions.retrieve(
        order.stripeSessionId,
      );
      if (existing.status === "open" && existing.url)
        return NextResponse.json({ url: existing.url });
      throw new HttpError(
        409,
        "This checkout has completed or expired. Check your order status or update your cart to start again.",
      );
    }
    // Allocate the saved discount over immutable order lines in minor units.
    let remainingDiscount = order.discount,
      remainingGross = order.subtotal;
    const lineItems = order.items.flatMap((item) => {
      const gross = item.unitAmount * item.quantity;
      const discount = Math.min(
        gross,
        Math.floor((remainingDiscount * gross) / Math.max(1, remainingGross)),
      );
      remainingGross -= gross;
      remainingDiscount -= discount;
      const amount = gross - discount;
      return amount > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: order!.currency.toLowerCase(),
                unit_amount: amount,
                product_data: {
                  name: `${item.title} × ${item.quantity}`.slice(0, 250),
                  description: `License/package: ${item.package}`.slice(0, 500),
                },
              },
            },
          ]
        : [];
    });
    if (!lineItems.length)
      throw new HttpError(
        400,
        "This cart does not require card payment. Please contact support to arrange access.",
      );
    const session = await config.client.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: String((order.billing as Record<string, string>).email),
        billing_address_collection: "required",
        client_reference_id: order.reference,
        metadata: { orderId: order.id },
        payment_intent_data: { metadata: { orderId: order.id } },
        line_items: lineItems,
        success_url: `${origin}/checkout/success?reference=${encodeURIComponent(order.reference)}`,
        cancel_url: `${origin}/checkout/cancel`,
        integration_identifier: "agency_store_checkout_qmfkrzpa",
      },
      { idempotencyKey: `checkout-${order.id}` },
    );
    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    if (!session.url)
      throw new HttpError(
        503,
        "Checkout is temporarily unavailable. Retry to resume your order.",
      );
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return apiError(error);
  }
}
