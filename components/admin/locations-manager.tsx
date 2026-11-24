"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import type { CmsRecord } from "@/lib/cms/store";
import { modules, slugify } from "@/lib/cms/registry";
import { FieldInput } from "./fields";
import { Drawer, Confirm, SelectInput, Skeleton, Empty, Badge } from "./ui";
const Map = dynamic(() => import("../location-map"), {
  ssr: false,
  loading: () => <div className="a-skeleton" style={{ height: 420 }} />,
});
export default function LocationsManager({
  permissions,
}: {
  permissions: string[];
}) {
  const [rows, setRows] = useState<CmsRecord[] | null>(null),
    [active, setActive] = useState(""),
    [editing, setEditing] = useState<Partial<CmsRecord> | null>(null),
    [deleting, setDeleting] = useState<CmsRecord | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canWrite = permissions.includes("locations:write");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/locations?size=50");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRows(d.records);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function mutate(row: Partial<CmsRecord>, method: string) {
    const response = await fetch("/api/admin/locations", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Locations & Map</h1>
          <p>Manage your business locations and map display.</p>
        </div>
        {canWrite && (
          <button
            className="a-button"
            onClick={() =>
              setEditing({
                title: "",
                status: "draft",
                sortOrder: rows?.length || 0,
                data: {},
              })
            }
          >
            <Plus size={16} />
            Add location
          </button>
        )}
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
        <div className="a-location-manager">
          <aside className="a-office-list">
            {rows.map((row) => (
              <article
                className={row.id === active ? "active" : ""}
                key={row.id}
              >
                <button
                  className="a-office-select"
                  onClick={() => setActive(row.id)}
                >
                  <MapPin size={20} />
                  <span>
                    <strong>{row.title}</strong>
                    <small>
                      {[row.data.city, row.data.country]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  </span>
                  {row.data.primary && <Star size={16} />}
                </button>
                <div className="a-button-row">
                  <Badge status={row.status} />
                  {canWrite && (
                    <button
                      className="a-icon-button"
                      aria-label={`Edit ${row.title}`}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {permissions.includes("locations:delete") && (
                    <button
                      className="a-icon-button danger"
                      aria-label={`Delete ${row.title}`}
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!rows.length && (
              <Empty
                title="No offices configured"
                description="Add a real business location to enable your public map."
              />
            )}
          </aside>
          <div className="a-panel">
            {rows.length ? (
              <>
                <Map
                  key={active}
                  locations={[
                    ...rows.filter((r) => r.id === active),
                    ...rows.filter((r) => r.id !== active),
                  ].map((r, i) => ({
                    ...r,
                    data: { ...r.data, primary: i === 0 },
                  }))}
                />
                <p className="a-muted">
                  Only published offices appear on the Contact page. Map tiles ©
                  OpenStreetMap contributors.
                </p>
              </>
            ) : (
              <Empty
                title="Your map preview"
                description="No marker is shown until a real location is configured."
              />
            )}
            <a
              className="a-button secondary"
              href="/contact"
              target="_blank"
              rel="noreferrer"
            >
              View Contact page
            </a>
          </div>
        </div>
      )}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Office location"
      >
        {editing && (
          <form
            className="a-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await mutate(
                  {
                    ...editing,
                    slug: editing.slug || slugify(editing.title || ""),
                  },
                  editing.id ? "PATCH" : "POST",
                );
                setEditing(null);
                toast.success("Location saved");
                await load();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Office name
              <input
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            {modules.locations.fields.map((field) => (
              <FieldInput
                field={field}
                key={field.key}
                value={editing.data?.[field.key]}
                onChange={(v) =>
                  setEditing({
                    ...editing,
                    data: { ...editing.data, [field.key]: v },
                  })
                }
              />
            ))}
            <label>
              Display order
              <input
                type="number"
                min={0}
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({ ...editing, sortOrder: Number(e.target.value) })
                }
              />
            </label>
            <SelectInput
              label="Location status"
              value={editing.status || "draft"}
              onChange={(status) => setEditing({ ...editing, status })}
              options={modules.locations.statuses.map((value) => ({
                value,
                label: value,
              }))}
            />
            <button className="a-button" disabled={busy}>
              {busy ? "Saving…" : "Save location"}
            </button>
          </form>
        )}
      </Drawer>
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete location?"
        description="This office will be removed from your public map."
        busy={busy}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await mutate({ id: deleting.id }, "DELETE");
            setDeleting(null);
            toast.success("Location deleted");
            await load();
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
