"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, ShieldCheck, Save } from "lucide-react";
import { SelectInput, Skeleton } from "../ui";
import CountrySelect from "../../controls/country-select";
type Config = {
  mode: string;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  taxMode: string;
  taxBehavior: string;
  taxRateBps: number;
  taxLabel: string;
  taxRegistration: string;
  taxCountry: string;
};
export default function PaymentSettings({
  tab,
  canWrite,
}: {
  tab: "Payments" | "Taxes";
  canWrite: boolean;
}) {
  const [config, setConfig] = useState<Config | null>(null),
    [flags, setFlags] = useState({
      secretConfigured: false,
      webhookConfigured: false,
      webhookUrl: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/store/payment-settings");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConfig({ ...d.config, secretKey: "", webhookSecret: "" });
      setFlags(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <p role="alert" className="a-error">
        {error}
      </p>
    );
  if (!config) return <Skeleton />;
  return (
    <form
      className="payment-settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch("/api/admin/store/payment-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          toast.success(`${tab} configuration saved`, {
            description:
              "Configuration saved. Checkout also requires the server enable flag and a configured Stripe webhook.",
          });
          await load();
        } catch (e) {
          toast.error("Unable to save configuration", {
            description: (e as Error).message,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {tab === "Payments" ? (
        <>
          <div className="a-inline-notice">
            <ShieldCheck size={19} /> Server-side encryption protects saved
            secret keys. They are never returned to this form.
          </div>
          <label className="a-field">
            Environment
            <SelectInput
              label="Stripe environment"
              value={config.mode}
              onChange={(mode) => setConfig({ ...config, mode })}
              options={[
                { value: "test", label: "Test / sandbox" },
                { value: "live", label: "Live" },
              ]}
            />
          </label>
          <label className="a-field">
            Publishable key
            <input
              autoComplete="off"
              value={config.publishableKey}
              onChange={(e) =>
                setConfig({ ...config, publishableKey: e.target.value })
              }
              placeholder={`pk_${config.mode}_…`}
            />
          </label>
          <label className="a-field">
            Restricted / secret key
            <input
              type="password"
              autoComplete="new-password"
              value={config.secretKey}
              placeholder={
                flags.secretConfigured
                  ? "Saved securely · leave blank to retain"
                  : `rk_${config.mode}_…`
              }
              onChange={(e) =>
                setConfig({ ...config, secretKey: e.target.value })
              }
            />
          </label>
          <label className="a-field">
            Webhook signing secret
            <input
              type="password"
              autoComplete="new-password"
              value={config.webhookSecret}
              placeholder={
                flags.webhookConfigured
                  ? "Saved securely · leave blank to retain"
                  : "whsec_…"
              }
              onChange={(e) =>
                setConfig({ ...config, webhookSecret: e.target.value })
              }
            />
          </label>
          <p className="a-muted">
            <Lock size={15} />
            Saving credentials does not activate charges or register a webhook.
            Configure the signed webhook at the URL above, verify a sandbox
            purchase, and set STORE_CHECKOUT_ENABLED=true on the server to
            enable checkout. Matching test/live keys are required.
          </p>
        </>
      ) : (
        <>
          <label className="a-field">
            Tax calculation mode
            <SelectInput
              label="Tax calculation mode"
              value={config.taxMode}
              onChange={(taxMode) => setConfig({ ...config, taxMode })}
              options={[
                { value: "none", label: "No tax configured" },
                { value: "manual", label: "Manual rate — configuration only" },
                {
                  value: "stripe",
                  label: "Stripe Tax — requires verified registration",
                },
              ]}
            />
          </label>
          <label className="a-field">
            Tax label
            <input
              value={config.taxLabel}
              onChange={(e) =>
                setConfig({ ...config, taxLabel: e.target.value })
              }
              placeholder="Tax / VAT / GST"
            />
          </label>
          <label className="a-field">
            Price display
            <SelectInput
              label="Tax price behavior"
              value={config.taxBehavior}
              onChange={(taxBehavior) => setConfig({ ...config, taxBehavior })}
              options={[
                { value: "exclusive", label: "Prices exclude tax" },
                { value: "inclusive", label: "Prices include tax" },
              ]}
            />
          </label>
          {config.taxMode === "manual" && (
            <label className="a-field">
              Tax rate (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={config.taxRateBps / 100}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    taxRateBps: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
          )}
          <div className="a-field">
            <span>Registration country</span>
            <CountrySelect
              name="taxCountry"
              value={config.taxCountry}
              onChange={(taxCountry) => setConfig({ ...config, taxCountry })}
            />
          </div>
          <label className="a-field">
            Registration reference
            <input
              value={config.taxRegistration}
              onChange={(e) =>
                setConfig({ ...config, taxRegistration: e.target.value })
              }
            />
          </label>
          <p className="a-inline-notice">
            Saved tax settings are not active checkout calculations. Stripe Tax
            requires verified merchant registrations. No tax is collected while
            payment processing is disabled.
          </p>
        </>
      )}
      {canWrite && (
        <button className="a-button" disabled={busy}>
          <Save size={16} />
          {busy ? "Saving…" : `Save ${tab.toLowerCase()} settings`}
        </button>
      )}
    </form>
  );
}
