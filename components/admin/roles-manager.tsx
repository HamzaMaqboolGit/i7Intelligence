"use client";
import { useCallback, useEffect, useState } from "react";
import { Shield, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Skeleton, Drawer } from "./ui";
type Role = {
  id: string;
  name: string;
  permissions: { permission: { key: string } }[];
  _count: { users: number };
};
const groups = [
  {
    title: "Digital Store",
    modules: [
      "store",
      "store-products",
      "store-categories",
      "store-coupons",
      "store-settings",
    ],
  },
  {
    title: "Content management",
    modules: [
      "pages",
      "sections",
      "portfolio",
      "services",
      "blog",
      "categories",
      "team",
      "careers",
      "testimonials",
      "faqs",
      "media",
    ],
  },
  {
    title: "Business",
    modules: ["contacts", "bookings", "clients", "subscribers"],
  },
  {
    title: "Website & system",
    modules: [
      "navigation",
      "footer",
      "locations",
      "seo",
      "settings",
      "notifications",
      "users",
      "roles",
      "logs",
      "security",
      "dashboard",
      "analytics",
    ],
  },
];
export default function RolesManager({
  permissions,
}: {
  permissions: string[];
}) {
  const [roles, setRoles] = useState<Role[] | null>(null),
    [all, setAll] = useState<string[]>([]),
    [selected, setSelected] = useState(""),
    [grants, setGrants] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/roles");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRoles(d.roles);
      setAll(d.permissions);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const role = roles?.find((r) => r.id === selected) || roles?.[0];
  useEffect(() => {
    setGrants(role?.permissions.map((p) => p.permission.key) || []);
  }, [role]);
  const editable =
    role?.name !== "Super Admin" && permissions.includes("roles:write");
  async function mutate(body: object, method: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/roles", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(method === "POST" ? "Role created" : "Permissions saved");
      setCreating(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="a-error">
        {error}
        <button onClick={load}>Retry</button>
      </div>
    );
  if (!roles) return <Skeleton />;
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Define roles and control access to admin features.</p>
        </div>
        {permissions.includes("roles:write") && (
          <button className="a-button" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Create role
          </button>
        )}
      </div>
      <div className="a-settings-grid">
        <nav className="a-section-nav">
          {roles.map((r) => (
            <button
              key={r.id}
              className={role?.id === r.id ? "active" : ""}
              onClick={() => setSelected(r.id)}
            >
              <Shield size={19} />
              <span>
                <strong>{r.name}</strong>
                <small style={{ display: "block", marginTop: 5 }}>
                  {r._count.users} members
                </small>
              </span>
            </button>
          ))}
        </nav>
        <div className="a-panel">
          <h2>{role?.name} — Permissions</h2>
          <p className="a-muted">
            Permissions are checked by the server. View, create, edit, delete
            and publish are independent operations. Super Admin access is fixed
            for account recovery.
          </p>
          <div className="a-permission-columns">
            {groups.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                {group.modules.map((module) => {
                  const keys = all.filter(
                    (k) => k.startsWith(`${module}:`) && !k.endsWith(":write"),
                  );
                  return (
                    <fieldset key={module}>
                      <legend>{module}</legend>
                      {keys.map((key) => (
                        <label key={key}>
                          <input
                            type="checkbox"
                            disabled={!editable}
                            checked={grants.includes(key)}
                            onChange={(e) =>
                              setGrants((v) =>
                                e.target.checked
                                  ? [...v, key]
                                  : v.filter((g) => g !== key),
                              )
                            }
                          />
                          {key.split(":")[1] === "read"
                            ? "View"
                            : key.split(":")[1]}
                        </label>
                      ))}
                    </fieldset>
                  );
                })}
              </section>
            ))}
          </div>
          {editable && (
            <button
              disabled={busy}
              className="a-button"
              onClick={() =>
                mutate({ id: role?.id, permissions: grants }, "PATCH")
              }
            >
              <Save size={16} />
              Save permissions
            </button>
          )}
        </div>
      </div>
      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="Create role"
      >
        <form
          className="a-form"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({ name }, "POST");
          }}
        >
          <label>
            Role name
            <input
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="a-muted">
            New roles start without permissions. Assign only the access
            required.
          </p>
          <button className="a-button" disabled={busy}>
            Create role
          </button>
        </form>
      </Drawer>
    </div>
  );
}
