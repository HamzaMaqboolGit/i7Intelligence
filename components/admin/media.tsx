"use client";
import DateStamp from "../controls/date-stamp";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Search,
  Grid2X2,
  List,
  Copy,
  Trash2,
  Save,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import type { CmsRecord } from "@/lib/cms/store";
import { Drawer, Confirm, Empty, Skeleton } from "./ui";
export default function MediaManager({
  permissions,
}: {
  permissions: string[];
}) {
  const canWrite = permissions.includes("media:write"),
    canDelete = permissions.includes("media:delete");
  const [records, setRecords] = useState<CmsRecord[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [grid, setGrid] = useState(true),
    [drag, setDrag] = useState(false),
    [active, setActive] = useState<CmsRecord | null>(null),
    [deleting, setDeleting] = useState<CmsRecord | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();
  async function load() {
    try {
      const response = await fetch(
        `/api/admin/media?size=16&page=${page}&q=${encodeURIComponent(search)}&sort=createdAt`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRecords(data.records);
      setTotal(data.total);
    } catch (error) {
      toast.error("Unable to load media", {
        description: error instanceof Error ? error.message : "",
      });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [search, page]);
  async function upload(files: FileList | File[]) {
    if (!canWrite) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const progress = toast.loading(`Uploading ${file.name}…`);
      try {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/admin/media-upload", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        toast.success("Image uploaded", {
          id: progress,
          description: file.name,
        });
      } catch (error) {
        toast.error("Upload failed", {
          id: progress,
          description: error instanceof Error ? error.message : "",
        });
      }
    }
    setBusy(false);
    await load();
  }
  async function save() {
    if (!active) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(active),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Image details saved");
      setActive(data);
      await load();
    } catch (error) {
      toast.error("Unable to save", {
        description: error instanceof Error ? error.message : "",
      });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleting.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Image moved to trash");
      setActive(null);
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error("Unable to delete", {
        description: error instanceof Error ? error.message : "",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="a-page-heading">
        <div>
          <h1>Media library</h1>
          <p>Manage your website images and media files in one place.</p>
        </div>
        {canWrite && (
          <button
            className="a-button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <Upload size={17} />
            )}
            Upload files
          </button>
        )}
      </div>
      <input
        type="file"
        ref={input}
        hidden
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
        }}
      />
      {canWrite && (
        <button
          disabled={busy}
          className={`a-media-upload ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files);
          }}
          onClick={() => input.current?.click()}
        >
          <Upload size={32} />
          <strong>
            {busy
              ? "Preparing your images…"
              : "Drag & drop files here, or click to upload"}
          </strong>
          <p>
            JPG, PNG, WebP or GIF · up to 10 MB · optimized automatically ·
            uploaded images can be used publicly
          </p>
        </button>
      )}
      <div className="a-toolbar">
        <div className="a-search-input">
          <Search size={17} />
          <input
            aria-label="Search media"
            value={search}
            placeholder="Search media…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
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
        </div>
      </div>
      {loading ? (
        <Skeleton />
      ) : !records.length ? (
        <Empty
          title="Your library starts here"
          description="Upload original or licensed images, then reuse them throughout your website."
        />
      ) : grid ? (
        <div className="a-media-grid">
          {records.map((r, i) => (
            <motion.button
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.025 }}
              className="a-media-item"
              key={r.id}
              onClick={() => setActive(structuredClone(r))}
            >
              <img
                src={r.data.thumbnail || r.data.image}
                alt={r.data.alt || r.title}
              />
              <div>
                <strong>{r.title}</strong>
                <small>
                  {Math.round(r.data.size / 1024)} KB ·{" "}
                  {String(r.data.mime || "image/webp")
                    .split("/")[1]
                    .toUpperCase()}
                </small>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Dimensions</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="a-table-title">
                      <img src={r.data.thumbnail || r.data.image} alt="" />
                      <strong>{r.title}</strong>
                    </div>
                  </td>
                  <td>
                    {r.data.width} × {r.data.height}
                  </td>
                  <td>{Math.round(r.data.size / 1024)} KB</td>
                  <td>{<DateStamp value={r.createdAt} />}</td>
                  <td>
                    <button
                      className="a-button secondary small"
                      onClick={() => setActive(structuredClone(r))}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="a-pagination">
        <span>{total} files</span>
        <div>
          <button
            disabled={page <= 1}
            className="a-button secondary small"
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>{page}</span>
          <button
            disabled={page * 16 >= total}
            className="a-button secondary small"
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <Drawer
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title="Media details"
      >
        {active && (
          <div className="a-drawer-body">
            <img
              className="a-media-detail-image"
              src={active.data.image}
              alt={active.data.alt || active.title}
            />
            <h3>{active.title}</h3>
            <p className="caption">
              {active.data.width} × {active.data.height} ·{" "}
              {Math.round(active.data.size / 1024)} KB ·{" "}
              {String(active.data.mime || "image/webp")
                .split("/")[1]
                .toUpperCase()}
            </p>
            <div className="a-button-row" style={{ marginBlock: 20 }}>
              <button
                className="a-button secondary small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      new URL(active.data.image, location.origin).href,
                    );
                    toast.success("Media URL copied");
                  } catch {
                    toast.error("Clipboard unavailable");
                  }
                }}
              >
                <Copy size={15} />
                Copy URL
              </button>
              <a
                className="a-button secondary small"
                href={active.data.image}
                download
              >
                <Download size={15} />
                Download
              </a>
              {canDelete && (
                <button
                  className="a-icon-button danger"
                  aria-label="Delete image"
                  onClick={() => setDeleting(active)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {["alt", "caption", "folder"].map((key) => (
              <label className="a-field" key={key}>
                <span>
                  {key === "alt"
                    ? "Alt text"
                    : key[0].toUpperCase() + key.slice(1)}
                </span>
                <input
                  disabled={!canWrite}
                  value={active.data[key] || ""}
                  onChange={(e) =>
                    setActive({
                      ...active,
                      data: { ...active.data, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
            <div className="a-setting-row">
              <strong>Uploaded by</strong>
              <span>{active.data.uploadedBy || "Administrator"}</span>
            </div>
            {canWrite && (
              <button
                className="a-button"
                disabled={busy}
                onClick={save}
                style={{ marginTop: 25 }}
              >
                <Save size={16} />
                Save details
              </button>
            )}
          </div>
        )}
      </Drawer>
      <Confirm
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this image?"
        description="The image will move to trash and its public URL will stop working. Update any sections using it first."
      />
    </>
  );
}
