import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/email";
import { HttpError } from "@/lib/access";
export async function stripeConfiguration() {
  const row = await prisma.integrationSetting.findUnique({
    where: { id: "stripe" },
  });
  const data = (row?.data || {}) as Record<string, unknown>;
  const secrets = row?.secret
    ? (JSON.parse(decryptSecret(row.secret)) as {
        secretKey?: string;
        webhookSecret?: string;
      })
    : {};
  const secretKey = secrets.secretKey || process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret =
    secrets.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "";
  const mode = data.mode === "live" ? "live" : "test";
  const matching = new RegExp(`^(sk|rk)_${mode}_[A-Za-z0-9]+$`).test(secretKey);
  return {
    mode,
    data,
    webhookSecret,
    enabled:
      process.env.STORE_CHECKOUT_ENABLED === "true" &&
      matching &&
      !!webhookSecret,
    client: matching
      ? new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20000 })
      : null,
  };
}
export async function checkoutStripe() {
  const config = await stripeConfiguration();
  if (!config.enabled || !config.client)
    throw new HttpError(
      409,
      "Secure payments are not enabled. Configure matching Stripe keys and the signed webhook, then enable STORE_CHECKOUT_ENABLED. Your cart has been preserved.",
    );
  // Tax setup is explicitly required before charging tax; never silently ignore saved rules.
  if (config.data.taxMode && config.data.taxMode !== "none")
    throw new HttpError(
      409,
      "This checkout requires a reviewed tax integration before using the selected tax mode. Your cart has been preserved.",
    );
  return { ...config, client: config.client };
}
export function verifiedPayment(
  session: Stripe.Checkout.Session,
  order: {
    id: string;
    stripeSessionId: string | null;
    total: number;
    currency: string;
  },
  live: boolean,
) {
  return (
    session.id === order.stripeSessionId &&
    session.metadata?.orderId === order.id &&
    session.livemode === live &&
    session.currency === order.currency.toLowerCase() &&
    session.amount_total === order.total &&
    (session.payment_status === "paid" ||
      (session.payment_status === "no_payment_required" && order.total === 0))
  );
}
