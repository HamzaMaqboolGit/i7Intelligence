"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, Briefcase, Save, Upload, Trash2 } from "lucide-react";
import { modules, slugify } from "@/lib/cms/registry";
import type { CmsRecord } from "@/lib/cms/store";
import { FieldInput } from "../fields";
import { SelectInput, Confirm, Skeleton } from "../ui";
export default function ProductEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<Partial<CmsRecord>>({
      title: "",
      slug: "",
      description: "",
      status: "draft",
      sortOrder: 0,
      data: {
        kind: "digital",
        currency: "usd",
        priceMinor: 0,
        fulfillment: "automatic",
        downloadDays: 30,
        downloadLimit: 5,
      },
    }),
    [loaded, setLoaded] = useState(!id),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [files, setFiles] = useState<
      { id: string; name: string; size: number; version: string }[]
    >([]),
    [deleting, setDeleting] = useState("");
  const loadFiles = useCallback(async () => {
    if (!id && !record.id) return;
    const r = await fetch(
      `/api/admin/store/files?productId=${id || record.id}`,
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setFiles(data.records);
  }, [id, record.id]);
  useEffect(() => {
    if (id)
      fetch(`/api/admin/store-products?id=${id}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setRecord(d);
          setLoaded(true);
        })
        .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    void loadFiles().catch((e) => setError(e.message));
  }, [loadFiles]);
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
  async function save(status: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/store-products", {
        method: record.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...record,
          slug: record.slug || slugify(record.title || ""),
          status,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRecord(d);
      setDirty(false);
      toast.success(
        status === "published" ? "Product published" : "Draft saved",
      );
      if (!id) router.replace(`/admin/store/products/${d.id}/edit`);
    } catch (e) {
      toast.error("Unable to save product", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!record.id) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("productId", record.id);
      form.set("version", "1.0");
      const r = await fetch("/api/admin/store/files", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Private file uploaded");
      await loadFiles();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error) return <div className="a-error">{error}</div>;
  if (!loaded) return <Skeleton />;
  const data = record.data || {};
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>
            {record.id ? "Edit product / service" : "Create product / service"}
          </h1>
          <p>Publish premium digital goods and professional services.</p>
        </div>
        <div className="a-button-row">
          <button
            className="a-button secondary"
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved changes?"))
                router.push("/admin/store/products");
            }}
          >
            Cancel
          </button>
          <button
            className="a-button secondary"
            disabled={busy}
            onClick={() => save("draft")}
          >
            <Save size={16} />
            Save draft
          </button>
          <button
            className="a-button"
            disabled={busy}
            onClick={() => save("published")}
          >
            Save & publish
          </button>
        </div>
      </div>
      <div className="a-product-types">
        {[
          [
            "digital",
            "Digital product",
            "Sell downloadable templates, assets and documents.",
            Package,
          ],
          [
            "service",
            "Professional service",
            "Sell design, development and expert services.",
            Briefcase,
          ],
        ].map(([key, title, description, Icon]) => {
          const Symbol = Icon as typeof Package;
          return (
            <button
              key={String(key)}
              className={data.kind === key ? "active" : ""}
              onClick={() => {
                setRecord({
                  ...record,
                  data: {
                    ...data,
                    kind: key,
                    fulfillment: key === "service" ? "manual" : "automatic",
                  },
                });
                setDirty(true);
              }}
            >
              <Symbol size={25} />
              <strong>{String(title)}</strong>
              <span>{String(description)}</span>
            </button>
          );
        })}
      </div>
      <div className="a-product-editor-grid">
        <section className="a-panel">
          <h2>General information</h2>
          <label className="a-field">
            Title
            <input
              required
              value={record.title}
              onChange={(e) => {
                setRecord({ ...record, title: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          <label className="a-field">
            Slug
            <input
              value={record.slug}
              placeholder={slugify(record.title || "")}
              onChange={(e) => {
                setRecord({ ...record, slug: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          <label className="a-field">
            Short description
            <textarea
              value={record.description || ""}
              onChange={(e) => {
                setRecord({ ...record, description: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          {modules["store-products"].fields
            .filter(
              (f) =>
                !["kind"].includes(f.key) &&
                !(
                  data.kind === "digital" &&
                  ["turnaround", "revisions"].includes(f.key)
                ),
            )
            .map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={data[f.key]}
                onChange={(value) => {
                  setRecord({ ...record, data: { ...data, [f.key]: value } });
                  setDirty(true);
                }}
              />
            ))}
        </section>
        <aside>
          <div className="a-panel">
            <h2>Publishing</h2>
            <SelectInput
              label="Product publication"
              value={record.status || "draft"}
              onChange={(status) => {
                setRecord({ ...record, status });
                setDirty(true);
              }}
              options={modules["store-products"].statuses.map((value) => ({
                value,
                label: value,
              }))}
            />
            <label className="a-field">
              Display order
              <input
                type="number"
                min={0}
                value={record.sortOrder}
                onChange={(e) => {
                  setRecord({ ...record, sortOrder: Number(e.target.value) });
                  setDirty(true);
                }}
              />
            </label>
            {record.status === "published" && (
              <a
                className="a-button secondary"
                href={`/shop/${record.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Preview published listing
              </a>
            )}
          </div>
          <div className="a-panel">
            <h2>Protected product files</h2>
            <p className="a-muted">
              ZIP and PDF only, up to 25 MB each. Stored privately; public
              marketing media is separate. Save a draft before uploading.
            </p>
            {files.map((file) => (
              <div className="a-private-file" key={file.id}>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · v{file.version}
                  </small>
                </div>
                <button
                  className="a-icon-button danger"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setDeleting(file.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {record.id ? (
              <label className="a-button secondary a-upload-label">
                <Upload size={16} />
                Upload private file
                <input
                  hidden
                  type="file"
                  accept="application/zip,application/pdf"
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                  }}
                />
              </label>
            ) : (
              <p>Save a draft to enable file uploads.</p>
            )}
          </div>
          <div className="a-panel">
            <h2>Price precision</h2>
            <p className="a-muted">
              Enter integer minor units: USD 4900 = $49.00; JPY 4900 = ¥4,900.
              Final prices are always recalculated on the server. Tax automation
              requires verified Stripe registrations.
            </p>
          </div>
        </aside>
      </div>
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting("")}
        title="Remove private file?"
        description="The file will be removed from future purchases. Historical order access remains preserved."
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/admin/store/files", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: deleting }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setDeleting("");
            await loadFiles();
            toast.success("File removed from listing");
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
