"use client";
import PaymentSettings from "./payment-settings";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { modules } from "@/lib/cms/registry";
import type { CmsRecord } from "@/lib/cms/store";
import { FieldInput } from "../fields";
import { Skeleton } from "../ui";
const tabs: { title: string; keys: string[] }[] = [
  {
    title: "General",
    keys: [
      "storeName",
      "email",
      "description",
      "currency",
      "currencies",
      "orderPrefix",
    ],
  },
  { title: "Payments", keys: [] },
  { title: "Checkout", keys: ["termsUrl", "privacyUrl"] },
  {
    title: "Digital Delivery",
    keys: ["downloadDays", "downloadLimit", "emailDelivery"],
  },
  { title: "Services", keys: ["serviceInstructions"] },
  { title: "Taxes", keys: [] },
  { title: "Emails", keys: [] },
  { title: "Security", keys: [] },
];
export default function StoreSettings({ canWrite }: { canWrite: boolean }) {
  const [record, setRecord] = useState<Partial<CmsRecord> | null>(null),
    [tab, setTab] = useState("General"),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/store-settings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRecord(
          d.records[0] || {
            title: "Store settings",
            slug: "store",
            status: "published",
            sortOrder: 0,
            data: {
              currency: "usd",
              orderPrefix: "ORD",
              downloadDays: 30,
              downloadLimit: 5,
              emailDelivery: true,
            },
          },
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="a-error">{error}</div>;
  if (!record) return <Skeleton />;
  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/store-settings", {
        method: record?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRecord(d);
      setDirty(false);
      toast.success("Store settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Store Settings</h1>
          <p>Manage your digital storefront and delivery defaults.</p>
        </div>
        {canWrite && (
          <button disabled={busy || !dirty} className="a-button" onClick={save}>
            Save changes
          </button>
        )}
      </div>
      <div className="a-settings-grid">
        <nav className="a-section-nav">
          {tabs.map((t) => (
            <button
              key={t.title}
              className={tab === t.title ? "active" : ""}
              onClick={() => setTab(t.title)}
            >
              {t.title}
            </button>
          ))}
        </nav>
        <section className="a-panel" key={tab}>
          <h2>{tab}</h2>
          {modules["store-settings"].fields
            .filter((f) =>
              tabs.find((t) => t.title === tab)?.keys.includes(f.key),
            )
            .map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={record.data?.[field.key]}
                onChange={(v) => {
                  setRecord({
                    ...record,
                    data: { ...record.data, [field.key]: v },
                  });
                  setDirty(true);
                }}
              />
            ))}
          {(tab === "Payments" || tab === "Taxes") && (
            <PaymentSettings key={tab} tab={tab} canWrite={canWrite} />
          )}
          {tab === "Checkout" && (
            <p className="a-muted">
              Guest carts use secure HttpOnly cookies and server-side product
              prices. Customer account enrollment and verified-email sign-in are
              not configured yet.
            </p>
          )}
          {tab === "Digital Delivery" && (
            <p className="a-muted">
              These are saved defaults for new fulfillment. Existing
              entitlements retain their own limits. Automatic entitlement
              creation still depends on the verified-payment integration.
            </p>
          )}
          {tab === "Services" && (
            <p className="a-muted">
              Custom services use manual fulfillment. Paid service orders
              support project requirements, internal notes and validated status
              transitions.
            </p>
          )}
          {tab === "Emails" && (
            <>
              <p className="a-muted">
                Order, payment, digital delivery, service, deliverables and
                refund templates use the shared encrypted SMTP configuration and
                database outbox.
              </p>
              <Link className="a-button" href="/admin/settings">
                Edit SMTP & email templates
              </Link>
            </>
          )}
          {tab === "Security" && (
            <>
              <p className="a-muted">
                Private files live outside public media. Every download checks
                paid order state, expiration, revocation and remaining access
                count. Webhook/payment verification is not yet installed; no
                checkout is currently accepted.
              </p>
              <Link className="a-button secondary" href="/admin/security">
                Administrator session security
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
