import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripeConfiguration, verifiedPayment } from "@/lib/store/stripe";
import { digest, token } from "@/lib/store/cart";
import { queueTemplate } from "@/lib/email";
export async function POST(request: NextRequest) {
  try {
    const config = await stripeConfiguration();
    if (!config.client || !config.webhookSecret)
      return NextResponse.json(
        { error: "Webhook not configured." },
        { status: 503 },
      );
    const signature = request.headers.get("stripe-signature");
    if (!signature)
      return NextResponse.json(
        { error: "Missing signature." },
        { status: 400 },
      );
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1048576) {
          await reader.cancel();
          return NextResponse.json(
            { error: "Payload too large." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    const raw = Buffer.concat(chunks).toString("utf8");
    let event: Stripe.Event;
    try {
      event = config.client.webhooks.constructEvent(
        raw,
        signature,
        config.webhookSecret,
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid signature." },
        { status: 400 },
      );
    }
    if (event.livemode !== (config.mode === "live"))
      return NextResponse.json({ error: "Mode mismatch." }, { status: 400 });
    const handled = [
      "charge.refunded",
      "charge.dispute.created",
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ];
    if (!handled.includes(event.type))
      return NextResponse.json({ received: true });
    if (
      event.type === "charge.refunded" ||
      event.type === "charge.dispute.created"
    ) {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      const paymentId =
        typeof object.payment_intent === "string"
          ? object.payment_intent
          : object.payment_intent?.id;
      if (!paymentId) return NextResponse.json({ received: true });
      const direct = await prisma.storeOrder.findUnique({
        where: { stripePaymentId: paymentId },
      });
      const metadataOrderId = direct
        ? direct.id
        : (await config.client.paymentIntents.retrieve(paymentId)).metadata
            .orderId;
      await prisma.$transaction(
        async (tx) => {
          if (
            await tx.storeWebhookEvent.findUnique({ where: { id: event.id } })
          )
            return;
          const order = metadataOrderId
            ? await tx.storeOrder.findUnique({ where: { id: metadataOrderId } })
            : null;
          if (order) {
            const status =
              event.type === "charge.dispute.created"
                ? "disputed"
                : (object as Stripe.Charge).amount_refunded >= order.total
                  ? "refunded"
                  : "partially-refunded";
            await tx.storeOrder.update({
              where: { id: order.id },
              data: { paymentStatus: status, stripePaymentId: paymentId },
            });
            await tx.storeEntitlement.updateMany({
              where: { item: { orderId: order.id }, revokedAt: null },
              data: { revokedAt: new Date() },
            });
            await tx.storeOrderEvent.create({
              data: {
                orderId: order.id,
                action: status,
                description:
                  "Stripe reported a refund or dispute; download access suspended for review.",
              },
            });
          }
          await tx.storeWebhookEvent.create({
            data: { id: event.id, type: event.type },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return NextResponse.json({ received: true });
    }
    const session = event.data.object as Stripe.Checkout.Session;
    await prisma.$transaction(
      async (tx) => {
        if (await tx.storeWebhookEvent.findUnique({ where: { id: event.id } }))
          return;
        const order = await tx.storeOrder.findUnique({
          where: { stripeSessionId: session.id },
          include: { items: true },
        });
        // A session may finish before the creating request saves its id: ask Stripe to retry.
        if (!order) throw new Error("Order not available yet");
        if (verifiedPayment(session, order, config.mode === "live")) {
          const claimed = await tx.storeOrder.updateMany({
            where: { id: order.id, paymentStatus: "pending" },
            data: {
              paymentStatus: "paid",
              fulfillmentStatus: "confirmed",
              stripePaymentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id,
            },
          });
          if (claimed.count) {
            const access = token();
            const details = session.customer_details;
            const prior = order.billing as Record<string, Prisma.JsonValue>;
            const billing = JSON.parse(
              JSON.stringify({
                ...prior,
                ...(details
                  ? {
                      name: details.name || prior.name,
                      email: details.email || prior.email,
                      address: details.address,
                    }
                  : {}),
              }),
            ) as Prisma.InputJsonValue;
            await tx.storeOrder.update({
              where: { id: order.id },
              data: { billing, accessHash: digest(access) },
            });
            for (const item of order.items) {
              const snapshot = item.snapshot as Record<string, unknown>;
              if (item.kind === "digital") {
                const files = await tx.storeProductFile.findMany({
                  where: { productId: item.productId, deletedAt: null },
                });
                const days = Math.max(
                  1,
                  Math.min(3650, Number(snapshot.downloadDays) || 30),
                );
                const maximum = Math.max(
                  1,
                  Math.min(10000, Number(snapshot.downloadLimit) || 5),
                );
                for (const file of files)
                  await tx.storeEntitlement.create({
                    data: {
                      itemId: item.id,
                      fileId: file.id,
                      tokenHash: digest(token()),
                      expiresAt: new Date(Date.now() + days * 86400000),
                      maximum,
                    },
                  });
              } else
                await tx.storeOrderItem.update({
                  where: { id: item.id },
                  data: { serviceStatus: "awaiting-requirements" },
                });
            }
            const currentCart = await tx.storeCart.findUnique({
              where: { id: order.cartId },
            });
            if (
              currentCart &&
              typeof prior.cartVersion === "number" &&
              currentCart.version === prior.cartVersion
            ) {
              await tx.storeCartItem.deleteMany({
                where: { cartId: order.cartId },
              });
              await tx.storeCart.update({
                where: { id: order.cartId },
                data: { version: { increment: 1 }, coupon: null },
              });
            }
            await tx.storeOrderEvent.create({
              data: {
                orderId: order.id,
                action: "payment-confirmed",
                description:
                  "Payment confirmed by signed Stripe webhook; order access granted.",
              },
            });
            const site = new URL(
              process.env.NEXT_PUBLIC_SITE_URL ||
                process.env.BETTER_AUTH_URL ||
                "http://127.0.0.1:3000",
            ).origin;
            const siteSettings = await tx.siteSetting.findFirst({
              where: { status: "published", deletedAt: null },
            });
            const company = String(
              (siteSettings?.data as Record<string, unknown> | undefined)
                ?.agencyName || "Our store",
            );
            await queueTemplate(
              tx,
              `payment-confirmed:${order.id}`,
              String(prior.email),
              "payment_confirmed",
              {
                company_name: company,
                customer_name: String(prior.name || ""),
                order_reference: order.reference,
                secure_download_link: `${site}/order/${encodeURIComponent(order.reference)}#token=${access}`,
              },
            );
          }
        } else if (
          [
            "checkout.session.async_payment_failed",
            "checkout.session.expired",
          ].includes(event.type)
        ) {
          await tx.storeOrder.updateMany({
            where: { id: order.id, paymentStatus: "pending" },
            data: {
              paymentStatus: event.type.endsWith("expired")
                ? "expired"
                : "failed",
            },
          });
        } else if (session.payment_status === "paid")
          throw new Error("Payment/order mismatch");
        await tx.storeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    // Concurrent deliveries can contend on the unique event id. A committed event is safe to acknowledge.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "Please retry delivery." },
        { status: 503 },
      );
    console.error(
      "Stripe webhook processing failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return NextResponse.json(
      { error: "Temporary processing failure. Retry delivery." },
      { status: 503 },
    );
  }
}
