"use client";
import dynamic from "next/dynamic";
import type { Admin } from "@/lib/access";
import { modules } from "@/lib/cms/registry";
import { Skeleton } from "./ui";
const Dashboard = dynamic(() => import("./dashboard"), {
  loading: () => <Skeleton />,
});
const StoreAdmin = dynamic(() => import("./store"), {
  loading: () => <Skeleton />,
});
const Profile = dynamic(() => import("./profile-settings"), {
  loading: () => <Skeleton />,
});
const Manager = dynamic(() => import("./manager"), {
  loading: () => <Skeleton />,
});
const Media = dynamic(() => import("./media"), { loading: () => <Skeleton /> });
const Inbox = dynamic(() => import("./inbox"), { loading: () => <Skeleton /> });
const Roles = dynamic(() => import("./roles-manager"), {
  loading: () => <Skeleton />,
});
const Seo = dynamic(() => import("./seo-manager"), {
  loading: () => <Skeleton />,
});
const Locations = dynamic(() => import("./locations-manager"), {
  loading: () => <Skeleton />,
});
const Navigation = dynamic(() => import("./navigation-manager"), {
  loading: () => <Skeleton />,
});
const Settings = dynamic(() => import("./website-settings"), {
  loading: () => <Skeleton />,
});
const System = dynamic(() => import("./system"), {
  loading: () => <Skeleton />,
});
export default function AdminWorkspace({
  screen,
  path,
  admin,
}: {
  screen: string;
  path: string[];
  admin: Admin;
}) {
  const permissions = admin.permissions;
  if (screen === "profile") return <Profile />;
  if (screen === "store")
    return <StoreAdmin path={path.slice(1)} permissions={permissions} />;
  if (screen === "dashboard" || screen === "analytics")
    return (
      <Dashboard
        permissions={permissions}
        name={admin.name}
        analytics={screen === "analytics"}
      />
    );
  if (screen === "media") return <Media permissions={permissions} />;
  if (screen === "contacts") return <Inbox permissions={permissions} />;
  if (screen === "roles") return <Roles permissions={permissions} />;
  if (screen === "seo") return <Seo permissions={permissions} />;
  if (screen === "locations") return <Locations permissions={permissions} />;
  if (screen === "navigation") return <Navigation permissions={permissions} />;
  if (screen === "settings" || screen === "footer")
    return <Settings module={screen} permissions={permissions} />;
  if (modules[screen])
    return <Manager module={screen} permissions={permissions} />;
  return <System screen={screen} admin={admin} />;
}
