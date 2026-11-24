import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { audit } from "@/lib/cms/store";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("navigation:edit", request.headers);
    await requireAdmin("navigation:publish", request.headers);
    const input = z
      .object({
        placement: z.enum(["header", "footer", "mobile"]),
        items: z
          .array(z.object({ id: z.string(), updatedAt: z.string().datetime() }))
          .min(1)
          .max(80),
      })
      .parse(await jsonBody(request));
    if (new Set(input.items.map((i) => i.id)).size !== input.items.length)
      throw new HttpError(400, "Duplicate menu item.");
    await prisma.$transaction(async (tx) => {
      for (const [i, item] of input.items.entries()) {
        const row = await tx.navigationItem.findFirst({
          where: { id: item.id, deletedAt: null },
        });
        if (
          !row ||
          (row.data as Record<string, string>).placement !== input.placement
        )
          throw new HttpError(400, "Menu item does not belong to this menu.");
        const result = await tx.navigationItem.updateMany({
          where: { id: item.id, updatedAt: new Date(item.updatedAt) },
          data: { sortOrder: i },
        });
        if (!result.count)
          throw new HttpError(409, "Menu changed. Refresh before reordering.");
      }
      await audit(
        tx,
        admin.id,
        "reordered",
        "navigation",
        undefined,
        "Menu order published atomically",
      );
    });
    revalidateTag("public-cms", { expire: 0 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
