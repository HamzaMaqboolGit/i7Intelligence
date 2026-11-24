"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { User, Save, Shield } from "lucide-react";
import Link from "next/link";
import { ImagePicker } from "./fields";
import { Skeleton } from "./ui";
export default function ProfileSettings() {
  const router = useRouter();
  const [data, setData] = useState<{
      name: string;
      email: string;
      image: string;
      roles: string[];
    } | null>(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/admin/profile")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <p role="alert" className="a-error">
        {error}
      </p>
    );
  if (!data) return <Skeleton />;
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Settings</h1>
          <p>Edit your administrator profile and account details.</p>
        </div>
      </div>
      <div className="a-security-grid">
        <form
          className="a-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fetch("/api/admin/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, currentPassword: password }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setPassword("");
              toast.success("Profile updated");
              router.refresh();
            } catch (e) {
              toast.error("Unable to save profile", {
                description: (e as Error).message,
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            <User size={21} />
            Administrator details
          </h2>
          <label className="a-field">
            Full name
            <input
              required
              minLength={2}
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </label>
          <label className="a-field">
            Email address
            <input
              type="email"
              required
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </label>
          <h3>Profile image</h3>
          <ImagePicker
            label="Profile image"
            value={data.image || ""}
            onChange={(image) => setData({ ...data, image })}
          />
          <label className="a-field">
            Current password (required for email changes)
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="a-button" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
        <section className="a-panel">
          <h2>
            <Shield size={21} />
            Account security
          </h2>
          <p className="a-muted">
            Role: {data.roles.join(", ")}. Changing your email revokes sessions
            on your other devices.
          </p>
          <Link className="a-button secondary" href="/admin/security">
            Password, MFA & sessions
          </Link>
        </section>
      </div>
    </div>
  );
}
