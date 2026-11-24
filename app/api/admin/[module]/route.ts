import { queueTemplate } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { modules } from "@/lib/cms/registry";
import {
  delegate,
  validateRecord,
  audit,
  notify,
  serialize,
  syncRelations,
} from "@/lib/cms/store";
import { prisma } from "@/lib/prisma";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { revalidatePath, revalidateTag } from "next/cache";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
    const { module } = await params;
    await requireAdmin(`${module}:read`, request.headers);
    const config = modules[module];
    if (!config) throw new HttpError(404, "Unknown collection.");
    const p = request.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page")) || 1);
    const size = Math.min(50, Math.max(1, Number(p.get("size")) || 12));
    const query = (p.get("q") || "").slice(0, 200);
    const status = p.get("status");
    const sort = ["title", "sortOrder", "updatedAt", "createdAt"].includes(
      p.get("sort") || "",
    )
      ? p.get("sort")!
      : "sortOrder";
    const where = {
      deletedAt: null,
      ...(p.get("id") ? { id: p.get("id") } : {}),
      ...(config.singleton ? { slug: config.singleton } : {}),
      ...(status && config.statuses.includes(status) ? { status } : {}),
      AND: [
        ...(p.get("category")
          ? [{ data: { path: "$.category", equals: p.get("category") } }]
          : []),
        ...(p.get("author")
          ? [{ data: { path: "$.author", equals: p.get("author") } }]
          : []),
      ],
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { description: { contains: query } },
              { slug: { contains: query } },
              ...[
                "name",
                "email",
                "author",
                "category",
                ...(module === "clients"
                  ? ["company", "phone", "contactName", "city"]
                  : []),
              ].map((key) => ({
                data: { path: `$.${key}`, string_contains: query },
              })),
            ],
          }
        : {}),
    };
    const [records, total, totalAll, published, drafts, facetRows] =
      await Promise.all([
        delegate(module).findMany({
          where,
          orderBy: {
            [sort]:
              sort === "updatedAt" || sort === "createdAt" ? "desc" : "asc",
          },
          skip: (page - 1) * size,
          take: size,
        }),
        delegate(module).count({ where }),
        delegate(module).count({
          where: {
            deletedAt: null,
            ...(config.singleton ? { slug: config.singleton } : {}),
          },
        }),
        delegate(module).count({
          where: {
            deletedAt: null,
            status: config.statuses.includes("published")
              ? "published"
              : config.statuses[1],
            ...(config.singleton ? { slug: config.singleton } : {}),
          },
        }),
        delegate(module).count({
          where: {
            deletedAt: null,
            status: config.statuses[0],
            ...(config.singleton ? { slug: config.singleton } : {}),
          },
        }),
        delegate(module).findMany({
          where: {
            deletedAt: null,
            ...(config.singleton ? { slug: config.singleton } : {}),
          },
          select: { data: true },
        }),
      ]);
    return NextResponse.json(
      serialize({
        records,
        total,
        page,
        size,
        stats: { total: totalAll, published, drafts },
        facets: {
          categories: [
            ...new Set(
              facetRows
                .map((r: { data: Record<string, unknown> }) => r.data.category)
                .filter(Boolean),
            ),
          ],
          authors: [
            ...new Set(
              facetRows
                .map((r: { data: Record<string, unknown> }) => r.data.author)
                .filter(Boolean),
            ),
          ],
        },
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
    checkOrigin(request);
    const { module } = await params;
    const admin = await requireAdmin(`${module}:create`, request.headers);
    if (module === "media")
      throw new HttpError(400, "Use the image upload action.");
    const raw = await jsonBody(request);
    const value = validateRecord(module, raw);
    if (
      value.status === "published" &&
      !admin.permissions.includes(`${module}:publish`)
    )
      throw new HttpError(
        403,
        "You do not have permission to publish this content.",
      );
    const result = await prisma.$transaction(async (tx) => {
      const row = await delegate(module, tx).create({ data: value });
      if (
        module === "locations" &&
        (value.data as Record<string, unknown>).primary
      ) {
        const others = await tx.location.findMany({
          where: { id: { not: row.id }, deletedAt: null },
        });
        for (const location of others) {
          const data = location.data as Record<string, unknown>;
          if (data.primary)
            await tx.location.update({
              where: { id: location.id },
              data: {
                data: { ...data, primary: false } as Prisma.InputJsonValue,
              },
            });
        }
      }
      await syncRelations(tx, module, row);
      await audit(
        tx,
        admin.id,
        "created",
        module,
        row.id,
        `${modules[module].singular} created: ${row.title}`,
      );
      if (row.status === "published")
        await notify(
          tx,
          "content",
          `${modules[module].singular} published`,
          row.title,
          `/admin/${module}`,
          `${module}:read`,
        );
      return delegate(module, tx).findUnique({ where: { id: row.id } });
    });
    revalidateTag("public-cms", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json(serialize(result), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
    checkOrigin(request);
    const { module } = await params;
    const admin = await requireAdmin(`${module}:edit`, request.headers);
    const raw = await jsonBody(request);
    if (typeof raw.id !== "string") throw new HttpError(400, "Missing record.");
    const result = await prisma.$transaction(async (tx) => {
      const old = await delegate(module, tx).findFirst({
        where: {
          id: raw.id,
          deletedAt: null,
          ...(modules[module].singleton
            ? { slug: modules[module].singleton }
            : {}),
        },
      });
      if (!old) throw new HttpError(404, "Record not found.");
      if (
        raw.updatedAt &&
        new Date(raw.updatedAt).getTime() !== old.updatedAt.getTime()
      )
        throw new HttpError(
          409,
          "This record changed. Refresh it before saving.",
        );
      const value = validateRecord(module, raw);
      if (
        value.status === "published" &&
        !admin.permissions.includes(`${module}:publish`)
      )
        throw new HttpError(
          403,
          "You do not have permission to publish this content.",
        );
      if (module === "bookings" && old.status !== value.status) {
        const transitions: Record<string, string[]> = {
          pending: ["confirmed", "cancelled"],
          confirmed: ["completed", "cancelled"],
          completed: [],
          cancelled: [],
        };
        if (!transitions[old.status]?.includes(value.status))
          throw new HttpError(
            400,
            "That booking status transition is not allowed.",
          );
      }
      if (module === "media")
        value.data = {
          ...(old.data as object),
          ...(value.data as object),
        } as Prisma.InputJsonValue;
      const row = await delegate(module, tx).update({
        where: { id: raw.id },
        data: value,
      });
      if (
        module === "locations" &&
        (value.data as Record<string, unknown>).primary
      ) {
        const others = await tx.location.findMany({
          where: { id: { not: row.id }, deletedAt: null },
        });
        for (const location of others) {
          const data = location.data as Record<string, unknown>;
          if (data.primary)
            await tx.location.update({
              where: { id: location.id },
              data: {
                data: { ...data, primary: false } as Prisma.InputJsonValue,
              },
            });
        }
      }
      await syncRelations(tx, module, row);
      await audit(
        tx,
        admin.id,
        "updated",
        module,
        row.id,
        `${modules[module].singular} updated: ${row.title}`,
      );
      if (
        module === "bookings" &&
        old.status !== row.status &&
        ["confirmed", "cancelled"].includes(row.status)
      ) {
        const data = row.data as Record<string, string>;
        await queueTemplate(
          tx,
          `booking-status:${row.id}:${row.status}`,
          data.email,
          `booking_${row.status}`,
          {
            customer_name: data.name,
            booking_date: data.requestedAt,
            company_name: "Our studio",
          },
        );
      }
      if (row.status === "published" && old.status !== "published")
        await notify(
          tx,
          "content",
          `${modules[module].singular} published`,
          row.title,
          `/admin/${module}`,
          `${module}:read`,
        );
      return delegate(module, tx).findUnique({ where: { id: row.id } });
    });
    revalidateTag("public-cms", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json(serialize(result));
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
    checkOrigin(request);
    const { module } = await params;
    const admin = await requireAdmin(`${module}:delete`, request.headers);
    const raw = await jsonBody(request);
    const ids = Array.isArray(raw.ids) ? raw.ids : [raw.id];
    if (
      !ids.length ||
      ids.length > 50 ||
      !ids.every((id: unknown) => typeof id === "string")
    )
      throw new HttpError(400, "Select valid records.");
    if (modules[module].singleton)
      throw new HttpError(400, "Settings cannot be deleted.");
    await prisma.$transaction(async (tx) => {
      await delegate(module, tx).updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date(), status: "archived" },
      });
      await audit(
        tx,
        admin.id,
        "deleted",
        module,
        ids.join(","),
        `${ids.length} ${modules[module].label.toLowerCase()} moved to trash`,
      );
    });
    revalidateTag("public-cms", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
