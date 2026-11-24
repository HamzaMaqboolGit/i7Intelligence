import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
export const getPublicSettings = unstable_cache(
  async () => {
    const row = await prisma.siteSetting.findUnique({
      where: { slug: "general", status: "published", deletedAt: null },
      select: { data: true },
    });
    return (row?.data || {}) as Record<string, unknown>;
  },
  ["public-site-settings-v1"],
  { tags: ["public-cms"], revalidate: 30 },
);
