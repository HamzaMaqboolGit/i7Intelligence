import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin("notifications:read", request.headers);
    const p = request.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page")) || 1),
      size = Math.min(30, Math.max(1, Number(p.get("size")) || 15));
    const where = {
      userId: user.id,
      ...(p.get("status") === "unread"
        ? { readAt: null }
        : p.get("status") === "read"
          ? { readAt: { not: null } }
          : {}),
      ...(p.get("type") ? { notification: { type: p.get("type")! } } : {}),
    };
    const [records, total, unread, preferences, contactUnread] =
      await Promise.all([
        prisma.notificationReceipt.findMany({
          where,
          include: { notification: true },
          orderBy: { notification: { createdAt: "desc" } },
          skip: (page - 1) * size,
          take: size,
        }),
        prisma.notificationReceipt.count({ where }),
        prisma.notificationReceipt.count({
          where: { userId: user.id, readAt: null },
        }),
        prisma.notificationPreference.findUnique({
          where: { userId: user.id },
        }),
        user.permissions.includes("contacts:read")
          ? prisma.contactMessage.count({
              where: { status: "unread", deletedAt: null },
            })
          : 0,
      ]);
    return NextResponse.json({
      records,
      total,
      unread,
      contactUnread,
      preferences: preferences?.data || {},
      page,
      size,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request);
    const user = await requireAdmin("notifications:read", request.headers);
    const raw = await jsonBody(request);
    if (raw.preferences) {
      const allowed = [
        "contact",
        "booking",
        "newsletter",
        "content",
        "media",
        "security",
        "email",
      ];
      const data = Object.fromEntries(
        allowed.map((k) => [k, raw.preferences[k] !== false]),
      );
      await prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: { data },
        create: { userId: user.id, data },
      });
    } else {
      if (raw.id && typeof raw.id !== "string")
        throw new HttpError(400, "Invalid notification.");
      await prisma.notificationReceipt.updateMany({
        where: {
          userId: user.id,
          ...(raw.id ? { notificationId: raw.id } : {}),
        },
        data: { readAt: raw.unread ? null : new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    checkOrigin(request);
    const user = await requireAdmin("notifications:read", request.headers);
    const raw = await jsonBody(request);
    if (typeof raw.id !== "string")
      throw new HttpError(400, "Select a notification.");
    await prisma.notificationReceipt.deleteMany({
      where: { notificationId: raw.id, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
