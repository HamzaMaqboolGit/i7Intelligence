"use client";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import { normalizeTheme, palettes } from "@/lib/theme";
const BrandingContext = createContext({
  name: "Royal Studio",
  logo: "",
  darkLogo: "",
  language: "en",
  timezone: "UTC",
  dateFormat: "MMM d, yyyy",
  timeFormat: "12",
});
export const useBranding = () => useContext(BrandingContext);
const brand = (data: Record<string, unknown>) => ({
  name: String(data.agencyName || "Royal Studio"),
  logo: String(data.logo || ""),
  darkLogo: String(data.darkLogo || ""),
  language: String(data.language || "en"),
  timezone: String(data.timezone || "UTC"),
  dateFormat: String(data.dateFormat || "MMM d, yyyy"),
  timeFormat: String(data.timeFormat || "12"),
});
export default function ThemeProvider({
  initialSettings,
  children,
}: {
  initialSettings: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [settings, setSettings] = useState(initialSettings);
  useEffect(() => setSettings(initialSettings), [initialSettings]);
  useLayoutEffect(() => {
    const theme = normalizeTheme(
      settings,
      pathname.startsWith("/admin") ? "admin" : "website",
    );
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const root = document.documentElement;
      const p = palettes[theme.themeAccent];
      root.dataset.colorMode =
        theme.themeMode === "system"
          ? media.matches
            ? "dark"
            : "light"
          : theme.themeMode;
      root.dataset.themeAccent = theme.themeAccent;
      root.dataset.themeScope = pathname.startsWith("/admin")
        ? "admin"
        : "website";
      root.style.setProperty("--accent", p.color);
      root.style.setProperty("--accent-soft", p.soft);
    };
    const change = (event: Event) => setSettings((event as CustomEvent).detail);
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        location.pathname.startsWith("/admin")
      )
        void authClient.getSession({ query: { disableCookieCache: true } });
    };
    refresh();
    const interval = setInterval(refresh, 1000 * 60 * 20);
    document.addEventListener("visibilitychange", refresh);
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("site-theme-updated", change);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      media.removeEventListener("change", apply);
      window.removeEventListener("site-theme-updated", change);
    };
  }, [settings, pathname]);
  return (
    <BrandingContext.Provider value={brand(settings)}>
      {children}
    </BrandingContext.Provider>
  );
}
