"use client";
import { readCart } from "@/lib/cart-client";
import CountrySelect from "../controls/country-select";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShoppingBag, Trash2, Lock } from "lucide-react";
import { cartAction, money } from "./storefront";
type Cart = {
  items: {
    id: string;
    title: string;
    image?: string;
    quantity: number;
    unitAmount: number;
    total: number;
    kind: string;
    package: string;
  }[];
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  coupon?: string;
  taxNote: string;
};
export default function Cart({ checkout = false }: { checkout?: boolean }) {
  const [country, setCountry] = useState("");
  const [data, setData] = useState<Cart | null>(null),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const d = await readCart<Cart>();
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function change(body: object) {
    setBusy(true);
    try {
      setData(await cartAction(body));
      toast.success("Cart updated");
      setError("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="container store-cart">
      <span className="eyebrow">YOUR DIGITAL COLLECTION</span>
      <h1>{checkout ? "Secure checkout" : "Shopping cart"}</h1>
      {error && (
        <p role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </p>
      )}
      {!data ? (
        <div className="a-skeleton" />
      ) : !data.items.length ? (
        <div className="store-empty">
          <ShoppingBag size={40} />
          <h2>Your cart is empty.</h2>
          <Link className="button" href="/shop">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="store-cart-grid">
          <div>
            {checkout ? (
              <form
                className="contact-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!country) {
                    toast.error("Choose your country before continuing.");
                    return;
                  }
                  setBusy(true);
                  try {
                    const r = await fetch("/api/store/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...Object.fromEntries(new FormData(e.currentTarget)),
                        requestId: crypto.randomUUID(),
                      }),
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    location.assign(d.url);
                  } catch (e) {
                    toast.error("Checkout unavailable", {
                      description: (e as Error).message,
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <h2>Contact & billing information</h2>
                <label>
                  Full name
                  <input required name="name" autoComplete="name" />
                </label>
                <label>
                  Email address
                  <input
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                  />
                </label>
                <label>
                  Phone (optional)
                  <input name="phone" type="tel" autoComplete="tel" />
                </label>
                <label>
                  Country
                  <CountrySelect value={country} onChange={setCountry} />
                </label>
                <label>
                  City
                  <input name="city" autoComplete="address-level2" />
                </label>
                <label>
                  Billing address
                  <input name="address" autoComplete="street-address" />
                </label>
                <label>
                  Postal code
                  <input name="postal" autoComplete="postal-code" />
                </label>
                <label className="contact-consent">
                  <input required type="checkbox" name="consent" />I agree to
                  the terms and privacy notice.
                </label>
                <p>
                  <Lock size={16} />
                  Card details are entered securely on Stripe, never on this
                  server.
                </p>
                <button className="button" disabled={busy}>
                  {busy ? "Preparing checkout…" : "Continue to secure payment"}
                </button>
              </form>
            ) : (
              data.items.map((item) => (
                <article className="store-cart-item" key={item.id}>
                  {item.image && <img src={item.image} alt="" />}
                  <div>
                    <h2>{item.title}</h2>
                    <p>
                      {item.kind} · {item.package}
                    </p>
                    <strong>{money(item.unitAmount, data.currency)}</strong>
                  </div>
                  <label>
                    Quantity
                    <input
                      type="number"
                      aria-label={`Quantity for ${item.title}`}
                      min={1}
                      max={20}
                      value={item.quantity}
                      disabled={busy}
                      onChange={(e) =>
                        change({
                          action: "update",
                          itemId: item.id,
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <button
                    aria-label={`Remove ${item.title}`}
                    disabled={busy}
                    onClick={() =>
                      change({ action: "remove", itemId: item.id })
                    }
                  >
                    <Trash2 size={19} />
                  </button>
                </article>
              ))
            )}
          </div>
          <aside className="store-order-summary">
            <h2>Order summary</h2>
            {checkout &&
              data.items.map((i) => (
                <p key={i.id}>
                  {i.title} × {i.quantity}
                  <strong>{money(i.total, data.currency)}</strong>
                </p>
              ))}
            <p>
              Subtotal<strong>{money(data.subtotal, data.currency)}</strong>
            </p>
            <p>
              Discount<strong>−{money(data.discount, data.currency)}</strong>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void change({ action: "coupon", code });
              }}
            >
              <input
                placeholder="Coupon code"
                aria-label="Coupon code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button disabled={busy}>Apply</button>
            </form>
            <p className="store-total">
              Total before tax
              <strong>{money(data.total, data.currency)}</strong>
            </p>
            <small>{data.taxNote}</small>
            {!checkout && (
              <Link className="button" href="/checkout">
                Proceed to checkout
              </Link>
            )}
            <Link className="store-continue" href="/shop">
              Continue shopping
            </Link>
            <p className="store-secure">
              <Lock size={15} />
              Secure payment · Protected downloads
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
