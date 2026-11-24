"use client";
import DateStamp from "../../controls/date-stamp";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectInput, Skeleton, Badge, Confirm } from "../ui";
import { money } from "../../store/storefront";
/* eslint-disable @typescript-eslint/no-explicit-any -- Authorized order response includes private nested snapshots. */
export default function OrderDetail({
  id,
  canWrite,
}: {
  id: string;
  canWrite: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revoking, setRevoking] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/store/order?id=${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(body: object) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/store/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Order updated");
      await load();
      setRevoking("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="a-error">
        {error}
        <button onClick={load}>Retry</button>
      </div>
    );
  if (!data) return <Skeleton />;
  const o = data.order;
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Order {o.reference}</h1>
          <p>
            {<DateStamp value={o.createdAt} />} · {o.customer.name}
          </p>
        </div>
        {canWrite && o.paymentStatus === "paid" && (
          <button
            className="a-button"
            disabled={busy}
            onClick={() =>
              action({ action: "resend", requestId: crypto.randomUUID() })
            }
          >
            Queue order email
          </button>
        )}
      </div>
      <div className="a-product-editor-grid">
        <div>
          <section className="a-panel">
            <h2>Purchased products & services</h2>
            {o.items.map((i: any) => (
              <article className="a-order-item" key={i.id}>
                <h3>{i.title}</h3>
                <p>
                  {i.kind} · {i.package} · {i.quantity} ×{" "}
                  {money(i.unitAmount, o.currency)}
                </p>
                {i.kind === "service" && (
                  <>
                    <Badge status={i.serviceStatus} />
                    <h4>Customer requirements</h4>
                    <p className="a-message-text">
                      {i.requirements || "Not submitted yet."}
                    </p>
                    {canWrite && (
                      <SelectInput
                        label={`Service status for ${i.title}`}
                        value={i.serviceStatus}
                        onChange={(status) =>
                          action({
                            action: "service-status",
                            itemId: i.id,
                            status,
                          })
                        }
                        options={[
                          "pending",
                          "awaiting-requirements",
                          "in-progress",
                          "awaiting-review",
                          "completed",
                          "cancelled",
                        ].map((value) => ({
                          value,
                          label: value.replaceAll("-", " "),
                        }))}
                      />
                    )}
                  </>
                )}
                {i.entitlements.map((e: any) => (
                  <div className="a-private-file" key={e.id}>
                    <div>
                      <strong>{e.file.name}</strong>
                      <small>
                        v{e.file.version} · {e.used}/{e.maximum} downloads ·
                        Expires {<DateStamp value={e.expiresAt} />}
                      </small>
                      <Badge status={e.revokedAt ? "revoked" : "active"} />
                    </div>
                    {canWrite && !e.revokedAt && (
                      <button
                        className="a-button secondary"
                        onClick={() => setRevoking(e.id)}
                      >
                        Revoke access
                      </button>
                    )}
                  </div>
                ))}
                {canWrite && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action({
                        action: "note",
                        itemId: i.id,
                        body: new FormData(e.currentTarget).get("note"),
                      });
                    }}
                  >
                    <label className="a-field">
                      Internal notes
                      <textarea name="note" defaultValue={i.notes || ""} />
                    </label>
                    <button className="a-button secondary" disabled={busy}>
                      Save internal note
                    </button>
                  </form>
                )}
              </article>
            ))}
          </section>
          <section className="a-panel">
            <h2>Order timeline</h2>
            {o.events.map((e: any) => (
              <p className="a-muted" key={e.id}>
                {<DateStamp value={e.createdAt} />} · {e.description}
              </p>
            ))}
          </section>
        </div>
        <aside>
          <section className="a-panel">
            <h2>Customer</h2>
            <strong>{o.customer.name}</strong>
            <p>{o.customer.email}</p>
            <p>{o.customer.phone}</p>
            <p>{o.customer.country}</p>
            <h3>Billing information</h3>
            <pre className="a-order-billing">
              {JSON.stringify(o.billing, null, 2)}
            </pre>
          </section>
          <section className="a-panel">
            <h2>Payment summary</h2>
            <Badge status={o.paymentStatus} />
            <p>Subtotal: {money(o.subtotal, o.currency)}</p>
            <p>Discount: {money(o.discount, o.currency)}</p>
            <p>Tax: {money(o.tax, o.currency)}</p>
            <strong>Total: {money(o.total, o.currency)}</strong>
            <p className="a-muted">
              Stripe payment: {o.stripePaymentId || "Not confirmed"}
            </p>
          </section>
          <section className="a-panel">
            <h2>Email delivery</h2>
            {data.emails.map((e: any) => (
              <div className="a-private-file" key={e.id}>
                <div>
                  <strong>{e.subject}</strong>
                  <small>{e.recipient}</small>
                  <Badge status={e.status} />
                  <p>{e.lastError}</p>
                </div>
              </div>
            ))}
            {!data.emails.length && (
              <p className="a-muted">
                No order emails queued. SMTP acceptance does not confirm inbox
                delivery.
              </p>
            )}
          </section>
        </aside>
      </div>
      <Confirm
        open={!!revoking}
        onClose={() => setRevoking("")}
        title="Revoke download access?"
        description="The customer will no longer be able to use this entitlement."
        busy={busy}
        onConfirm={() => action({ action: "revoke", entitlementId: revoking })}
      />
    </div>
  );
}
