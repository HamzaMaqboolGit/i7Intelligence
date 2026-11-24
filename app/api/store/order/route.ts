import { ownedOrders } from "@/lib/store/orders";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { digest } from "@/lib/store/cart";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { notify } from "@/lib/cms/store";
export async function GET(request: NextRequest) {
  try {
    const where = await ownedOrders(request);
    if (!where.OR.length) return NextResponse.json({ orders: [] });
    const reference = request.nextUrl.searchParams.get("reference");
    const orders = await prisma.storeOrder.findMany({
      where: { ...where, ...(reference ? { reference } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        reference: true,
        currency: true,
        subtotal: true,
        discount: true,
        tax: true,
        billing: true,
        total: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            title: true,
            kind: true,
            quantity: true,
            unitAmount: true,
            serviceStatus: true,
            requirements: true,
            entitlements: {
              select: {
                id: true,
                expiresAt: true,
                maximum: true,
                used: true,
                revokedAt: true,
                file: { select: { name: true, version: true } },
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
          select: { action: true, description: true, createdAt: true },
        },
      },
    });
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const raw = await jsonBody(request, 15000);
    if (raw.action === "authorize") {
      if (
        typeof raw.token !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(raw.token)
      )
        throw new HttpError(403, "Invalid order access.");
      const order = await prisma.storeOrder.findUnique({
        where: { accessHash: digest(raw.token) },
        select: { id: true },
      });
      if (!order) throw new HttpError(403, "Invalid order access.");
      const response = NextResponse.json({ ok: true });
      response.cookies.set("store_order", raw.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.BETTER_AUTH_URL?.startsWith("https://"),
        path: "/",
        maxAge: 3600,
      });
      return response;
    }
    if (raw.action === "requirements") {
      if (
        typeof raw.itemId !== "string" ||
        typeof raw.body !== "string" ||
        raw.body.length < 10 ||
        raw.body.length > 10000
      )
        throw new HttpError(
          400,
          "Provide project requirements between 10 and 10,000 characters.",
        );
      const where = await ownedOrders(request);
      if (!where.OR.length) throw new HttpError(403, "Order access required.");
      await prisma.$transaction(async (tx) => {
        const item = await tx.storeOrderItem.findFirst({
          where: {
            id: raw.itemId,
            kind: "service",
            order: { ...where, paymentStatus: "paid" },
          },
        });
        if (!item)
          throw new HttpError(403, "Paid service order access required.");
        await tx.storeOrderItem.update({
          where: { id: item.id },
          data: {
            requirements: raw.body,
            serviceStatus: "awaiting-requirements",
          },
        });
        await tx.storeOrderEvent.create({
          data: {
            orderId: item.orderId,
            action: "requirements",
            description: "Customer project requirements submitted",
          },
        });
        await notify(
          tx,
          "store",
          "Service requirements received",
          item.title,
          `/admin/store/orders/${item.orderId}`,
          "store:read",
        );
      });
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(400, "Unknown order action.");
  } catch (error) {
    return apiError(error);
  }
}
