"use client";
import DateStamp from "../controls/date-stamp";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Send, Save, ShieldCheck } from "lucide-react";
import { SelectInput, Skeleton, Badge } from "./ui";
import RichEditor from "./editor";
type Config = {
  host: string;
  port: number;
  encryption: string;
  username: string;
  password: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  adminEmail: string;
  provider: string;
  enabled: boolean;
};
type Template = { key: string; subject: string; body: string };
type Log = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string;
  createdAt: string;
};
const initial: Config = {
  host: "",
  port: 587,
  encryption: "tls",
  username: "",
  password: "",
  senderName: "",
  senderEmail: "",
  replyTo: "",
  adminEmail: "",
  provider: "SMTP",
  enabled: false,
};
export default function EmailSettings() {
  const [emailMode, setEmailMode] = useState("html");
  const [config, setConfig] = useState<Config>(initial),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("configuration"),
    [templates, setTemplates] = useState<Template[]>([]),
    [active, setActive] = useState("contact_ack"),
    [logs, setLogs] = useState<Log[]>([]),
    [passwordConfigured, setPasswordConfigured] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/email");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfig({ ...initial, ...data.config, password: "" });
      setTemplates(data.templates);
      setLogs(data.logs);
      setPasswordConfigured(data.passwordConfigured);
      setLoaded(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(body: object, message: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(message, { description: data.message });
      await load();
    } catch (e) {
      toast.error("Email action failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="a-error" role="alert">
        {error}
        <button onClick={load}>Retry</button>
      </div>
    );
  if (!loaded) return <Skeleton />;
  const template = templates.find((t) => t.key === active);
  return (
    <div className="a-email-settings">
      <div className="a-tabs">
        {["configuration", "templates", "logs"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "configuration" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action({ action: "save", config }, "SMTP configuration saved");
          }}
        >
          <div className="a-panel">
            <h2>
              <Mail size={20} /> Email configuration
            </h2>
            <p className="a-muted">
              Credentials are encrypted on the server. Saved passwords are never
              returned to your browser.
            </p>
            <div className="a-form-grid">
              {(
                [
                  ["host", "SMTP host"],
                  ["port", "SMTP port"],
                  ["username", "SMTP username"],
                  ["password", "SMTP password"],
                  ["senderName", "Sender name"],
                  ["senderEmail", "Sender email"],
                  ["replyTo", "Reply-to email"],
                  ["adminEmail", "Administrator notification email"],
                  ["provider", "Email provider"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type={
                      key === "password"
                        ? "password"
                        : key === "port"
                          ? "number"
                          : key.toLowerCase().includes("email")
                            ? "email"
                            : "text"
                    }
                    value={config[key]}
                    autoComplete={key === "password" ? "new-password" : "off"}
                    placeholder={
                      key === "password" && passwordConfigured
                        ? "Saved securely · leave blank to keep"
                        : ""
                    }
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]:
                          key === "port"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Encryption
                <SelectInput
                  label="SMTP encryption"
                  value={config.encryption}
                  onChange={(v) => setConfig({ ...config, encryption: v })}
                  options={[
                    { value: "tls", label: "STARTTLS" },
                    { value: "ssl", label: "SSL / TLS" },
                    { value: "none", label: "None" },
                  ]}
                />
              </label>
            </div>
            <label className="a-check">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
              />
              Enable outgoing email
            </label>
            <div className="a-button-row">
              <button disabled={busy} className="a-button">
                <Save size={16} />
                Save configuration
              </button>
              <button
                disabled={busy}
                type="button"
                className="a-button secondary"
                onClick={() =>
                  action({ action: "verify" }, "SMTP connection verified")
                }
              >
                <ShieldCheck size={16} />
                Test connection
              </button>
              <button
                disabled={busy}
                type="button"
                className="a-button secondary"
                onClick={() =>
                  action({ action: "test" }, "Test accepted by SMTP")
                }
              >
                <Send size={16} />
                Send test to my email
              </button>
            </div>
          </div>
          <p className="a-muted">
            The server operator must set SMTP_ALLOWED_HOSTS to permit this
            provider. Incoming email synchronization is not configured. SMTP
            supports outgoing replies only.
          </p>
        </form>
      )}
      {tab === "templates" && template && (
        <div className="a-settings-grid">
          <nav className="a-section-nav">
            {templates.map((t) => (
              <button
                key={t.key}
                className={active === t.key ? "active" : ""}
                onClick={() => setActive(t.key)}
              >
                {t.key.replaceAll("_", " ")}
              </button>
            ))}
          </nav>
          <div className="a-panel">
            <h2>Email template</h2>
            <label>
              Subject
              <input
                value={template.subject}
                onChange={(e) =>
                  setTemplates(
                    templates.map((t) =>
                      t.key === active ? { ...t, subject: e.target.value } : t,
                    ),
                  )
                }
              />
            </label>
            <div className="a-button-row" style={{ margin: "16px 0" }}>
              <button
                type="button"
                className="a-button secondary"
                onClick={() => {
                  setTemplates((v) =>
                    v.map((t) =>
                      t.key === active
                        ? {
                            ...t,
                            body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f4f9"><tr><td style="padding:24px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff"><tr><td style="padding:24px;background-color:#132d58;color:#ffffff;font-family:Arial,sans-serif;font-size:24px;font-weight:bold">{{company_name}}</td></tr><tr><td style="padding:24px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#182235">${t.body}</td></tr></table></td></tr></table>`,
                          }
                        : t,
                    ),
                  );
                  setEmailMode("html");
                }}
              >
                Wrap in branded layout
              </button>
              {["visual", "html", "preview"].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  className={`a-button ${emailMode === mode ? "" : "secondary"}`}
                  aria-pressed={emailMode === mode}
                  disabled={
                    mode === "visual" && /<(table|td|tr)\b/i.test(template.body)
                  }
                  onClick={() => setEmailMode(mode)}
                >
                  {mode === "html"
                    ? "HTML source"
                    : mode === "preview"
                      ? "Email preview"
                      : "Visual editor"}
                </button>
              ))}
            </div>
            {emailMode === "html" ? (
              <label className="a-field">
                <span>HTML email body</span>
                <textarea
                  className="a-email-source"
                  spellCheck={false}
                  value={template.body}
                  onChange={(e) =>
                    setTemplates((v) =>
                      v.map((t) =>
                        t.key === active ? { ...t, body: e.target.value } : t,
                      ),
                    )
                  }
                />
              </label>
            ) : emailMode === "preview" ? (
              <iframe
                title="Email template preview"
                className="a-email-preview"
                sandbox=""
                srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"><style>body{font-family:Arial,sans-serif;padding:24px;color:#182235;line-height:1.6}table{max-width:100%}a{color:#245bb4}</style>${template.body}`}
              />
            ) : (
              <RichEditor
                key={active}
                value={template.body}
                onChange={(body) =>
                  setTemplates((v) =>
                    v.map((t) => (t.key === active ? { ...t, body } : t)),
                  )
                }
              />
            )}
            <p className="a-muted">
              Use HTML source for table layouts, branded headings, links and
              inline styles. Preview is isolated; external images are blocked in
              preview. Saving removes unsafe HTML.
            </p>
            <p className="a-muted">
              Variables:{" "}
              {
                "{{customer_name}} · {{inquiry_reference}} · {{company_name}} · {{message_subject}} · {{booking_date}} · {{order_reference}} · {{secure_download_link}}"
              }
            </p>
            <button
              disabled={busy}
              className="a-button"
              onClick={() =>
                action({ action: "template", ...template }, "Template saved")
              }
            >
              Save template
            </button>
          </div>
        </div>
      )}
      {tab === "logs" && (
        <div className="a-panel a-table-wrap">
          <h2>Email delivery log</h2>
          <p className="a-muted">
            Accepted means the SMTP server accepted the message. It does not
            confirm inbox delivery. Uncertain attempts require provider
            reconciliation and cannot be retried here.
          </p>
          <table className="a-table">
            <thead>
              <tr>
                <th>Recipient / subject</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.recipient}</strong>
                    <p>{log.subject}</p>
                    {log.lastError && <small>{log.lastError}</small>}
                  </td>
                  <td>
                    <Badge status={log.status} />
                  </td>
                  <td>{log.attempts}</td>
                  <td>{<DateStamp value={log.createdAt} />}</td>
                  <td>
                    {["pending", "failed"].includes(log.status) &&
                      log.attempts < 5 && (
                        <button
                          disabled={busy}
                          className="a-button secondary"
                          onClick={() =>
                            action(
                              { action: "retry", id: log.id },
                              "Email accepted by SMTP",
                            )
                          }
                        >
                          Send / retry
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length && (
            <p className="a-empty">No emails have been queued.</p>
          )}
        </div>
      )}
    </div>
  );
}
