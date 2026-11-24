import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { notify } from "@/lib/cms/store";
import {queueTemplate} from "@/lib/email";
import { throttle } from "@/lib/public-requests";
import { createHash } from "node:crypto";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const raw = await jsonBody(request, 3000);
    const input = z
      .object({
        email: z.email(),
        consent: z.literal(true),
        website: z.string().optional(),
      })
      .safeParse(raw);
    if (!input.success)
      throw new HttpError(
        400,
        "A valid email and subscription consent are required.",
      );
    if (input.data.website) return NextResponse.json({ ok: true });
    const email = input.data.email.toLowerCase();
    const slug = createHash("sha256").update(email).digest("hex");
    await prisma.$transaction(async (tx) => {
      await throttle(tx, `newsletter:${email}`);
      const existing = await tx.newsletterSubscriber.findUnique({
        where: { slug },
      });
      if (existing) return;
      await tx.newsletterSubscriber.create({
        data: {
          title: email,
          slug,
          status: "subscribed",
          data: { email, consent: true, consentAt: new Date().toISOString() },
        },
      });
      const settings=await tx.siteSetting.findUnique({where:{slug:"general"}});
      await queueTemplate(tx,`newsletter:${slug}`,email,"newsletter_welcome",{company_name:(settings?.data as Record<string,string> | null)?.agencyName||"Our studio"});
      await notify(
        tx,
        "newsletter",
        "New newsletter subscriber",
        email,
        "/admin/subscribers",
        "subscribers:read",
      );
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
