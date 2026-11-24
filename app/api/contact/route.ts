import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { notify } from "@/lib/cms/store";
import { randomUUID } from "node:crypto";
import { queueTemplate } from "@/lib/email";
import { throttle } from "@/lib/public-requests";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const raw = await jsonBody(request, 20000);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
        service: z.string().trim().min(1).max(80),
        subject: z.string().trim().min(2).max(150),
        phone: z.string().trim().max(40).optional(),
        consent: z.literal(true),
        requestId: z.string().uuid().optional(),
        message: z.string().trim().min(20).max(5000),
        website: z.string().max(200).optional(),
      })
      .safeParse(raw);
    if (!input.success)
      throw new HttpError(
        400,
        "Please check your name, email and message (at least 20 characters).",
      );
    if (input.data.website) return NextResponse.json({ ok: true });
    let reference = `INQ-${randomUUID().slice(0, 8).toUpperCase()}`;
    await prisma.$transaction(async (tx) => {
      if(input.data.requestId){ const previous=await tx.contactReceipt.findUnique({where:{key:input.data.requestId}});if(previous){reference=previous.reference;return;} }
      const { name, email, service, message, subject, phone, consent } =
        input.data;
      await throttle(tx, `contact:${email}`);
      await tx.$executeRaw`INSERT INTO enquiries (name,email,service,message) VALUES (${name},${email},${service},${message})`;
      const legacy = await tx.$queryRaw<
        Array<{ id: bigint }>
      >`SELECT LAST_INSERT_ID() AS id`;
      const row = await tx.contactMessage.create({
        data: {
          title: subject,
          slug: `legacy-${legacy[0].id}`,
          description: message.slice(0, 150),
          status: "unread",
          data: {
            name,
            email,
            service,
            message,
            subject,
            phone: phone || "",
            consent,
            reference,
          },
        },
      });
      await tx.contactReceipt.create({data:{key:input.data.requestId||randomUUID(),reference,inquiryId:row.id}});
      const settings = await tx.siteSetting.findUnique({
        where: { slug: "general" },
      });
      const company =
        (settings?.data as Record<string, string> | null)?.agencyName ||
        "Our studio";
      const variables = {
        customer_name: name,
        inquiry_reference: reference,
        company_name: company,
        message_subject: subject,
      };
      await queueTemplate(tx, `ack:${row.id}`, email, "contact_ack", variables);
      const smtp = await tx.emailSetting.findUnique({ where: { id: "smtp" } });
      const adminEmail = (smtp?.data as Record<string, string> | null)
        ?.adminEmail;
      if (adminEmail)
        await queueTemplate(
          tx,
          `admin:${row.id}`,
          adminEmail,
          "contact_admin",
          variables,
        );
      await notify(
        tx,
        "contact",
        "New contact inquiry",
        `${name} · ${service}`,
        `/admin/contacts?edit=${row.id}`,
        "contacts:read",
      );
    });
    return NextResponse.json({ ok: true, reference }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
