import "./store.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Providers from "@/components/providers";
import "./admin.css";
import "./globals.css";
import "./theme.css";
import { getPublicSettings } from "@/lib/cms/site-settings";
import { normalizeTheme, palettes } from "@/lib/theme";
import ThemeProvider from "@/components/theme-provider";
const syne = localFont({
  src: "./fonts/syne-latin.woff2",
  weight: "400 800",
  variable: "--font-display",
  display: "swap",
});
const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  weight: "200 800",
  variable: "--font-body",
  display: "swap",
});
// Branding and themes come from live CMS settings, including the 404 layout.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Royal Studio — Thoughtful design. Lasting impact.",
    template: "%s — Royal Studio",
  },
  description:
    "Independent digital design and development. We turn ambitious ideas into distinctive brands and thoughtful websites.",
  openGraph: { type: "website", siteName: "Royal Studio" },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPublicSettings();
  const theme = normalizeTheme(settings);
  const palette = palettes[theme.themeAccent];
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-color-mode={theme.themeMode}
      style={
        {
          "--accent": palette.color,
          "--accent-soft": palette.soft,
        } as React.CSSProperties
      }
      data-scroll-behavior="smooth"
      className={`${syne.variable} ${manrope.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ThemeProvider initialSettings={settings}>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
