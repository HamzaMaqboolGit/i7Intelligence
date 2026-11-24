import { currentAdmin } from "@/lib/access";
import AdminFrame from "@/components/admin/frame";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await currentAdmin();
  return <AdminFrame admin={admin}>{children}</AdminFrame>;
}
