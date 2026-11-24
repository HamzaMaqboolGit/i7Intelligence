import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("logs:read", request.headers);
    const page = Math.max(
      1,
      Number(request.nextUrl.searchParams.get("page")) || 1,
    );
    const q = (request.nextUrl.searchParams.get("q") || "").slice(0, 100);
    const params = request.nextUrl.searchParams;
    const after = params.get("after");
    const where = {
      ...(q ? { description: { contains: q } } : {}),
      ...(params.get("user") ? { userId: params.get("user")! } : {}),
      ...(params.get("action") ? { action: params.get("action")! } : {}),
      ...(params.get("entity") ? { entity: params.get("entity")! } : {}),
      ...(after && Number.isFinite(Date.parse(after))
        ? { createdAt: { gte: new Date(after) } }
        : {}),
    };
    const [records, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { name: true } } },
        take: 20,
        skip: (page - 1) * 20,
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count({ where }),
    ]);
    const [users, actions, entities] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.activityLog.findMany({
        distinct: ["action"],
        select: { action: true },
      }),
      prisma.activityLog.findMany({
        distinct: ["entity"],
        select: { entity: true },
      }),
    ]);
    return NextResponse.json({
      records,
      total,
      page,
      users,
      actions: actions.map((a) => a.action),
      entities: entities.map((a) => a.entity),
    });
  } catch (error) {
    return apiError(error);
  }
}
