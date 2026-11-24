"use client";
import PasskeySettings from "./passkey-settings";
import DateStamp from "../controls/date-stamp";
import DateTimePicker from "../controls/date-time-picker";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Plus,
  Shield,
  KeyRound,
  LogOut,
  Save,
  Search,
  Monitor,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { Admin } from "@/lib/access";
import { SelectInput, Drawer, Empty, Skeleton, Badge, Confirm } from "./ui";
/* eslint-disable @typescript-eslint/no-explicit-any -- Responses are scoped by the matching authorized system endpoint. */
export default function SystemScreen({
  screen,
  admin,
}: {
  screen: string;
  admin: Admin;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all"),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [logUser, setLogUser] = useState(""),
    [logAction, setLogAction] = useState(""),
    [logEntity, setLogEntity] = useState(""),
    [after, setAfter] = useState(""),
    [editingUser, setEditingUser] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [role, setRole] = useState<any>(null),
    [revoke, setRevoke] = useState<string | null>(null),
    [twoFactorSetup, setTwoFactorSetup] = useState<{
      totpURI: string;
      backupCodes: string[];
    } | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/${screen}?page=${page}&status=${filter}&type=${type === "all" ? "" : type}&q=${encodeURIComponent(search)}&user=${logUser}&action=${logAction}&entity=${logEntity}&after=${after}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load this page.",
      );
    }
  }, [
    screen,
    page,
    filter,
    type,
    search,
    logUser,
    logAction,
    logEntity,
    after,
  ]);
  useEffect(() => {
    load();
  }, [load]);
  async function mutate(method: string, body: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/${screen}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(success);
      await load();
      return true;
    } catch (error) {
      toast.error("Unable to complete this action", {
        description: error instanceof Error ? error.message : "",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const titles: Record<string, string> = {
    notifications: "Notifications",
    users: "Admin users",
    roles: "Roles & permissions",
    logs: "Activity logs",
    security: "Security settings",
  };
  if (error)
    return (
      <Empty
        title="Unable to load this page"
        description={error}
        action={
          <button className="a-button" onClick={load}>
            Retry
          </button>
        }
      />
    );
  if (!data) return <Skeleton />;
  return (
    <>
      <div className="a-page-heading">
        <div>
          <h1>{titles[screen]}</h1>
          <p>
            {screen === "notifications"
              ? "Your latest activity, conversations and important updates."
              : screen === "security"
                ? "Manage your password, two-factor authentication and active sessions."
                : screen === "roles"
                  ? "Control which parts of your workspace each role can access."
                  : screen === "users"
                    ? "Manage the people who can access your agency workspace."
                    : "A reliable record of changes across your agency workspace."}
          </p>
        </div>
        {screen === "notifications" && (
          <button
            className="a-button secondary"
            disabled={busy}
            onClick={() =>
              mutate("PATCH", {}, "All notifications marked as read")
            }
          >
            <Check size={16} />
            Mark all read
          </button>
        )}
        {screen === "users" && admin.permissions.includes("users:write") && (
          <button className="a-button" onClick={() => setCreating(true)}>
            <Plus size={17} />
            Add administrator
          </button>
        )}
      </div>
      {screen === "notifications" && (
        <>
          <div className="a-toolbar">
            <div className="a-tabs">
              {["all", "unread", "read"].map((f) => (
                <button
                  className={filter === f ? "active" : ""}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  key={f}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                  {f === "unread" && ` (${data.unread})`}
                </button>
              ))}
            </div>
            <SelectInput
              label="Notification type"
              value={type}
              onChange={(value) => {
                setType(value);
                setPage(1);
              }}
              options={[
                "all",
                "contact",
                "booking",
                "newsletter",
                "content",
                "media",
                "security",
                "email",
              ].map((v) => ({
                value: v,
                label:
                  v === "all" ? "All types" : v[0].toUpperCase() + v.slice(1),
              }))}
            />
          </div>
          <div className="a-notice-list">
            {data.records.length ? (
              data.records.map((r: any) => (
                <article
                  key={r.notificationId}
                  className={`a-notice-row ${!r.readAt ? "unread" : ""}`}
                >
                  <span className="a-metric-icon">
                    <Bell size={20} />
                  </span>
                  <div>
                    <h3>{r.notification.title}</h3>
                    <p>{r.notification.description}</p>
                    <DateStamp value={r.notification.createdAt} />
                  </div>
                  <button
                    className="a-icon-button danger"
                    aria-label="Delete notification"
                    onClick={() =>
                      mutate(
                        "DELETE",
                        { id: r.notificationId },
                        "Notification removed",
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                  <Link
                    className="a-button secondary small"
                    href={r.notification.href || "/admin"}
                  >
                    View details
                  </Link>
                  <button
                    className="a-icon-button"
                    aria-label={r.readAt ? "Mark unread" : "Mark read"}
                    onClick={() =>
                      mutate(
                        "PATCH",
                        { id: r.notificationId, unread: Boolean(r.readAt) },
                        r.readAt ? "Marked unread" : "Marked read",
                      )
                    }
                  >
                    <Check size={17} />
                  </button>
                </article>
              ))
            ) : (
              <div className="a-panel">
                <Empty
                  title="You’re all caught up"
                  description="New inquiries, bookings and relevant updates will appear here."
                />
              </div>
            )}
          </div>
          <div className="a-pagination">
            <span>{data.total} notifications</span>
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
                disabled={page * 15 >= data.total}
                className="a-button secondary small"
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
          <section className="a-panel">
            <h2>Notification preferences</h2>
            <p className="caption">
              Choose which future events you receive. Existing notifications
              remain available.
            </p>
            <div className="a-preferences">
              {[
                "contact",
                "booking",
                "newsletter",
                "content",
                "media",
                "security",
                "email",
              ].map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={data.preferences[key] !== false}
                    onChange={(e) =>
                      mutate(
                        "PATCH",
                        {
                          preferences: {
                            ...data.preferences,
                            [key]: e.target.checked,
                          },
                        },
                        "Preferences saved",
                      )
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
          </section>
        </>
      )}
      {screen === "users" && (
        <>
          <div className="a-toolbar">
            <label className="a-search-input">
              <Search size={17} />
              <input
                placeholder="Search administrators…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search administrators"
              />
            </label>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Two-factor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.records
                  .filter((u: any) =>
                    `${u.name} ${u.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <div className="a-table-title">
                          <span className="a-person-avatar">
                            {u.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{u.name}</strong>
                            <p>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{u.roles.map((r: any) => r.role.name).join(", ")}</td>
                      <td>
                        <Badge status={u.disabled ? "disabled" : "published"} />
                      </td>
                      <td>
                        {u.logs?.[0] ? (
                          <DateStamp value={u.logs[0].createdAt} />
                        ) : (
                          "Not recorded"
                        )}
                      </td>
                      <td>{u.twoFactorEnabled ? "Enabled" : "Not enabled"}</td>
                      <td>
                        {u.id !== admin.id &&
                          admin.permissions.includes("users:write") && (
                            <div className="a-button-row">
                              <button
                                className="a-icon-button"
                                aria-label={`Edit ${u.name}`}
                                onClick={() => setEditingUser(u)}
                              >
                                <Pencil size={16} />
                              </button>
                              <SelectInput
                                label={`Role for ${u.name}`}
                                value={u.roles[0]?.role.id || ""}
                                onChange={(roleId) =>
                                  mutate(
                                    "PATCH",
                                    { id: u.id, roleId, disabled: u.disabled },
                                    "Role updated; sessions revoked",
                                  )
                                }
                                options={data.roles.map((r: any) => ({
                                  value: r.id,
                                  label: r.name,
                                }))}
                              />
                              <button
                                className="a-button secondary small"
                                onClick={() =>
                                  mutate(
                                    "PATCH",
                                    {
                                      id: u.id,
                                      roleId: u.roles[0]?.role.id,
                                      disabled: !u.disabled,
                                    },
                                    u.disabled
                                      ? "Account enabled"
                                      : "Account disabled; sessions revoked",
                                  )
                                }
                              >
                                {u.disabled ? "Enable" : "Disable"}
                              </button>
                            </div>
                          )}
                        {u.id === admin.id && (
                          <span className="a-chip">You</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Drawer
            open={creating}
            onClose={() => setCreating(false)}
            title="Add administrator"
          >
            <form
              className="a-edit-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                if (
                  await mutate(
                    "POST",
                    Object.fromEntries(form),
                    "Administrator created",
                  )
                )
                  setCreating(false);
              }}
            >
              <div className="a-drawer-body">
                {[
                  ["name", "Full name", "text"],
                  ["email", "Email address", "email"],
                  ["password", "Initial password (12+ characters)", "password"],
                ].map(([name, label, type]) => (
                  <label className="a-field" key={name}>
                    <span>{label}</span>
                    <input
                      name={name}
                      type={type}
                      required
                      minLength={name === "password" ? 12 : 2}
                      autoComplete={
                        name === "password" ? "new-password" : "off"
                      }
                    />
                  </label>
                ))}
                <label className="a-field">
                  <span>Role</span>
                  <SelectInput
                    name="roleId"
                    label="Administrator role"
                    value={
                      role?.id ||
                      data.roles.find((r: any) => r.name === "Viewer")?.id ||
                      data.roles[0]?.id
                    }
                    onChange={(id) => setRole({ id })}
                    options={data.roles.map((r: any) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                  />
                </label>
                <p className="caption">
                  Share the initial credentials securely and ask the new
                  administrator to change their password after signing in.
                </p>
              </div>
              <div className="a-editor-footer">
                <button className="a-button" disabled={busy}>
                  Create administrator
                </button>
              </div>
            </form>
          </Drawer>
        </>
      )}
      {screen === "roles" && (
        <>
          <div className="a-record-grid">
            {data.roles.map((r: any) => (
              <section className="a-panel" key={r.id}>
                <span className="a-metric-icon">
                  <Shield />
                </span>
                <h2 style={{ marginTop: 20 }}>{r.name}</h2>
                <p className="caption">
                  {r._count.users} members · {r.permissions.length} permissions
                </p>
                <button
                  className="a-button secondary"
                  style={{ marginTop: 20 }}
                  onClick={() => setRole(structuredClone(r))}
                >
                  {r.name === "Super Admin"
                    ? "View permissions"
                    : "Manage permissions"}
                </button>
              </section>
            ))}
          </div>
          <Drawer
            open={Boolean(role)}
            onClose={() => setRole(null)}
            title={`${role?.name || "Role"} permissions`}
            wide
          >
            {role && (
              <div className="a-drawer-body">
                <p className="caption">
                  Permissions are enforced on the server for every CMS endpoint.
                  Super Admin permissions are fixed.
                </p>
                <div className="a-permission-grid">
                  {data.permissions.map((key: string) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        disabled={
                          role.name === "Super Admin" ||
                          !admin.permissions.includes("roles:write")
                        }
                        checked={role.permissions.some(
                          (p: any) => p.permission.key === key,
                        )}
                        onChange={(e) =>
                          setRole({
                            ...role,
                            permissions: e.target.checked
                              ? [...role.permissions, { permission: { key } }]
                              : role.permissions.filter(
                                  (p: any) => p.permission.key !== key,
                                ),
                          })
                        }
                      />
                      {key.replace(":", " · ")}
                    </label>
                  ))}
                </div>
                {role.name !== "Super Admin" &&
                  admin.permissions.includes("roles:write") && (
                    <button
                      className="a-button"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await mutate(
                            "PATCH",
                            {
                              id: role.id,
                              permissions: role.permissions.map(
                                (p: any) => p.permission.key,
                              ),
                            },
                            "Role permissions saved",
                          )
                        )
                          setRole(null);
                      }}
                    >
                      <Save size={16} />
                      Save permissions
                    </button>
                  )}
              </div>
            )}
          </Drawer>
        </>
      )}
      {screen === "logs" && (
        <>
          <div className="a-toolbar">
            <div className="a-search-input">
              <Search size={17} />
              <input
                aria-label="Search activity logs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search activity…"
              />
            </div>
            <SelectInput
              label="Filter administrator"
              value={logUser || "all"}
              onChange={(v) => {
                setLogUser(v === "all" ? "" : v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All users" },
                ...(data.users || []).map((u: any) => ({
                  value: u.id,
                  label: u.name,
                })),
              ]}
            />
            <SelectInput
              label="Filter activity action"
              value={logAction || "all"}
              onChange={(v) => {
                setLogAction(v === "all" ? "" : v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All actions" },
                ...(data.actions || []).map((v: string) => ({
                  value: v,
                  label: v,
                })),
              ]}
            />
            <SelectInput
              label="Filter resource"
              value={logEntity || "all"}
              onChange={(v) => {
                setLogEntity(v === "all" ? "" : v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All resources" },
                ...(data.entities || []).map((v: string) => ({
                  value: v,
                  label: v,
                })),
              ]}
            />
            <DateTimePicker
              dateOnly
              label="Activity since date"
              value={after}
              onChange={(v) => {
                setAfter(v);
                setPage(1);
              }}
            />
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Administrator</th>
                  <th>Collection</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.description}</td>
                    <td>{r.user?.name || "System"}</td>
                    <td>
                      <span className="a-chip">{r.entity}</span>
                    </td>
                    <td>{<DateStamp value={r.createdAt} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="a-pagination">
            <span>{data.total} events</span>
            <div>
              <button
                className="a-button secondary small"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>{page}</span>
              <button
                className="a-button secondary small"
                disabled={page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      <Drawer
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit administrator"
      >
        {editingUser && (
          <form
            className="a-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "PUT",
                  {
                    id: editingUser.id,
                    name: editingUser.name,
                    image: editingUser.image || "",
                    action: "profile",
                  },
                  "Administrator updated",
                )
              )
                setEditingUser(null);
            }}
          >
            <label>
              Full name
              <input
                required
                value={editingUser.name}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, name: e.target.value })
                }
              />
            </label>
            <label>
              Avatar HTTPS URL
              <input
                value={editingUser.image || ""}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, image: e.target.value })
                }
              />
            </label>
            <button className="a-button" disabled={busy}>
              Save profile
            </button>
            <button
              className="a-button secondary"
              disabled={busy}
              type="button"
              onClick={() =>
                mutate(
                  "PUT",
                  { id: editingUser.id, action: "revoke" },
                  "All user sessions revoked",
                )
              }
            >
              Revoke active sessions
            </button>
            <button
              className="a-button secondary"
              type="button"
              onClick={async () => {
                const result = await authClient.requestPasswordReset({
                  email: editingUser.email,
                  redirectTo: "/admin/reset-password",
                });
                if (result.error) toast.error("Reset request failed");
                else
                  toast.info("Reset requested", {
                    description:
                      "If delivery is configured, a reset link will be sent.",
                  });
              }}
            >
              Request password reset
            </button>
          </form>
        )}
      </Drawer>
      {screen === "security" && (
        <>
          <div className="a-security-grid">
            <section className="a-panel">
              <header>
                <h2>Change password</h2>
                <KeyRound size={20} />
              </header>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const values = new FormData(form);
                  setBusy(true);
                  const result = await authClient.changePassword({
                    currentPassword: String(values.get("currentPassword")),
                    newPassword: String(values.get("newPassword")),
                    revokeOtherSessions: true,
                  });
                  setBusy(false);
                  if (result.error)
                    toast.error("Unable to update password", {
                      description: result.error.message,
                    });
                  else {
                    toast.success("Password updated", {
                      description: "Other sessions have been revoked.",
                    });
                    form.reset();
                    await load();
                  }
                }}
              >
                <label className="a-field">
                  <span>Current password</span>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    autoComplete="current-password"
                  />
                </label>
                <label className="a-field">
                  <span>New password</span>
                  <input
                    type="password"
                    name="newPassword"
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                </label>
                <button className="a-button" disabled={busy}>
                  Update password
                </button>
              </form>
            </section>
            <section className="a-panel">
              <header>
                <h2>Two-factor authentication</h2>
                <Shield size={20} />
              </header>
              <Badge status={data.twoFactorEnabled ? "published" : "draft"} />
              <p className="caption">
                Use an authenticator app for an additional sign-in step.
                Recovery codes should be stored securely.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const password = String(
                    new FormData(e.currentTarget).get("password"),
                  );
                  setBusy(true);
                  const result = data.twoFactorEnabled
                    ? await authClient.twoFactor.disable({ password })
                    : await authClient.twoFactor.enable({ password });
                  setBusy(false);
                  if (result.error)
                    toast.error("Unable to update two-factor authentication", {
                      description: result.error.message,
                    });
                  else {
                    if (
                      !data.twoFactorEnabled &&
                      result.data &&
                      "totpURI" in result.data
                    )
                      setTwoFactorSetup(
                        result.data as {
                          totpURI: string;
                          backupCodes: string[];
                        },
                      );
                    else toast.success("Two-factor authentication disabled");
                    await load();
                  }
                }}
              >
                <label className="a-field">
                  <span>Confirm your password</span>
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                  />
                </label>
                <button className="a-button secondary" disabled={busy}>
                  {data.twoFactorEnabled ? "Disable" : "Set up"} two-factor
                  authentication
                </button>
              </form>
            </section>
          </div>
          <PasskeySettings />
          <section className="a-panel" style={{ marginTop: 24 }}>
            <header>
              <h2>Active sessions</h2>
              <Monitor size={20} />
            </header>
            {data.sessions.map((s: any) => (
              <div key={s.id} className="a-session">
                <span className="a-metric-icon">
                  <Monitor size={20} />
                </span>
                <div>
                  <strong>
                    {s.id === data.currentSessionId
                      ? "This device"
                      : "Other device"}
                  </strong>
                  <p>{s.userAgent || "Browser session"}</p>
                  <small>Expires {<DateStamp value={s.expiresAt} />}</small>
                </div>
                <button
                  className="a-button secondary small"
                  onClick={() => setRevoke(s.id)}
                >
                  <LogOut size={15} />
                  Revoke session
                </button>
              </div>
            ))}
          </section>
          <section className="a-panel" style={{ marginTop: 24 }}>
            <h2>Password recovery delivery</h2>
            <p className="caption">
              {data.resetDeliveryConfigured
                ? "SMTP delivery is configured."
                : "SMTP is not configured. Local development reset messages are saved privately to .local-mails. Production delivery requires SMTP configuration."}
            </p>
          </section>
          <Drawer
            open={Boolean(twoFactorSetup)}
            onClose={() => setTwoFactorSetup(null)}
            title="Set up your authenticator"
          >
            {twoFactorSetup && (
              <div className="a-drawer-body">
                <p>
                  Import this setup URI into your authenticator app, then enter
                  the generated code.
                </p>
                <textarea
                  readOnly
                  className="a-totp-uri"
                  value={twoFactorSetup.totpURI}
                  style={{
                    width: "100%",
                    marginTop: 20,
                    padding: 15,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                  }}
                />
                <button
                  className="a-button secondary small"
                  onClick={async () => {
                    await navigator.clipboard.writeText(twoFactorSetup.totpURI);
                    toast.success("Setup URI copied");
                  }}
                >
                  <Copy size={15} />
                  Copy setup URI
                </button>
                <h3 style={{ marginTop: 25 }}>Recovery codes</h3>
                <p className="caption">
                  Save these somewhere safe. Each code can be used once.
                </p>
                <pre
                  style={{
                    padding: 20,
                    background: "var(--background)",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                >
                  {twoFactorSetup.backupCodes.join("\n")}
                </pre>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const code = String(
                      new FormData(e.currentTarget).get("code"),
                    );
                    const result = await authClient.twoFactor.verifyTotp({
                      code,
                    });
                    if (result.error)
                      toast.error("Invalid code", {
                        description: result.error.message,
                      });
                    else {
                      toast.success("Two-factor authentication enabled");
                      setTwoFactorSetup(null);
                      await load();
                    }
                  }}
                >
                  <label className="a-field">
                    <span>Six-digit code</span>
                    <input
                      name="code"
                      required
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button className="a-button">Verify & enable</button>
                </form>
              </div>
            )}
          </Drawer>
          <Confirm
            open={Boolean(revoke)}
            onClose={() => setRevoke(null)}
            onConfirm={async () => {
              if (await mutate("DELETE", { id: revoke }, "Session revoked")) {
                if (revoke === data.currentSessionId)
                  location.href = "/admin/login";
                setRevoke(null);
              }
            }}
            title="Revoke this session?"
            description="The device will need to sign in again. Revoking this device will sign you out."
            busy={busy}
          />
        </>
      )}
    </>
  );
}
