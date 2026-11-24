import type { Metadata } from "next";
import type { CmsRecord } from "./cms/store";
export function seoMetadata(
  record: CmsRecord | undefined,
  path: string,
): Metadata {
  const d = record?.data || {};
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
  const title = d.seoTitle || record?.title;
  const description = d.seoDescription || record?.description || undefined;
  return {
    title,
    description,
    keywords: d.focusKeywords?.split(",").map((s: string) => s.trim()),
    alternates: { canonical: d.canonical || new URL(path, base).toString() },
    robots: { index: !d.noindex, follow: !d.nofollow },
    openGraph: {
      title: d.ogTitle || title,
      description: d.ogDescription || description,
      url: d.canonical || new URL(path, base).toString(),
      images: d.ogImage ? [new URL(d.ogImage, base).toString()] : undefined,
    },
    twitter: {
      card: d.twitterCard === "summary" ? "summary" : "summary_large_image",
      title: d.ogTitle || title,
      description: d.ogDescription || description,
      images: d.ogImage ? [new URL(d.ogImage, base).toString()] : undefined,
    },
  };
}
