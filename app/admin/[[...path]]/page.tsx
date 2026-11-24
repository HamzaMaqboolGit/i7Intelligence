import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { currentAdmin } from "@/lib/access";
import { modules } from "@/lib/cms/registry";
import Login from "@/components/admin/login";
import AdminWorkspace from "@/components/admin/workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Agency CMS",
  robots: { index: false, follow: false },
};
export default async function AdminPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const screen = path[0] || "dashboard";
  if (path.length > 1 && screen !== "store") notFound();
  if (["login", "forgot-password", "reset-password"].includes(screen))
    return (
      <Suspense>
        <Login
          mode={screen as "login" | "forgot-password" | "reset-password"}
        />
      </Suspense>
    );
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  if (
    !admin.permissions.includes(
      `${screen === "profile" ? "security" : screen}:read`,
    )
  )
    return (
      <div className="a-empty">
        <h1>Access restricted</h1>
        <p>Your role does not have permission to view this area.</p>
      </div>
    );
  if (
    !modules[screen] &&
    ![
      "profile",
      "store",
      "dashboard",
      "analytics",
      "media",
      "contacts",
      "roles",
      "seo",
      "locations",
      "navigation",
      "settings",
      "footer",
      "notifications",
      "users",
      "logs",
      "security",
    ].includes(screen)
  )
    notFound();
  return <AdminWorkspace screen={screen} path={path} admin={admin} />;
}
