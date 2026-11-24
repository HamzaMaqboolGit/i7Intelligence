"use client";
import { createContext, useContext } from "react";
import type { SiteSnapshot } from "@/lib/cms/public";
const Context = createContext<SiteSnapshot>({});
export function SiteProvider({
  data,
  children,
}: {
  data: SiteSnapshot;
  children: React.ReactNode;
}) {
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
export function useSite() {
  return useContext(Context);
}
