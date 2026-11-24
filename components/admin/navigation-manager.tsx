"use client";
import { useCallback, useEffect, useState } from "react";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { modules, slugify } from "@/lib/cms/registry";
import type { CmsRecord } from "@/lib/cms/store";
import { Drawer, Confirm, SelectInput, Empty, Skeleton } from "./ui";
export default function NavigationManager({
  permissions,
}: {
  permissions: string[];
}) {
  const [rows, setRows] = useState<CmsRecord[] | null>(null),
    [menu, setMenu] = useState("header"),
    [editing, setEditing] = useState<Partial<CmsRecord> | null>(null),
    [deleting, setDeleting] = useState<CmsRecord | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState("");
  const canWrite = permissions.includes("navigation:write"),
    canDelete = permissions.includes("navigation:delete");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/navigation?size=50&sort=sortOrder");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setRows(data.records);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function mutate(record: Partial<CmsRecord>, method = "PATCH") {
    const r = await fetch("/api/admin/navigation", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d;
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await mutate(
        {
          ...editing,
          slug: editing.slug || slugify(`${menu}-${editing.title}`),
          sortOrder: editing.sortOrder || 0,
        },
        editing.id ? "PATCH" : "POST",
      );
      setEditing(null);
      toast.success("Menu item saved");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = (rows || []).filter(
    (r) => (r.data.placement || "header") === menu,
  );
  async function reorder(from: number, to: number) {
    if (from === to || !canWrite || busy) return;
    const next = [...visible];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/navigation-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement: menu,
          items: next.map((r) => ({ id: r.id, updatedAt: r.updatedAt })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success("Menu order published");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Navigation</h1>
          <p>Manage your website menus and link structure.</p>
        </div>
        {canWrite && (
          <button
            className="a-button"
            onClick={() =>
              setEditing({
                title: "",
                slug: "",
                status: "published",
                sortOrder: visible.length,
                data: {
                  url: "/",
                  placement: menu,
                  parent: "",
                  newTab: false,
                  icon: "link",
                },
              })
            }
          >
            <Plus size={17} />
            Add menu item
          </button>
        )}
      </div>
      <div className="a-tabs">
        {[
          ["header", "Main menu"],
          ["footer", "Footer menu"],
          ["mobile", "Mobile menu"],
        ].map(([key, label]) => (
          <button
            className={menu === key ? "active" : ""}
            key={key}
            onClick={() => setMenu(key)}
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
        <div className="a-panel a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th />
                <th>Label</th>
                <th>URL</th>
                <th>Type</th>
                <th>Status</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={r.id}
                  draggable={canWrite && !busy}
                  onDragStart={() => setDrag(r.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() =>
                    reorder(
                      visible.findIndex((r) => r.id === drag),
                      i,
                    )
                  }
                >
                  <td>
                    <GripVertical size={16} />
                  </td>
                  <td style={{ paddingLeft: r.data.parent ? 32 : 12 }}>
                    <strong>{r.title}</strong>
                    {r.data.parent && <small>↳ {r.data.parent}</small>}
                  </td>
                  <td>{r.data.url}</td>
                  <td>
                    {rows.some((n) => n.data.parent === r.title)
                      ? "Dropdown"
                      : "Link"}
                  </td>
                  <td>
                    <button
                      role="switch"
                      aria-checked={r.status === "published"}
                      aria-label={`Enable ${r.title}`}
                      className={`a-switch ${r.status === "published" ? "on" : ""}`}
                      disabled={!canWrite || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await mutate({
                            ...r,
                            status:
                              r.status === "published" ? "draft" : "published",
                          });
                          toast.success("Visibility updated");
                          await load();
                        } catch (e) {
                          toast.error((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </td>
                  <td>
                    <div className="a-button-row">
                      <button
                        className="a-icon-button"
                        disabled={i === 0 || busy || !canWrite}
                        aria-label={`Move ${r.title} up`}
                        onClick={() => reorder(i, i - 1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      {i + 1}
                      <button
                        className="a-icon-button"
                        disabled={i === visible.length - 1 || busy || !canWrite}
                        aria-label={`Move ${r.title} down`}
                        onClick={() => reorder(i, i + 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="a-button-row">
                      {canWrite && (
                        <button
                          className="a-icon-button"
                          aria-label={`Edit ${r.title}`}
                          onClick={() => setEditing(r)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="a-icon-button danger"
                          aria-label={`Delete ${r.title}`}
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <Empty
              title="No menu items"
              description="Create links for this menu."
            />
          )}
          <a
            className="a-button secondary"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            Live website preview
            <ExternalLink size={16} />
          </a>
        </div>
      )}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Navigation item"
      >
        {editing && (
          <form
            className="a-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              Label
              <input
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <label>
              URL
              <input
                required
                value={editing.data?.url || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    data: { ...editing.data, url: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Parent
              <SelectInput
                label="Parent menu item"
                value={editing.data?.parent || "none"}
                onChange={(v) =>
                  setEditing({
                    ...editing,
                    data: { ...editing.data, parent: v === "none" ? "" : v },
                  })
                }
                options={[
                  { value: "none", label: "Top-level link" },
                  ...visible
                    .filter((r) => r.id !== editing.id && !r.data.parent)
                    .map((r) => ({ value: r.title, label: r.title })),
                ]}
              />
            </label>
            <label>
              Icon
              <SelectInput
                label="Menu icon"
                value={editing.data?.icon || "link"}
                onChange={(v) =>
                  setEditing({ ...editing, data: { ...editing.data, icon: v } })
                }
                options={["link", "briefcase", "users", "file", "mail"].map(
                  (value) => ({ value, label: value }),
                )}
              />
            </label>
            <label className="a-check">
              <input
                type="checkbox"
                checked={editing.data?.newTab || false}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    data: { ...editing.data, newTab: e.target.checked },
                  })
                }
              />
              Open in new tab
            </label>
            <label>
              Publication
              <SelectInput
                label="Publication status"
                value={editing.status || "draft"}
                onChange={(status) => setEditing({ ...editing, status })}
                options={modules.navigation.statuses.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </label>
            <button className="a-button" disabled={busy}>
              Save menu item
            </button>
          </form>
        )}
      </Drawer>
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete menu item?"
        description="This removes the link from your published menus."
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await mutate({ id: deleting.id }, "DELETE");
            setDeleting(null);
            toast.success("Menu item deleted");
            await load();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />
    </div>
  );
}
