import type { CmsRecord } from "@/lib/cms/store";
/** Client contact data is private; only explicitly approved branding is public. */
export function publicClient(record: CmsRecord): CmsRecord | null {
  if (
    record.deletedAt ||
    record.status !== "published" ||
    record.data.permission !== true
  )
    return null;
  return {
    id: record.id,
    title: record.data.company || record.title,
    slug: record.slug,
    description: null,
    status: record.status,
    sortOrder: record.sortOrder,
    data: { permission: true, image: record.data.image || "" },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: null,
  };
}
