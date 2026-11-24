import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/access";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("store:read", request.headers);
    const p = request.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page")) || 1),
      status = p.get("status"),
      q = (p.get("q") || "").slice(0, 100),
      where = {
        ...(status && status !== "all" ? { paymentStatus: status } : {}),
        ...(q
          ? {
              OR: [
                { reference: { contains: q } },
                { customer: { email: { contains: q } } },
                { customer: { name: { contains: q } } },
              ],
            }
          : {}),
      };
    const [
      orders,
      total,
      groups,
      products,
      services,
      downloads,
      customers,
      refunds,
      deliveries,
    ] = await Promise.all([
      prisma.storeOrder.findMany({
        where,
        include: {
          customer: true,
          items: true,
          events: { orderBy: { createdAt: "desc" }, take: 15 },
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: (page - 1) * 20,
      }),
      prisma.storeOrder.count({ where }),
      prisma.storeOrder.groupBy({
        by: ["currency", "paymentStatus"],
        _sum: { total: true },
        _count: true,
      }),
      prisma.storeProduct.count({
        where: {
          status: "published",
          deletedAt: null,
          data: { path: "$.kind", equals: "digital" },
        },
      }),
      prisma.storeProduct.count({
        where: {
          status: "published",
          deletedAt: null,
          data: { path: "$.kind", equals: "service" },
        },
      }),
      prisma.storeDownloadEvent.count(),
      prisma.storeCustomer.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          orders: {
            select: {
              id: true,
              reference: true,
              currency: true,
              total: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.storeRefund.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { order: { select: { reference: true } } },
      }),
      prisma.storeEntitlement.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          file: { select: { name: true, version: true } },
          item: {
            include: {
              order: {
                select: {
                  reference: true,
                  paymentStatus: true,
                  customer: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    return NextResponse.json({
      orders,
      total,
      groups,
      products,
      services,
      downloads,
      customers,
      refunds,
      deliveries,
      page,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
      mode: process.env.STRIPE_SECRET_KEY?.includes("_live_") ? "live" : "test",
      fileDirectoryConfigured: !!process.env.STORE_FILE_DIRECTORY,
    });
  } catch (error) {
    return apiError(error);
  }
}
