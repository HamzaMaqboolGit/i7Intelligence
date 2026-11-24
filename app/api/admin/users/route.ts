import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { audit, notify } from "@/lib/cms/store";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("users:read", request.headers);
    return NextResponse.json({
      records: await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          disabled: true,
          twoFactorEnabled: true,
          createdAt: true,
          image: true,
          logs:{where:{action:"login"},orderBy:{createdAt:"desc"},take:1,select:{createdAt:true}},
          sessions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          roles: { include: { role: { select: { id: true, name: true } } } },
        },
      }),
      roles: await prisma.role.findMany({ select: { id: true, name: true } }),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("users:write", request.headers);
    const raw = await jsonBody(request);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email(),
        password: z.string().min(12).max(128),
        roleId: z.string(),
      })
      .safeParse(raw);
    if (!input.success)
      throw new HttpError(
        400,
        "A name, valid email, role and 12-character password are required.",
      );
    if (!(await prisma.role.findUnique({ where: { id: input.data.roleId } })))
      throw new HttpError(400, "Invalid role.");
    const id = randomUUID();
    const encoded = await hash(input.data.password, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          name: input.data.name,
          email: input.data.email.toLowerCase(),
          emailVerified: true,
          roles: { create: { roleId: input.data.roleId } },
          accounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: "credential",
              password: encoded,
            },
          },
        },
      });
      await audit(
        tx,
        admin.id,
        "created",
        "users",
        id,
        "Administrator account created",
      );
      await notify(
        tx,
        "security",
        "Administrator added",
        input.data.name,
        "/admin/users",
        "users:read",
      );
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("users:write", request.headers);
    const raw = await jsonBody(request);
    const input = z
      .object({ id: z.string(), roleId: z.string(), disabled: z.boolean() })
      .safeParse(raw);
    if (!input.success) throw new HttpError(400, "Invalid user changes.");
    if (input.data.id === admin.id)
      throw new HttpError(
        400,
        "You cannot change your own role or disable yourself.",
      );
    await prisma.$transaction(async (tx) => {
      // Lock all administrator rows so concurrent demotions cannot remove the last owner.
      await tx.$queryRaw`SELECT id FROM users ORDER BY id FOR UPDATE`;
      const target = await tx.user.findUnique({
        where: { id: input.data.id },
        include: { roles: { include: { role: true } } },
      });
      const nextRole = await tx.role.findUnique({
        where: { id: input.data.roleId },
      });
      if (!target || !nextRole)
        throw new HttpError(400, "Invalid administrator or role.");
      if (
        !target.disabled &&
        target.roles.some((r) => r.role.name === "Super Admin") &&
        (input.data.disabled || nextRole.name !== "Super Admin")
      ) {
        const owners = await tx.user.count({
          where: {
            disabled: false,
            roles: { some: { role: { name: "Super Admin" } } },
          },
        });
        if (owners <= 1)
          throw new HttpError(
            409,
            "The last active Super Admin cannot be disabled or demoted.",
          );
      }
      await tx.user.update({
        where: { id: input.data.id },
        data: { disabled: input.data.disabled },
      });
      await tx.userRole.deleteMany({ where: { userId: input.data.id } });
      await tx.userRole.create({
        data: { userId: input.data.id, roleId: input.data.roleId },
      });
      await tx.session.deleteMany({ where: { userId: input.data.id } });
      await audit(
        tx,
        admin.id,
        "updated",
        "users",
        input.data.id,
        "Account access updated; active sessions revoked",
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("users:write", request.headers);
    const raw = await jsonBody(request);
    const input = z
      .object({
        id: z.string(),
        name: z.string().trim().min(2).max(100).optional(),
        image: z.union([z.url(), z.literal("")]).optional(),
        action: z.enum(["profile", "revoke"]),
      })
      .parse(raw);
    if (input.image && !input.image.startsWith("https://"))
      throw new HttpError(400, "Avatar URL must use HTTPS.");
    await prisma.$transaction(async (tx) => {
      if (input.action === "revoke")
        await tx.session.deleteMany({ where: { userId: input.id } });
      else
        await tx.user.update({
          where: { id: input.id },
          data: { name: input.name, image: input.image || null },
        });
      await audit(
        tx,
        admin.id,
        input.action === "revoke" ? "revoked" : "updated",
        "users",
        input.id,
        input.action === "revoke"
          ? "Administrator sessions revoked"
          : "Administrator profile updated",
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
