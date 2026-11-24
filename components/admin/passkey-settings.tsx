"use client";
import { useEffect, useState, useCallback } from "react";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Confirm } from "./ui";
type Key = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
};
export default function PasskeySettings() {
  const [keys, setKeys] = useState<Key[]>([]),
    [supported, setSupported] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("My device"),
    [remove, setRemove] = useState<Key | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await authClient.passkey.listUserPasskeys();
    if (r.error) setError(r.error.message || "Unable to load passkeys");
    else {
      setKeys(r.data || []);
      setError("");
    }
  }, []);
  useEffect(() => {
    // WebAuthn validates the exact origin. Chromium treats localhost as a
    // secure context, but a 127.0.0.1 origin is still rejected by many
    // authenticators unless the app is served over HTTPS with a real domain.
    const localHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    setSupported(
      window.isSecureContext && !!window.PublicKeyCredential && !localHost,
    );
    void load();
  }, [load]);
  return (
    <section className="a-panel" style={{ marginTop: 24 }}>
      <header>
        <h2>Fingerprint & passkeys</h2>
        <Fingerprint size={22} />
      </header>
      <p>
        Sign in using Touch ID, fingerprint, Face ID or your device PIN. Your
        device keeps your biometric data private.
      </p>
      {supported === false && (
        <p role="status" className="a-inline-notice">
          Passkeys need a supported browser and an HTTPS domain. They are
          disabled on this local preview because browsers reject its origin;
          they will be available after deploying with HTTPS.
        </p>
      )}
      {error && (
        <p role="alert" className="a-error">
          {error}
          <button className="a-button secondary small" onClick={load}>
            Retry
          </button>
        </p>
      )}
      <div className="a-button-row" style={{ marginTop: 20 }}>
        <label className="a-field">
          Device name
          <input
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="a-button"
          type="button"
          disabled={busy || !supported || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await authClient.passkey.addPasskey({
                name: name.trim(),
                authenticatorAttachment: "platform",
              });
              if (r.error)
                throw Error(r.error.message || "Passkey setup was cancelled");
              toast.success("Passkey added");
              await load();
            } catch (e) {
              toast.error("Unable to add passkey", {
                description:
                  (e as Error).message +
                  " You may need to sign in again with your password before setup.",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Plus size={16} />
          {busy ? "Waiting for device…" : "Add fingerprint / passkey"}
        </button>
      </div>
      {!keys.length && !error && (
        <p className="a-muted" style={{ marginTop: 20 }}>
          No passkeys registered yet. Add this device to enable fingerprint
          login.
        </p>
      )}
      {keys.map((key) => (
        <div className="a-session" key={key.id}>
          <Fingerprint size={22} />
          <div>
            <strong>{key.name || "Passkey"}</strong>
            <p>
              {key.createdAt
                ? `Added ${new Date(key.createdAt).toLocaleDateString()}`
                : "Registered device"}
            </p>
          </div>
          <button
            className="a-button secondary small"
            aria-label={`Remove ${key.name || "passkey"}`}
            onClick={() => setRemove(key)}
          >
            <Trash2 size={15} />
            Remove
          </button>
        </div>
      ))}
      <p className="a-muted" style={{ marginTop: 16 }}>
        Keep your password as a recovery option. Your device chooses the
        available biometric or PIN verification.
      </p>
      <Confirm
        open={!!remove}
        title="Remove this passkey?"
        description="This device will no longer sign in with this passkey. You can still use your password or another registered passkey."
        confirmLabel="Remove passkey"
        busy={busy}
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove) return;
          setBusy(true);
          try {
            const r = await authClient.passkey.deletePasskey({ id: remove.id });
            if (r.error) throw Error(r.error.message);
            setRemove(null);
            await load();
            toast.success("Passkey removed");
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
