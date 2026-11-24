"use client";
import { usePathname } from "next/navigation";
import type { Admin } from "@/lib/access";
import AdminShell from "./shell";
export default function AdminFrame({
  admin,
  children,
}: {
  admin: Admin | null;
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (
    !admin ||
    /^\/admin\/(login|forgot-password|reset-password)(\/|$)/.test(path)
  )
    return children;
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
