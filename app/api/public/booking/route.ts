import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { notify } from "@/lib/cms/store";
import { queueTemplate } from "@/lib/email";
import { throttle } from "@/lib/public-requests";
import { randomUUID } from "node:crypto";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const raw = await jsonBody(request, 15000);
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email(),
        phone: z.string().max(40).optional(),
        requestId: z.string().uuid().optional(),
        service: z.string().max(100),
        requestedAt: z.string().datetime({ offset: true }),
        timezone: z.string().max(100),
        message: z.string().max(3000),
        website: z.string().optional(),
      })
      .safeParse(raw);
    if (!parsed.success)
      throw new HttpError(
        400,
        "Please check your contact details and preferred time.",
      );
    if (parsed.data.website) return NextResponse.json({ ok: true });
    const requestedAt = new Date(parsed.data.requestedAt);
    if (
      requestedAt <= new Date() ||
      requestedAt.getTime() > Date.now() + 365 * 86400000
    )
      throw new HttpError(400, "Choose a preferred time within the next year.");
    await prisma.$transaction(async (tx) => {
      if (
        parsed.data.requestId &&
        (await tx.bookingRequest.findUnique({
          where: { slug: parsed.data.requestId },
        }))
      )
        return;
      await throttle(tx, `booking:${parsed.data.email}`);
      const row = await tx.bookingRequest.create({
        data: {
          title: `${parsed.data.service || "Discovery call"} request`,
          slug: parsed.data.requestId || randomUUID(),
          description: parsed.data.message,
          status: "pending",
          data: parsed.data,
        },
      });
      await tx.contactMessage.create({
        data: {
          title: row.title,
          slug: `booking-${row.id}`,
          status: "unread",
          description: parsed.data.message.slice(0, 150),
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            phone: parsed.data.phone || "",
            service: parsed.data.service,
            subject: row.title,
            message: `Call request: ${parsed.data.requestedAt} (${parsed.data.timezone}).\n\n${parsed.data.message}`,
            reference: `CALL-${row.id.slice(-8).toUpperCase()}`,
            bookingId: row.id,
          },
        },
      });
      const settings = await tx.siteSetting.findUnique({
        where: { slug: "general" },
      });
      await queueTemplate(
        tx,
        `booking:${row.id}`,
        parsed.data.email,
        "booking_received",
        {
          customer_name: parsed.data.name,
          booking_date: parsed.data.requestedAt,
          company_name:
            (settings?.data as Record<string, string> | null)?.agencyName ||
            "Our studio",
        },
      );
      await notify(
        tx,
        "booking",
        "New booking request",
        parsed.data.name,
        `/admin/bookings?edit=${row.id}`,
        "bookings:read",
      );
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
