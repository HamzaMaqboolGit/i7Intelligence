import { ownedOrders } from "@/lib/store/orders";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { digest } from "@/lib/store/cart";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const raw = await jsonBody(request, 3000);
    const hasToken =
      typeof raw.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(raw.token);
    const owner = await ownedOrders(request);
    if (
      !hasToken &&
      (!owner.OR.length || typeof raw.entitlementId !== "string")
    )
      throw new HttpError(403, "Download access is invalid.");
    const entitlement = await prisma.storeEntitlement.findFirst({
      where: hasToken
        ? { tokenHash: digest(raw.token) }
        : { id: raw.entitlementId, item: { order: owner } },
      include: { file: true, item: { include: { order: true } } },
    });
    if (
      !entitlement ||
      entitlement.revokedAt ||
      entitlement.item.order.paymentStatus !== "paid"
    )
      throw new HttpError(403, "Download access is unavailable.");
    if (entitlement.expiresAt <= new Date())
      throw new HttpError(
        410,
        "This download link has expired. Contact support.",
      );
    if (!/^[a-f0-9-]+\.(zip|pdf)$/.test(entitlement.file.storageKey))
      throw new HttpError(403, "Invalid storage reference.");
    const directory = path.resolve(
      /* turbopackIgnore: true */
      process.env.STORE_FILE_DIRECTORY || "storage/store-private",
    );
    const file = await readFile(
      /* turbopackIgnore: true */
      path.join(
        /* turbopackIgnore: true */ directory,
        entitlement.file.storageKey,
      ),
    );
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.storeEntitlement.updateMany({
        where: {
          id: entitlement.id,
          item: { order: { paymentStatus: "paid" } },
          used: { lt: entitlement.maximum },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { used: { increment: 1 } },
      });
      if (!claimed.count)
        throw new HttpError(410, "Download limit reached or access expired.");
      await tx.storeDownloadEvent.create({
        data: { entitlementId: entitlement.id },
      });
      await tx.storeOrderEvent.create({
        data: {
          orderId: entitlement.item.orderId,
          action: "downloaded",
          description: "Authorized digital download accessed",
        },
      });
    });
    return new NextResponse(file, {
      headers: {
        "Content-Type": entitlement.file.mime,
        "Content-Disposition": `attachment; filename="download.${entitlement.file.mime === "application/zip" ? "zip" : "pdf"}"; filename*=UTF-8''${encodeURIComponent(entitlement.file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
