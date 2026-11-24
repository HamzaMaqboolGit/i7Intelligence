"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Lock } from "lucide-react";
import { money } from "./storefront";
import { Badge } from "../admin/ui";
/* eslint-disable @typescript-eslint/no-explicit-any -- Private order responses are scoped server-side to the current cart or access cookie. */
export default function Orders({ reference }: { reference?: string }) {
  const [orders, setOrders] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/store/order${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setOrders(d.orders);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [reference]);
  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(location.hash.slice(1));
      const token = params.get("token");
      if (token) {
        const r = await fetch("/api/store/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "authorize", token }),
        });
        history.replaceState(null, "", location.pathname);
        if (!r.ok) {
          setError("The secure order access link is invalid.");
          setLoaded(true);
          return;
        }
      }
      await load();
    }
    void init();
  }, [load]);
  async function download(id: string, name: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/store/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: id }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error);
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await load();
    } catch (e) {
      toast.error("Download unavailable", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="container store-cart">
      <span className="eyebrow">PRIVATE CUSTOMER ACCESS</span>
      <h1>{reference ? "Your order" : "Your digital downloads"}</h1>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <div className="a-skeleton" />
      ) : !orders.length ? (
        <div className="store-empty">
          <Lock size={40} />
          <h2>Secure order access is required.</h2>
          <p>
            Open the private link from your order email or return from the
            browser used during checkout. Order references alone do not grant
            access.
          </p>
          <Link className="button" href="/shop">
            Browse the store
          </Link>
        </div>
      ) : (
        orders.map((order) => (
          <section className="store-order-card" key={order.id}>
            <header>
              <h2>{order.reference}</h2>
              <Badge status={order.paymentStatus} />
              <strong>{money(order.total, order.currency)}</strong>
            </header>
            {order.items.map((item: any) => (
              <article key={item.id}>
                <h3>{item.title}</h3>
                <p>
                  {item.kind} · {item.quantity} ×{" "}
                  {money(item.unitAmount, order.currency)}
                </p>
                {order.paymentStatus === "paid" &&
                  item.entitlements.map((d: any) => (
                    <div className="store-download-row" key={d.id}>
                      <div>
                        <strong>{d.file.name}</strong>
                        <small>
                          Version {d.file.version} · {d.used}/{d.maximum}{" "}
                          downloads · Expires{" "}
                          {new Date(d.expiresAt).toLocaleDateString()}
                        </small>
                      </div>
                      <button
                        className="button secondary"
                        disabled={
                          busy ||
                          !!d.revokedAt ||
                          new Date(d.expiresAt) < new Date() ||
                          d.used >= d.maximum
                        }
                        onClick={() => download(d.id, d.file.name)}
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </div>
                  ))}
                {item.kind === "service" && (
                  <>
                    <Badge status={item.serviceStatus} />
                    {order.paymentStatus === "paid" && (
                      <form
                        className="contact-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setBusy(true);
                          try {
                            const r = await fetch("/api/store/order", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "requirements",
                                itemId: item.id,
                                body: new FormData(e.currentTarget).get(
                                  "requirements",
                                ),
                              }),
                            });
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.error);
                            toast.success("Project requirements saved");
                            await load();
                          } catch (e) {
                            toast.error((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <label>
                          Project requirements
                          <textarea
                            name="requirements"
                            required
                            minLength={10}
                            maxLength={10000}
                            defaultValue={item.requirements || ""}
                          />
                        </label>
                        <button className="button" disabled={busy}>
                          Submit requirements
                        </button>
                      </form>
                    )}
                  </>
                )}
              </article>
            ))}
            <details>
              <summary>Order timeline</summary>
              {order.events.map((e: any, i: number) => (
                <p key={i}>
                  {new Date(e.createdAt).toLocaleString()} · {e.description}
                </p>
              ))}
            </details>
          </section>
        ))
      )}
    </main>
  );
}
