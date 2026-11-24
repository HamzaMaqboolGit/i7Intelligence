import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { apiError } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin("dashboard:read", request.headers);
    const business = admin.permissions.includes("contacts:read");
    const [
      projects,
      articles,
      contacts,
      bookings,
      recentContacts,
      recentBookings,
      logs,
      drafts,
      contactDates,
      bookingDates,
    ] = await Promise.all([
      prisma.portfolioProject.count({ where: { deletedAt: null } }),
      prisma.blogPost.count({
        where: { status: "published", deletedAt: null },
      }),
      business
        ? prisma.contactMessage.count({ where: { deletedAt: null } })
        : 0,
      business
        ? prisma.bookingRequest.count({ where: { deletedAt: null } })
        : 0,
      business
        ? prisma.contactMessage.findMany({
            where: { deletedAt: null },
            take: 5,
            orderBy: { createdAt: "desc" },
          })
        : [],
      business
        ? prisma.bookingRequest.findMany({
            where: { deletedAt: null },
            take: 5,
            orderBy: { createdAt: "desc" },
          })
        : [],
      admin.permissions.includes("logs:read")
        ? prisma.activityLog.findMany({
            take: 6,
            orderBy: { createdAt: "desc" },
          })
        : [],
      prisma.blogPost.findMany({
        where: { status: "draft", deletedAt: null },
        take: 4,
        orderBy: { updatedAt: "desc" },
      }),
      business
        ? prisma.contactMessage.findMany({
            where: {
              deletedAt: null,
              createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
            },
            select: { createdAt: true },
          })
        : [],
      business
        ? prisma.bookingRequest.findMany({
            where: {
              deletedAt: null,
              createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
            },
            select: { createdAt: true },
          })
        : [],
    ]);
    const series = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.now() - (29 - i) * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        date,
        inquiries: contactDates.filter((r) =>
          r.createdAt.toISOString().startsWith(date),
        ).length,
        bookings: bookingDates.filter((r) =>
          r.createdAt.toISOString().startsWith(date),
        ).length,
      };
    });
    return NextResponse.json({
      metrics: {
        projects,
        articles,
        contacts: business ? contacts : null,
        bookings: business ? bookings : null,
      },
      recentContacts,
      recentBookings,
      logs,
      drafts,
      series,
      analyticsConfigured: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
