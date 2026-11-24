import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verify } from "@node-rs/argon2";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { throttle } from "@/lib/public-requests";
import { audit } from "@/lib/cms/store";
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin("security:read", request.headers);
    return NextResponse.json({
      name: admin.name,
      email: admin.email,
      image: admin.image,
      roles: admin.roles,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("security:read", request.headers);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
        image: z.string().max(2000).nullable().optional(),
        currentPassword: z.string().max(128).optional(),
      })
      .parse(await jsonBody(request));
    if (
      input.image &&
      !/^https:\/\//.test(input.image) &&
      !/^\/media\/[a-f0-9-]+\.webp$/.test(input.image)
    )
      throw new HttpError(400, "Choose a safe HTTPS or uploaded avatar URL.");
    const email = input.email.trim().toLowerCase();
    if (email !== admin.email.toLowerCase()) {
      await prisma.$transaction((tx) =>
        throttle(tx, `profile-email:${admin.id}`),
      );
      const account = await prisma.account.findFirst({
        where: { userId: admin.id, providerId: "credential" },
      });
      if (
        !account?.password ||
        !input.currentPassword ||
        !(await verify(account.password, input.currentPassword))
      )
        throw new HttpError(
          400,
          "Confirm your current password to change your email address.",
        );
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: admin.id },
        data: { name: input.name, email, image: input.image || null },
      });
      if (email !== admin.email.toLowerCase())
        await tx.session.deleteMany({
          where: { userId: admin.id, id: { not: admin.sessionId } },
        });
      await audit(
        tx,
        admin.id,
        "updated",
        "users",
        admin.id,
        "Administrator updated their own profile; sensitive fields omitted",
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
