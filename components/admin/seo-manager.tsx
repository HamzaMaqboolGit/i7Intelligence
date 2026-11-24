"use client";
import { useCallback, useEffect, useState } from "react";
import { Save, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import type { CmsRecord } from "@/lib/cms/store";
import { modules } from "@/lib/cms/registry";
import { FieldInput } from "./fields";
import { Skeleton, Empty } from "./ui";
export default function SeoManager({ permissions }: { permissions: string[] }) {
  const [tab, setTab] = useState("pages"),
    [rows, setRows] = useState<CmsRecord[] | null>(null),
    [selected, setSelected] = useState<CmsRecord | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/${tab}?size=50`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRows(d.records);
      setSelected(d.records[0] || null);
      setDirty(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tab]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/${tab}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSelected(d);
      setRows(rows?.map((row) => (row.id === d.id ? d : row)) || []);
      setDirty(false);
      toast.success("SEO metadata saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const d = selected?.data || {};
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>SEO Manager</h1>
          <p>Optimize your website for search engines.</p>
        </div>
        {permissions.includes(`${tab}:write`) && (
          <button disabled={busy || !dirty} className="a-button" onClick={save}>
            <Save size={16} />
            Save changes
          </button>
        )}
      </div>
      <div className="a-tabs">
        {[
          ["pages", "Pages"],
          ["blog", "Posts"],
          ["portfolio", "Portfolio"],
          ["seo", "Defaults"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved SEO changes?"))
                return;
              setTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div className="a-error">
          {error}
          <button onClick={load}>Retry</button>
        </div>
      )}
      {!rows ? (
        <Skeleton />
      ) : (
        <div className="a-seo-grid">
          <nav className="a-section-nav">
            {rows.map((r) => (
              <button
                key={r.id}
                className={selected?.id === r.id ? "active" : ""}
                onClick={() => {
                  if (dirty && !window.confirm("Discard unsaved changes?"))
                    return;
                  setSelected(r);
                  setDirty(false);
                }}
              >
                <FileText size={17} />
                <span>
                  {r.title}
                  <small style={{ display: "block" }}>
                    /{r.slug === "home" ? "" : r.slug}
                  </small>
                </span>
              </button>
            ))}
          </nav>
          {selected ? (
            <>
              <div className="a-panel">
                <h2>{selected.title} — SEO settings</h2>
                {modules.seo.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={d[field.key]}
                    onChange={(v) => {
                      setSelected({
                        ...selected,
                        data: { ...d, [field.key]: v },
                      });
                      setDirty(true);
                    }}
                  />
                ))}
              </div>
              <aside className="a-panel">
                <h3>Search engine preview</h3>
                <div className="a-search-preview">
                  <small>
                    {d.canonical ||
                      `your-domain.com/${selected.slug === "home" ? "" : selected.slug}`}
                  </small>
                  <h3>{d.seoTitle || selected.title}</h3>
                  <p>{d.seoDescription || selected.description}</p>
                </div>
                <h3>Social preview</h3>
                <div className="a-social-preview">
                  {d.ogImage ? (
                    <img src={d.ogImage} alt="Social preview" />
                  ) : (
                    <div>
                      <Search size={28} />
                    </div>
                  )}
                  <strong>{d.ogTitle || d.seoTitle || selected.title}</strong>
                  <p>
                    {d.ogDescription ||
                      d.seoDescription ||
                      selected.description}
                  </p>
                </div>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="a-button secondary"
                >
                  View sitemap
                </a>
              </aside>
            </>
          ) : (
            <Empty
              title="No pages available"
              description="Create content before editing its SEO metadata."
            />
          )}
        </div>
      )}
    </div>
  );
}
