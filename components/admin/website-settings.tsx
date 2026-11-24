"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  ExternalLink,
  Settings,
  Palette,
  MapPin,
  Mail,
  Plug,
  Shield,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import type { CmsRecord } from "@/lib/cms/store";
import { modules } from "@/lib/cms/registry";
import { FieldInput } from "./fields";
import { Skeleton } from "./ui";
import EmailSettings from "./email-settings";
import { normalizeTheme, palettes, type ThemeScope } from "@/lib/theme";
import Link from "next/link";
import { emitAdminActionSound } from "@/lib/admin-sound";
const settingsTabs = [
  { key: "themes", label: "Themes", icon: Palette, fields: [] },
  {
    key: "general",
    label: "General",
    icon: Settings,
    fields: [
      "agencyName",
      "tagline",
      "description",
      "language",
      "timezone",
      "dateFormat",
      "timeFormat",
    ],
  },
  {
    key: "branding",
    label: "Branding",
    icon: Palette,
    fields: ["logo", "darkLogo", "favicon", "sharingImage"],
  },
  {
    key: "contact",
    label: "Contact & Locations",
    icon: MapPin,
    fields: [
      "email",
      "phone",
      "address",
      "socialLinks",
      "bookingUrl",
      "ctaLabel",
      "secondaryLabel",
      "secondaryUrl",
    ],
  },
  { key: "email", label: "Email / SMTP", icon: Mail, fields: [] },
  { key: "integrations", label: "Integrations", icon: Plug, fields: [] },
  { key: "security", label: "Security", icon: Shield, fields: [] },
  { key: "advanced", label: "Advanced", icon: Code, fields: [] },
];
export default function WebsiteSettings({
  module,
  permissions,
}: {
  module: "settings" | "footer";
  permissions: string[];
}) {
  const paletteStrip = useRef<HTMLDivElement>(null);
  const [themeScope, setThemeScope] = useState<ThemeScope>("website");
  const [record, setRecord] = useState<CmsRecord | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("general"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(0),
    [actionSounds, setActionSounds] = useState(true);
  const config = modules[module],
    canWrite = permissions.includes(`${module}:write`);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/${module}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRecord(
        d.records[0] || {
          title: config.label,
          slug: config.singleton,
          status: "published",
          sortOrder: 0,
          data: {},
        },
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [module, config]);
  useEffect(() => {
    setActionSounds(localStorage.getItem("admin-action-sounds") !== "off");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (!record) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/${module}`, {
        method: record.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...record, status: "published" }),
      });
      const d = await response.json();
      if (!response.ok) throw new Error(d.error);
      setRecord(d);
      if (module === "settings")
        window.dispatchEvent(
          new CustomEvent("site-theme-updated", { detail: d.data }),
        );
      setDirty(false);
      emitAdminActionSound("saved");
      setPreview((v) => v + 1);
      toast.success("Changes saved and published");
    } catch (e) {
      toast.error("Unable to save", { description: (e as Error).message });
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
  if (!record) return <Skeleton />;
  const fields =
    module === "footer"
      ? config.fields.filter(
          (f) => !["backgroundColor", "textColor"].includes(f.key),
        )
      : config.fields.filter((f) =>
          settingsTabs.find((t) => t.key === tab)?.fields.includes(f.key),
        );
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>{config.label}</h1>
          <p>
            {module === "footer"
              ? "Manage your footer content, links, and social media."
              : "Configure your website’s general settings and integrations."}
          </p>
        </div>
        {canWrite && !(module === "settings" && tab === "email") && (
          <button className="a-button" disabled={busy || !dirty} onClick={save}>
            <Save size={16} />
            {busy ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>
      <div className={module === "settings" ? "a-settings-grid" : ""}>
        {module === "settings" && (
          <nav className="a-section-nav" aria-label="Settings sections">
            {settingsTabs.map((t) => (
              <button
                key={t.key}
                className={tab === t.key ? "active" : ""}
                onClick={() => setTab(t.key)}
              >
                <t.icon size={17} />
                {t.label}
              </button>
            ))}
          </nav>
        )}
        {module === "settings" && tab === "general" && (
          <div className="a-panel a-settings-sound-setting">
            <label className="a-check">
              <input type="checkbox" checked={actionSounds} onChange={(e) => {
                const enabled = e.target.checked;
                setActionSounds(enabled);
                localStorage.setItem("admin-action-sounds", enabled ? "on" : "off");
              }} />
              Enable notification and save/email sounds
            </label>
          </div>
        )}
        <div>
          {module === "settings" && tab === "email" ? (
            <EmailSettings />
          ) : (
            <>
              {module === "settings" && tab === "themes" && (
                <section className="a-panel theme-settings">
                  <h2>Make it your own</h2>
                  <p className="a-muted">
                    Choose independent palettes and appearance for your website
                    and admin.
                  </p>
                  <div
                    className="theme-scope-switch"
                    role="group"
                    aria-label="Theme destination"
                  >
                    {(["website", "admin"] as const).map((scope) => (
                      <button
                        type="button"
                        className="a-button secondary"
                        key={scope}
                        aria-pressed={themeScope === scope}
                        onClick={() => setThemeScope(scope)}
                      >
                        {scope === "website"
                          ? "Public website"
                          : "Admin dashboard"}
                      </button>
                    ))}
                  </div>
                  <h3>Accent color</h3>
                  <p className="a-muted">
                    Scroll left or right to explore all {Object.keys(palettes).length} palettes.
                  </p>
                  <div className="theme-scroll-controls">
                    <button
                      type="button"
                      className="a-icon-button"
                      aria-label="Previous theme colors"
                      onClick={() =>
                        paletteStrip.current?.scrollBy({
                          left: -420,
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                        })
                      }
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className="a-icon-button"
                      aria-label="More theme colors"
                      onClick={() =>
                        paletteStrip.current?.scrollBy({
                          left: 420,
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                        })
                      }
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div
                    ref={paletteStrip}
                    className="theme-palette-grid"
                    aria-label="Theme colors"
                  >
                    {Object.entries(palettes).map(([key, p]) => (
                      <button
                        type="button"
                        key={key}
                        disabled={!canWrite}
                        aria-pressed={
                          normalizeTheme(record.data, themeScope)
                            .themeAccent === key
                        }
                        onClick={() => {
                          setRecord({
                            ...record,
                            data: {
                              ...record.data,
                              [`${themeScope}ThemeAccent`]: key,
                            },
                          });
                          setDirty(true);
                        }}
                        className="theme-swatch"
                      >
                        <span style={{ background: p.color }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <h3>Appearance</h3>
                  <div className="theme-mode-grid">
                    {["light", "dark", "system"].map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        disabled={!canWrite}
                        aria-pressed={
                          normalizeTheme(record.data, themeScope).themeMode ===
                          mode
                        }
                        className="theme-mode"
                        onClick={() => {
                          setRecord({
                            ...record,
                            data: {
                              ...record.data,
                              [`${themeScope}ThemeMode`]: mode,
                            },
                          });
                          setDirty(true);
                        }}
                      >
                        <span className={`theme-mode-preview ${mode}`}>
                          <i />
                          <i />
                        </span>
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="a-muted">
                    System follows the device’s appearance. Save to apply this
                    theme only to the selected destination.
                  </p>
                </section>
              )}
              {fields.length > 0 && (
                <div
                  className={`a-settings-cards ${module === "footer" ? "footer-editor" : ""}`}
                >
                  {fields.map((f) => (
                    <div
                      className={
                        f.type === "list" || f.type === "image"
                          ? "a-panel"
                          : "a-setting-field"
                      }
                      key={f.key}
                    >
                      <FieldInput
                        field={f}
                        value={record.data[f.key]}
                        onChange={(v) => {
                          setRecord({
                            ...record,
                            data: { ...record.data, [f.key]: v },
                          });
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {tab === "contact" && module === "settings" && (
                <Link className="a-button secondary" href="/admin/locations">
                  Manage office locations
                </Link>
              )}
              {tab === "integrations" && module === "settings" && (
                <div className="a-panel">
                  <h2>Connected services</h2>
                  <p>
                    Maps: OpenStreetMap via Leaflet, with attribution. No
                    private API key is exposed.
                  </p>
                  <p>
                    Visitor analytics is not configured. Dashboard charts use
                    stored inquiries and bookings.
                  </p>
                  <button
                    className="a-button secondary"
                    onClick={() => setTab("email")}
                  >
                    Configure email provider
                  </button>
                </div>
              )}
              {tab === "security" && module === "settings" && (
                <div className="a-panel">
                  <h2>Account & session security</h2>
                  <p>
                    Database-backed sessions, server-side permissions, login
                    rate limiting, Argon2id and optional TOTP are enabled.
                  </p>
                  <Link className="a-button" href="/admin/security">
                    Manage MFA and active sessions
                  </Link>
                </div>
              )}
              {tab === "advanced" && module === "settings" && (
                <div className="a-panel">
                  <h2>System information</h2>
                  <p>Next.js App Router · MySQL 8 compatible · Prisma ORM</p>
                  <p>
                    Public content is rendered dynamically from published
                    database records. Saves invalidate the public layout.
                  </p>
                  <div className="a-button-row">
                    <a
                      className="a-button secondary"
                      href="/sitemap.xml"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View current sitemap
                    </a>
                    <a
                      className="a-button secondary"
                      href="/robots.txt"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View robots.txt
                    </a>
                  </div>
                  <p>
                    Durable email queue processing is configured by the server
                    operator. Inspect queued and failed jobs in Email → Logs.
                  </p>
                </div>
              )}
            </>
          )}
          {module === "footer" && (
            <div className="a-panel">
              <h2>Live public footer preview</h2>
              <p className="a-muted">
                Footer colors follow the public website palette in Site Settings
                → Themes.
              </p>
              <p className="a-muted">
                This renders the actual published footer. Save changes to update
                it.
              </p>
              <iframe
                key={preview}
                title="Public footer preview"
                src="/?footerPreview=1"
                className="a-footer-preview"
              />
              <a
                className="a-button secondary"
                href="/#site-footer"
                target="_blank"
                rel="noreferrer"
              >
                Open website <ExternalLink size={15} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
