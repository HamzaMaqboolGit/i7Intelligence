import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams,
      q = (p.get("q") || "").slice(0, 100),
      category = p.get("category"),
      kind = p.get("kind");
    const rows = await prisma.storeProduct.findMany({
      where: {
        status: "published",
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { sortOrder: "asc" },
    });
    const filtered = rows.filter((r) => {
      const d = r.data as Record<string, unknown>;
      return (
        (!category || d.category === category) && (!kind || d.kind === kind)
      );
    });
    return NextResponse.json({
      records: filtered,
      categories: await prisma.storeCategory.findMany({
        where: { status: "published", deletedAt: null },
        orderBy: { sortOrder: "asc" },
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
