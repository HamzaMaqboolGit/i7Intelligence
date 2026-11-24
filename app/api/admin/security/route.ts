import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { audit } from "@/lib/cms/store";
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin("security:read", request.headers);
    const sessions = await prisma.session.findMany({
      where: { userId: admin.id, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ipAddress: true,
      },
    });
    return NextResponse.json({
      sessions,
      currentSessionId: admin.sessionId,
      twoFactorEnabled: admin.twoFactorEnabled,
      email: admin.email,
      resetDeliveryConfigured: Boolean(process.env.SMTP_HOST),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("security:read", request.headers);
    const raw = await jsonBody(request);
    if (typeof raw.id !== "string")
      throw new HttpError(400, "Invalid session.");
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { id: raw.id, userId: admin.id } });
      await audit(
        tx,
        admin.id,
        "revoked",
        "sessions",
        raw.id,
        "Session revoked",
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
