"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Gift, ReceiptText } from "lucide-react";
import { money } from "./storefront";
type Order = {
  reference: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: string;
  billing: {
    name?: string;
    email?: string;
    country?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  items: { id: string; title: string; quantity: number; unitAmount: number }[];
};
export default function PurchaseSuccess({ reference }: { reference: string }) {
  const [order, setOrder] = useState<Order | null>(null),
    [message, setMessage] = useState("Confirming your payment…");
  const reduced = useReducedMotion();
  useEffect(() => {
    let stopped = false,
      attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (!reference) {
          setMessage(
            "Open the private order link from checkout to view your confirmation.",
          );
          return;
        }
        const r = await fetch(
          `/api/store/order?reference=${encodeURIComponent(reference)}`,
          { cache: "no-store" },
        );
        if (!r.ok)
          throw new Error(
            "Unable to check your order. Please try again from your order page.",
          );
        const d = await r.json();
        if (stopped) return;
        const found = d.orders?.[0];
        if (!found) {
          setMessage(
            "Order access is required. Use the same browser you used for checkout or your private order email.",
          );
          return;
        }
        if (found.paymentStatus === "paid") {
          setOrder(found);
          return;
        }
        setMessage(
          found.paymentStatus === "pending"
            ? "Your payment is being verified. Please keep this page open."
            : "Payment has not been confirmed. Check your order for the latest status.",
        );
        if (found.paymentStatus === "pending" && ++attempts < 20)
          timer = setTimeout(load, 3000);
      } catch (e) {
        if (!stopped) setMessage((e as Error).message);
      }
    }
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reference]);
  if (!order)
    return (
      <main id="main" className="container store-empty">
        <ReceiptText size={44} />
        <h1>Order confirmation</h1>
        <p role="status">{message}</p>
        <Link
          className="button"
          href={reference ? `/order/${encodeURIComponent(reference)}` : "/cart"}
        >
          View order status
        </Link>
      </main>
    );
  const address = order.billing.address;
  return (
    <main id="main" className="container purchase-success">
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="purchase-celebration"
      >
        {!reduced && (
          <div className="purchase-confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${i * 5.5}%`,
                  animationDelay: `${(i % 5) * 0.12}s`,
                  background: i % 2 ? "var(--accent)" : "var(--accent-soft)",
                }}
              />
            ))}
          </div>
        )}
        <CheckCircle2 size={64} />
        <span className="eyebrow">PAYMENT CONFIRMED</span>
        <h1>Congratulations on your purchase!</h1>
        <p>
          Thank you{order.billing.name ? `, ${order.billing.name}` : ""}. Your
          order is confirmed.
        </p>
        <strong>Order {order.reference}</strong>
      </motion.section>
      <div className="purchase-details">
        <section className="store-order-card">
          <h2>
            <Gift size={22} /> Your products
          </h2>
          {order.items.map((item) => (
            <div className="purchase-line" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>Quantity: {item.quantity}</small>
              </span>
              <span>
                {money(item.unitAmount * item.quantity, order.currency)}
              </span>
            </div>
          ))}
          <div className="purchase-line">
            <span>Subtotal</span>
            <span>{money(order.subtotal, order.currency)}</span>
          </div>
          {order.discount > 0 && (
            <div className="purchase-line">
              <span>Discount</span>
              <span>−{money(order.discount, order.currency)}</span>
            </div>
          )}
          <div className="purchase-line">
            <span>Tax</span>
            <span>{money(order.tax, order.currency)}</span>
          </div>
          <div className="purchase-line">
            <strong>Total paid</strong>
            <strong>{money(order.total, order.currency)}</strong>
          </div>
        </section>
        <section className="store-order-card">
          <h2>
            <ReceiptText size={22} /> Billing details
          </h2>
          <p>{order.billing.name}</p>
          <p>{order.billing.email}</p>
          {address && (
            <p>
              {[
                address.line1,
                address.line2,
                address.city,
                address.state,
                address.postal_code,
                address.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          <p>{!address && order.billing.country}</p>
          <p>
            Your receipt and secure order access are sent to your billing email.
          </p>
          <Link
            className="button"
            href={`/order/${encodeURIComponent(order.reference)}`}
          >
            View order & downloads
          </Link>
          <Link className="button secondary" href="/shop">
            Continue shopping
          </Link>
        </section>
      </div>
    </main>
  );
}
