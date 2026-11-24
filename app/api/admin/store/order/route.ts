import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { audit } from "@/lib/cms/store";
import { token, digest } from "@/lib/store/cart";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("store:read", request.headers);
    const id = request.nextUrl.searchParams.get("id") || "";
    const order = await prisma.storeOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            entitlements: {
              select: {
                id: true,
                expiresAt: true,
                used: true,
                maximum: true,
                revokedAt: true,
                file: { select: { name: true, version: true } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: "asc" } },
        refunds: true,
      },
    });
    if (!order) throw new HttpError(404, "Order not found.");
    const emails = await prisma.emailOutbox.findMany({
      where: { key: { startsWith: `order:${id}:` } },
      select: {
        id: true,
        recipient: true,
        subject: true,
        status: true,
        lastError: true,
        createdAt: true,
        acceptedAt: true,
      },
    });
    const { accessHash: _accessHash, ...safe } = order;
    return NextResponse.json({ order: safe, emails });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("store:write", request.headers);
    const input = z
      .object({
        id: z.string(),
        action: z.enum(["service-status", "note", "resend", "revoke"]),
        itemId: z.string().optional(),
        entitlementId: z.string().optional(),
        body: z.string().max(10000).optional(),
        status: z
          .enum([
            "pending",
            "awaiting-requirements",
            "in-progress",
            "awaiting-review",
            "completed",
            "cancelled",
          ])
          .optional(),
        requestId: z.string().uuid().optional(),
      })
      .parse(await jsonBody(request));
    await prisma.$transaction(async (tx) => {
      const order = await tx.storeOrder.findUnique({
        where: { id: input.id },
        include: { customer: true, items: true },
      });
      if (!order) throw new HttpError(404, "Order not found.");
      if (input.action === "service-status") {
        if (order.paymentStatus !== "paid")
          throw new HttpError(
            409,
            "Service fulfillment requires confirmed payment.",
          );
        const item = order.items.find(
          (i) => i.id === input.itemId && i.kind === "service",
        );
        if (!item || !input.status)
          throw new HttpError(400, "Choose a service item and status.");
        const allowed: Record<string, string[]> = {
          pending: ["awaiting-requirements", "in-progress", "cancelled"],
          "awaiting-requirements": ["in-progress", "cancelled"],
          "in-progress": ["awaiting-review", "cancelled"],
          "awaiting-review": ["in-progress", "completed", "cancelled"],
          completed: [],
          cancelled: [],
        };
        if (!allowed[item.serviceStatus]?.includes(input.status))
          throw new HttpError(
            409,
            "That service status transition is not allowed.",
          );
        await tx.storeOrderItem.update({
          where: { id: item.id },
          data: { serviceStatus: input.status },
        });
      }
      if (input.action === "note") {
        if (!input.body?.trim())
          throw new HttpError(400, "Write an internal note.");
        const item = order.items.find((i) => i.id === input.itemId);
        if (!item) throw new HttpError(400, "Select an order item.");
        await tx.storeOrderItem.update({
          where: { id: item.id },
          data: { notes: input.body },
        });
      }
      if (input.action === "revoke") {
        if (!input.entitlementId)
          throw new HttpError(400, "Select an entitlement.");
        await tx.storeEntitlement.updateMany({
          where: { id: input.entitlementId, item: { orderId: order.id } },
          data: { revokedAt: new Date() },
        });
      }
      if (input.action === "resend") {
        if (order.paymentStatus !== "paid" || !input.requestId)
          throw new HttpError(
            409,
            "A paid order and unique request reference are required.",
          );
        const key = `order:${order.id}:resend:${input.requestId}`;
        const existing = await tx.emailOutbox.findUnique({ where: { key } });
        if (!existing) {
          const access = token();
          await tx.storeOrder.update({
            where: { id: order.id },
            data: { accessHash: digest(access) },
          });
          const base =
            process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
          const url = `${base}/order/${order.reference}#token=${access}`;
          await tx.emailOutbox.create({
            data: {
              key,
              recipient: order.customer.email,
              subject: `Your order is ready · ${order.reference}`,
              html: `<p>Your order ${order.reference} is ready.</p><p><a href="${url}">Open your secure order and downloads</a></p><p>Product-specific expiration and download limits apply.</p>`,
              messageId: `<${randomUUID()}@agency.local>`,
              template: "order_delivery",
            },
          });
        }
      }
      await tx.storeOrderEvent.create({
        data: {
          orderId: order.id,
          action: input.action,
          description:
            input.action === "resend"
              ? "Order email queued; secure order access link rotated"
              : input.action === "note"
                ? "Internal note updated"
                : input.action === "revoke"
                  ? "Download access revoked"
                  : `Service status updated to ${input.status}`,
        },
      });
      await audit(
        tx,
        admin.id,
        input.action,
        "store-orders",
        order.id,
        "Order management action completed; private contents omitted",
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
