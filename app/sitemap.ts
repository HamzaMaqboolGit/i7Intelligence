import type { MetadataRoute } from "next";
import { getSiteSnapshot } from "@/lib/cms/public";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSiteSnapshot();
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
  return [
    ...data.pages.map((p) => ({
      url: `${base}/${p.slug === "home" ? "" : p.slug}`,
    })),
    ...data.portfolio.map((p) => ({ url: `${base}/portfolio/${p.slug}` })),
    ...data.blog.map((p) => ({ url: `${base}/blog/${p.slug}` })),
  ];
}
