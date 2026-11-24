import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { permissionKeys } from "@/lib/cms/registry";
import { audit } from "@/lib/cms/store";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("roles:read", request.headers);
    return NextResponse.json({
      roles: await prisma.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      }),
      permissions: permissionKeys,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("roles:write", request.headers);
    const raw = await jsonBody(request);
    if (
      !Array.isArray(raw.permissions) ||
      !raw.permissions.every((key: string) => permissionKeys.includes(key))
    )
      throw new HttpError(400, "Invalid permission list.");
    const role = await prisma.role.findUnique({ where: { id: raw.id } });
    if (!role || role.name === "Super Admin")
      throw new HttpError(
        400,
        "The Super Admin role is fixed to preserve account recovery.",
      );
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      const permissions = await tx.permission.findMany({
        where: {
          key: {
            in: [
              ...raw.permissions,
              ...[
                ...new Set(
                  (raw.permissions as string[])
                    .filter((k) => /:create$|:edit$|:publish$/.test(k))
                    .map((k) => `${k.split(":")[0]}:write`),
                ),
              ],
            ],
          },
        },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
      await audit(
        tx,
        admin.id,
        "updated",
        "roles",
        role.id,
        `Permissions updated for ${role.name}`,
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("roles:write", request.headers);
    const raw = await jsonBody(request);
    if (
      typeof raw.name !== "string" ||
      raw.name.trim().length < 2 ||
      raw.name.length > 60
    )
      throw new HttpError(
        400,
        "Enter a role name between 2 and 60 characters.",
      );
    const role = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { name: raw.name.trim() } });
      await audit(
        tx,
        admin.id,
        "created",
        "roles",
        role.id,
        "Custom role created with no permissions",
      );
      return role;
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
