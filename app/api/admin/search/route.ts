import { NextRequest, NextResponse } from "next/server";
import { currentAdmin, HttpError } from "@/lib/access";
import { modules } from "@/lib/cms/registry";
import { delegate } from "@/lib/cms/store";
import { apiError } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    const admin = await currentAdmin(request.headers);
    if (!admin) throw new HttpError(401, "Please sign in.");
    const q = (request.nextUrl.searchParams.get("q") || "").slice(0, 100);
    if (!q) return NextResponse.json({ results: [] });
    const results = (
      await Promise.all(
        Object.entries(modules)
          .filter(([key]) => admin.permissions.includes(`${key}:read`))
          .map(async ([key, config]) => {
            const records = await delegate(key).findMany({
              where: {
                deletedAt: null,
                OR: [
                  { title: { contains: q } },
                  ...["name", "email"].map((field) => ({
                    data: { path: `$.${field}`, string_contains: q },
                  })),
                ],
                ...(config.singleton ? { slug: config.singleton } : {}),
              },
              take: 3,
              select: { id: true, title: true },
            });
            return records.map((r: { title: string; id: string }) => ({
              title: r.title,
              href: `/admin/${key}?edit=${r.id}`,
              group: config.label,
            }));
          }),
      )
    )
      .flat()
      .slice(0, 20);
    return NextResponse.json({ results });
  } catch (error) {
    return apiError(error);
  }
}
