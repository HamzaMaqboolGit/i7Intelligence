"use client";
import DateStamp from "../controls/date-stamp";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Search,
  Grid2X2,
  List,
  Download,
  Pencil,
  Trash2,
  Eye,
  Layers,
  FileText,
  Archive,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  ExternalLink,
  Save,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { modules, slugify } from "@/lib/cms/registry";
import type { CmsRecord } from "@/lib/cms/store";
import {
  SelectInput,
  Metric,
  Drawer,
  Confirm,
  Badge,
  Empty,
  Skeleton,
} from "./ui";
import ClientFields from "./client-fields";
import { FieldInput } from "./fields";
type ListResult = {
  records: CmsRecord[];
  total: number;
  page: number;
  size: number;
  stats: { total: number; published: number; drafts: number };
  facets?: { categories: string[]; authors: string[] };
};
export default function Manager({
  module,
  permissions,
}: {
  module: string;
  permissions: string[];
}) {
  const config = modules[module];
  const isClient = module === "clients";
  const statusLabel = (value: string) =>
    isClient
      ? { draft: "Inactive", published: "Active", archived: "Archived" }[
          value
        ] || value
      : value.charAt(0).toUpperCase() + value.slice(1);
  const query = useSearchParams();
  const router = useRouter();
  const reduced = useReducedMotion();
  const canWrite = permissions.includes(`${module}:write`);
  const canDelete = permissions.includes(`${module}:delete`);
  const [data, setData] = useState<ListResult | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [author, setAuthor] = useState("all");
  const [sort, setSort] = useState(
    module === "clients" ? "title" : "sortOrder",
  );
  const [page, setPage] = useState(1);
  const [grid, setGrid] = useState(
    ["portfolio", "team", "services", "media"].includes(module),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Partial<CmsRecord> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<string[]>([]);
  const [focused, setFocused] = useState<CmsRecord | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(
        `/api/admin/${module}?q=${encodeURIComponent(search)}&status=${status === "all" ? "" : status}&category=${category === "all" ? "" : encodeURIComponent(category)}&author=${author === "all" ? "" : encodeURIComponent(author)}&sort=${sort}&page=${page}&size=12`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      return result as ListResult;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load records.",
      );
      return null;
    }
  }, [module, search, status, sort, page, category, author]);
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const begin = useCallback(
    (record?: CmsRecord) => {
      if (!canWrite) return;
      if (module === "store-products") {
        router.push(
          record
            ? `/admin/store/products/${record.id}/edit`
            : "/admin/store/products/create",
        );
        return;
      }
      setEditing(
        record
          ? module === "clients"
            ? {
                ...structuredClone(record),
                title: record.data.contactName || record.title,
                data: {
                  ...structuredClone(record.data),
                  company:
                    record.data.company ||
                    (record.data.contactName ? record.title : ""),
                },
              }
            : structuredClone(record)
          : {
              title: "",
              slug:
                config.singleton ||
                (module === "clients" ? `client-${crypto.randomUUID()}` : ""),
              description: "",
              status: config.statuses[0],
              sortOrder: data?.stats.total || 0,
              data: {},
            },
      );
      setDirty(false);
    },
    [canWrite, config, data?.stats.total, module, router],
  );
  useEffect(() => {
    if (!data) return;
    if (query.get("new") === "1" && !editing) {
      begin();
      router.replace(`/admin/${module}`, { scroll: false });
    }
    const id = query.get("edit");
    if (id) {
      const record = data.records.find((r) => r.id === id);
      if (!record) {
        fetch(`/api/admin/${module}?id=${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((result) => {
            if (result.records?.[0]) {
              if (module === "contacts") setFocused(result.records[0]);
              else begin(result.records[0]);
            }
          });
        router.replace(`/admin/${module}`, { scroll: false });
      }
      if (record) {
        if (module === "contacts") setFocused(record);
        else begin(record);
        router.replace(`/admin/${module}`, { scroll: false });
      }
    }
  }, [data, query, editing, begin, router, module]);
  function close() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setEditing(null);
    setDirty(false);
  }
  function patch(value: Partial<CmsRecord>) {
    setEditing((e) => ({ ...e, ...value }));
    setDirty(true);
  }
  async function save(event?: React.FormEvent, statusOverride?: string) {
    event?.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError("");
    const loading = toast.loading("Saving changes…");
    try {
      const response = await fetch(`/api/admin/${module}`, {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          ...(statusOverride ? { status: statusOverride } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(
        isClient
          ? "Client saved"
          : result.status === "published"
            ? "Changes published successfully"
            : "Changes saved",
        { id: loading },
      );
      setDirty(false);
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save changes.",
      );
      toast.error("Unable to save", {
        id: loading,
        description: error instanceof Error ? error.message : "",
      });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/${module}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deleting }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(
        `${config.singular}${deleting.length > 1 ? "s" : ""} moved to trash`,
      );
      setDeleting([]);
      setSelected([]);
      if (focused && deleting.includes(focused.id)) setFocused(null);
      await load();
    } catch (error) {
      toast.error("Unable to delete", {
        description: error instanceof Error ? error.message : "",
      });
    } finally {
      setBusy(false);
    }
  }
  async function updateStatus(record: CmsRecord, newStatus: string) {
    try {
      const response = await fetch(`/api/admin/${module}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...record, status: newStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setFocused(result);
      toast.success(
        module === "contacts"
          ? `Message marked ${newStatus}`
          : "Status updated",
      );
      await load();
    } catch (error) {
      toast.error("Unable to update status", {
        description: error instanceof Error ? error.message : "",
      });
    }
  }
  async function exportCSV() {
    try {
      const rows: CmsRecord[] = [];
      for (let p = 1; p <= Math.ceil((data?.total || 1) / 50); p++) {
        const response = await fetch(
          `/api/admin/${module}?size=50&page=${p}&q=${encodeURIComponent(search)}&status=${status === "all" ? "" : status}`,
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        rows.push(...result.records);
      }
      const keys = isClient
        ? [
            "title",
            "company",
            "jobTitle",
            "email",
            "phone",
            "website",
            "address",
            "city",
            "region",
            "postalCode",
            "country",
            "description",
            "status",
          ]
        : [
            "title",
            "slug",
            "status",
            "description",
            ...config.fields
              .filter((f) => !["rich", "list", "image"].includes(f.type || ""))
              .map((f) => f.key),
          ];
      const cell = (v: unknown) => {
        let text = String(v ?? "").replace(/<[^>]*>/g, "");
        if (/^[=+\-@]/.test(text)) text = "'" + text;
        return '"' + text.replaceAll('"', '""') + '"';
      };
      const csv = [
        keys
          .map((key) =>
            isClient
              ? {
                  title: "client_name",
                  description: "private_notes",
                  jobTitle: "job_title",
                  postalCode: "postal_code",
                }[key] || key
              : key,
          )
          .join(","),
        ...rows.map((r) =>
          keys
            .map((k) => cell(k in r ? r[k as keyof CmsRecord] : r.data[k]))
            .join(","),
        ),
      ].join("\r\n");
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${module}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "",
      });
    }
  }
  const defaultRecord = data?.records[0];
  const isBlog = module === "blog";
  const editor = editing && (
    <form
      id="cms-editor-form"
      className={isBlog ? "a-complex-editor" : "a-edit-form"}
      onSubmit={(event) => save(event)}
    >
      <div className="a-drawer-body">
        <div className="a-edit-main">
          {isClient ? (
            <ClientFields record={editing} onChange={patch} />
          ) : (
            <>
              <label className="a-field">
                <span>
                  {module === "faqs"
                    ? "Question"
                    : module === "testimonials"
                      ? "Client name"
                      : module === "team"
                        ? "Full name"
                        : "Title"}{" "}
                  *
                </span>
                <input
                  required
                  maxLength={250}
                  value={editing.title || ""}
                  onChange={(e) =>
                    patch({
                      title: e.target.value,
                      ...(!editing.id ? { slug: slugify(e.target.value) } : {}),
                    })
                  }
                />
              </label>
              <div className="a-form-grid">
                <label className="a-field">
                  <span>URL slug *</span>
                  <input
                    required
                    value={editing.slug || ""}
                    disabled={Boolean(config.singleton)}
                    onChange={(e) => patch({ slug: slugify(e.target.value) })}
                  />
                </label>
                <label className="a-field">
                  <span>Display order</span>
                  <input
                    type="number"
                    min={0}
                    value={editing.sortOrder || 0}
                    onChange={(e) =>
                      patch({ sortOrder: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="a-field">
                <span>Short description</span>
                <textarea
                  value={editing.description || ""}
                  rows={3}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </label>
              {config.fields
                .filter((f) => (isBlog ? f.key === "body" : true))
                .map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={editing.data?.[f.key]}
                    onChange={(v) =>
                      patch({ data: { ...editing.data, [f.key]: v } })
                    }
                  />
                ))}
            </>
          )}
        </div>
        {isBlog && (
          <aside className="a-edit-aside">
            {config.fields
              .filter((f) => f.key !== "body")
              .map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={editing.data?.[f.key]}
                  onChange={(v) =>
                    patch({ data: { ...editing.data, [f.key]: v } })
                  }
                />
              ))}
          </aside>
        )}
      </div>
      <div className="a-editor-footer">
        <span
          role={formError ? "alert" : undefined}
          className={formError ? "danger" : ""}
        >
          {formError || (dirty ? "Unsaved changes" : "All changes saved")}
        </span>
        <div className="a-button-row">
          <SelectInput
            label={isClient ? "Client status" : "Publication status"}
            value={editing.status || config.statuses[0]}
            onChange={(value) => patch({ status: value })}
            options={config.statuses.map((s) => ({
              value: s,
              label: statusLabel(s),
            }))}
          />
          <button type="button" className="a-button secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="a-button" disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Save changes
          </button>
        </div>
      </div>
    </form>
  );
  if (error)
    return (
      <Empty
        title="Unable to load this collection"
        description={error}
        action={
          <button className="a-button" onClick={load}>
            Retry
          </button>
        }
      />
    );
  if (!data) return <Skeleton />;
  if (isBlog && editing)
    return (
      <>
        <div className="a-page-heading">
          <div>
            <h1>{editing.id ? "Edit blog article" : "Create blog article"}</h1>
            <p>Write, refine and publish your next perspective.</p>
          </div>
          <div className="a-button-row">
            <button
              className="a-button secondary"
              onClick={() => setPreview(true)}
            >
              <Eye size={16} />
              Preview
            </button>
            <button
              className="a-button secondary"
              disabled={busy}
              onClick={() => save(undefined, "draft")}
            >
              Save as draft
            </button>
            <button
              className="a-button"
              disabled={busy}
              onClick={() => save(undefined, "published")}
            >
              Publish
            </button>
            <button className="a-button secondary" onClick={close}>
              Back to articles
            </button>
          </div>
        </div>
        {editor}
        <Drawer
          open={preview}
          onClose={() => setPreview(false)}
          title="Article preview"
          wide
        >
          <div className="a-drawer-body">
            <h2>{editing.title}</h2>
            <p className="caption">
              Private preview · unsaved changes are included
            </p>
            <iframe
              title="Private article preview"
              sandbox=""
              srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.9 sans-serif;color:#111318;padding:15px}img{max-width:100%;border-radius:16px}h2{font-size:28px}</style></head><body>${editing.data?.body || ""}</body></html>`}
              style={{ width: "100%", height: "70vh", border: 0 }}
            />
          </div>
        </Drawer>
      </>
    );
  const image = (record: CmsRecord) =>
    isClient
      ? record.data.profileImage || record.data.image
      : record.data[config.imageKey || "image"];
  return (
    <>
      <div className="a-page-heading">
        <div>
          <h1>{config.label}</h1>
          <p>
            {module === "contacts"
              ? "Manage and respond to inquiries from your website."
              : module === "portfolio"
                ? "Manage your portfolio projects and showcase your best work."
                : module === "faqs"
                  ? "Manage frequently asked questions and answers for your website."
                  : isClient
                    ? "Manage client contacts, organizations and private notes."
                    : `Manage your ${config.label.toLowerCase()}, details and website visibility.`}
          </p>
        </div>
        <div className="a-button-row">
          {["portfolio", "blog", "services", "careers", "team"].includes(
            module,
          ) && (
            <Link
              className="a-button secondary"
              href={`/${module === "team" ? "team" : module}`}
              target="_blank"
            >
              View website
              <ExternalLink size={15} />
            </Link>
          )}
          {canWrite && (
            <button
              className="a-button"
              onClick={() =>
                begin(config.singleton ? defaultRecord : undefined)
              }
            >
              <Plus size={18} />
              {config.singleton
                ? "Edit settings"
                : `Add ${config.singular.toLowerCase()}`}
            </button>
          )}
        </div>
      </div>
      <div className="a-metrics">
        <Metric
          label={`Total ${config.label.toLowerCase()}`}
          value={data.stats.total}
          icon={<Layers />}
        />
        <Metric
          label={
            isClient
              ? "Active clients"
              : module === "contacts"
                ? "Read / resolved"
                : "Published / active"
          }
          value={data.stats.published}
          icon={<Eye />}
        />
        <Metric
          label={
            isClient
              ? "Inactive clients"
              : module === "contacts"
                ? "Unread"
                : "Drafts / pending"
          }
          value={data.stats.drafts}
          icon={<FileText />}
        />
        <Metric
          label={isClient ? "Contact details" : "Display order"}
          value={isClient ? "Private" : "Custom"}
          icon={<Archive />}
        />
      </div>
      {module === "blog" && data.records.some((r) => r.data.featured) && (
        <article className="a-featured-blog">
          {(() => {
            const r = data.records.find((r) => r.data.featured)!;
            return (
              <>
                <img src={r.data.image} alt={r.title} />
                <div>
                  <span className="a-chip">Featured · {r.data.category}</span>
                  <h2>{r.title}</h2>
                  <p>{r.description}</p>
                  <div>
                    <span>{r.data.author}</span>
                    {canWrite && (
                      <button
                        className="a-button secondary small"
                        onClick={() => begin(r)}
                      >
                        <Pencil size={15} />
                        Edit article
                      </button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </article>
      )}
      <div className="a-toolbar">
        <div className="a-search-input">
          <Search size={17} />
          <input
            aria-label={`Search ${config.label.toLowerCase()}`}
            placeholder={`Search ${config.label.toLowerCase()}…`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {data.facets?.categories?.length ? (
          <SelectInput
            label="Filter by category"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All categories" },
              ...data.facets.categories.map((v) => ({ value: v, label: v })),
            ]}
          />
        ) : null}
        {module === "blog" && data.facets?.authors?.length ? (
          <SelectInput
            label="Filter by author"
            value={author}
            onChange={(v) => {
              setAuthor(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All authors" },
              ...data.facets.authors.map((v) => ({ value: v, label: v })),
            ]}
          />
        ) : null}
        <SelectInput
          label="Filter by status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All status" },
            ...config.statuses.map((s) => ({
              value: s,
              label: statusLabel(s),
            })),
          ]}
        />
        <SelectInput
          label="Sort records"
          value={sort}
          onChange={setSort}
          options={[
            ...(!isClient
              ? [{ value: "sortOrder", label: "Sort: Display order" }]
              : []),
            { value: "updatedAt", label: "Sort: Last updated" },
            {
              value: "title",
              label: isClient ? "Sort: Client name" : "Sort: Title",
            },
          ]}
        />
        <div className="a-toolbar-end">
          <button
            className={`a-icon-button ${grid ? "selected" : ""}`}
            aria-label="Grid view"
            onClick={() => setGrid(true)}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            className={`a-icon-button ${!grid ? "selected" : ""}`}
            aria-label="List view"
            onClick={() => setGrid(false)}
          >
            <List size={18} />
          </button>
          <button className="a-button secondary" onClick={exportCSV}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>
      {config.singleton ? (
        <section className="a-panel a-settings-summary">
          {defaultRecord ? (
            <>
              <h2>{defaultRecord.title}</h2>
              {config.fields.map((f) => (
                <div className="a-setting-row" key={f.key}>
                  <strong>{f.label}</strong>
                  <span>
                    {f.type === "list"
                      ? `${(defaultRecord.data[f.key] || []).length} entries`
                      : String(defaultRecord.data[f.key] || "Not configured")}
                  </span>
                </div>
              ))}
              {canWrite && (
                <button
                  className="a-button"
                  onClick={() => begin(defaultRecord)}
                >
                  <Pencil size={16} />
                  Edit {config.label.toLowerCase()}
                </button>
              )}
            </>
          ) : (
            <Empty
              title="Settings not configured"
              action={
                canWrite && (
                  <button className="a-button" onClick={() => begin()}>
                    Configure settings
                  </button>
                )
              }
            />
          )}
        </section>
      ) : module === "contacts" ? (
        <div className="a-inbox">
          <section className="a-message-list">
            {data.records.length ? (
              data.records.map((r) => (
                <button
                  className={focused?.id === r.id ? "active" : ""}
                  key={r.id}
                  onClick={() => setFocused(r)}
                >
                  <span className="a-person-avatar">
                    {r.data.name?.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{r.data.name}</strong>
                    <b>{r.title}</b>
                    <p>{r.data.message?.slice(0, 75)}</p>
                  </div>
                  {r.status === "unread" && <i className="a-unread-dot" />}
                </button>
              ))
            ) : (
              <Empty
                title="No messages"
                description="Your contact form inquiries appear here."
              />
            )}
          </section>
          <section className="a-message-detail">
            {focused ? (
              <>
                <div className="a-message-actions">
                  {canWrite && (
                    <>
                      {["read", "unread", "resolved", "archived"]
                        .filter((s) => s !== focused.status)
                        .map((s) => (
                          <button
                            key={s}
                            className="a-button secondary small"
                            onClick={() => updateStatus(focused, s)}
                          >
                            {s === "resolved" ? (
                              <Check size={15} />
                            ) : s === "archived" ? (
                              <Archive size={15} />
                            ) : (
                              <Mail size={15} />
                            )}
                            Mark {s}
                          </button>
                        ))}
                    </>
                  )}
                  {canDelete && (
                    <button
                      className="a-button danger small"
                      onClick={() => setDeleting([focused.id])}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  )}
                </div>
                <h2>{focused.title}</h2>
                <div className="a-message-sender">
                  <span className="a-person-avatar">
                    {focused.data.name?.slice(0, 2)}
                  </span>
                  <div>
                    <strong>{focused.data.name}</strong>
                    <a href={`mailto:${focused.data.email}`}>
                      {focused.data.email}
                    </a>
                  </div>
                  <DateStamp value={focused.createdAt} />
                </div>
                <p className="a-message-body">{focused.data.message}</p>
                <a
                  className="a-button"
                  href={`mailto:${focused.data.email}?subject=${encodeURIComponent(`Re: ${focused.title}`)}`}
                >
                  Reply by email
                  <ExternalLink size={15} />
                </a>
              </>
            ) : (
              <Empty
                title="Your conversations, in focus"
                description="Choose a message to read its details."
              />
            )}
          </section>
        </div>
      ) : !data.records.length ? (
        <section className="a-panel">
          <Empty
            title={`No ${config.label.toLowerCase()} yet`}
            description="This collection is ready for your first entry."
            action={
              canWrite && (
                <button className="a-button" onClick={() => begin()}>
                  <Plus size={16} />
                  Create {config.singular.toLowerCase()}
                </button>
              )
            }
          />
        </section>
      ) : grid ? (
        <div
          className={`a-record-grid ${module === "team" ? "team-grid" : ""}`}
        >
          {data.records.map((r, i) => (
            <motion.article
              className="a-record-card"
              key={r.id}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.25) }}
            >
              <div className="a-record-image">
                {image(r) ? (
                  <img src={image(r)} alt={r.data.alt || r.title} />
                ) : (
                  <span>
                    <Layers size={35} />
                  </span>
                )}
                <Badge
                  status={r.status}
                  label={isClient ? statusLabel(r.status) : undefined}
                />
              </div>
              <div className="a-record-body">
                <h3>{r.title}</h3>
                <p>
                  {(isClient
                    ? r.data.company || r.data.email
                    : r.description) ||
                    r.data.position ||
                    r.data.category ||
                    r.slug}
                </p>
                <div className="a-record-footer">
                  <span className="a-chip">
                    {(isClient
                      ? r.data.phone || "No phone added"
                      : r.data.category) ||
                      r.data.department ||
                      `Order ${r.sortOrder}`}
                  </span>
                  <div>
                    {canWrite && (
                      <button
                        className="a-icon-button"
                        aria-label={`Edit ${r.title}`}
                        onClick={() => begin(r)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="a-icon-button danger"
                        aria-label={`Delete ${r.title}`}
                        onClick={() => setDeleting([r.id])}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select all records"
                    type="checkbox"
                    checked={
                      data.records.length > 0 &&
                      selected.length === data.records.length
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? data.records.map((r) => r.id) : [],
                      )
                    }
                  />
                </th>
                <th>
                  {module === "faqs"
                    ? "Question"
                    : module === "team"
                      ? "Team member"
                      : module === "testimonials"
                        ? "Client"
                        : isClient
                          ? "Client name"
                          : "Title"}
                </th>
                <th>
                  {["contacts", "bookings", "subscribers", "clients"].includes(
                    module,
                  )
                    ? isClient
                      ? "Email / phone"
                      : "Email"
                    : "Category / type"}
                </th>
                <th>Status</th>
                <th>{isClient ? "Last updated" : "Order / updated"}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.2) }}
                >
                  <td>
                    <input
                      aria-label={`Select ${r.title}`}
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, r.id]
                            : selected.filter((id) => id !== r.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <div className="a-table-title">
                      {image(r) && <img src={image(r)} alt="" />}
                      <div>
                        <strong>{r.title}</strong>
                        <p>
                          {(
                            (isClient ? r.data.company || "" : r.description) ||
                            r.data.position ||
                            (isClient ? "" : r.slug)
                          ).slice(0, 85)}
                        </p>
                        {module === "faqs" && (
                          <details>
                            <summary>Read answer</summary>
                            <p>{r.data.answer}</p>
                          </details>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="a-chip">
                      {r.data.email ||
                        r.data.category ||
                        r.data.department ||
                        r.data.kind ||
                        "General"}
                    </span>
                    {isClient && r.data.phone && <small>{r.data.phone}</small>}
                  </td>
                  <td>
                    {module === "bookings" && canWrite ? (
                      <SelectInput
                        label={`Status for ${r.title}`}
                        value={r.status}
                        onChange={(s) => updateStatus(r, s)}
                        options={config.statuses.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                      />
                    ) : (
                      <Badge
                        status={r.status}
                        label={isClient ? statusLabel(r.status) : undefined}
                      />
                    )}
                  </td>
                  <td>
                    {!isClient && <strong>{r.sortOrder}</strong>}
                    <small>{<DateStamp value={r.updatedAt} />}</small>
                  </td>
                  <td>
                    <div className="a-row-actions">
                      {canWrite && (
                        <button
                          className="a-icon-button"
                          aria-label={`Edit ${r.title}`}
                          onClick={() => begin(r)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="a-icon-button danger"
                          aria-label={`Delete ${r.title}`}
                          onClick={() => setDeleting([r.id])}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!config.singleton && (
        <div className="a-pagination">
          <span>
            Showing {data.total ? (page - 1) * 12 + 1 : 0}–
            {Math.min(page * 12, data.total)} of {data.total} results
          </span>
          {selected.length > 0 && canDelete && (
            <button
              className="a-button danger small"
              onClick={() => setDeleting(selected)}
            >
              Delete selected ({selected.length})
            </button>
          )}
          <div>
            <button
              className="a-icon-button"
              disabled={page <= 1}
              aria-label="Previous page"
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span className="a-page-number">{page}</span>
            <button
              className="a-icon-button"
              disabled={page * 12 >= data.total}
              aria-label="Next page"
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
      <Drawer
        title={`${editing?.id ? "Edit" : "Create"} ${config.singular.toLowerCase()}`}
        open={Boolean(editing)}
        onClose={close}
        wide={config.fields.some((f) => f.type === "rich")}
      >
        {editor}
      </Drawer>
      <Confirm
        open={deleting.length > 0}
        onClose={() => setDeleting([])}
        onConfirm={remove}
        title={`Delete ${deleting.length > 1 ? `${deleting.length} items` : config.singular.toLowerCase()}?`}
        description="The selected content will move to trash and disappear from the website. Existing database history is retained."
        busy={busy}
      />
    </>
  );
}
