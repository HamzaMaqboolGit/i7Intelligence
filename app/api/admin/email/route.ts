import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/cms/store";
import {
  encryptSecret,
  smtpSchema,
  smtpConfig,
  smtpTransport,
  sendOutbox,
  safeEmailHtml,
  templateDefaults,
  queueTemplate,
} from "@/lib/email";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("settings:write", request.headers);
    const setting = await prisma.emailSetting.findUnique({
      where: { id: "smtp" },
    });
    const templates = await prisma.emailTemplate.findMany();
    const logs = await prisma.emailOutbox.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        recipient: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        acceptedAt: true,
        createdAt: true,
        template: true,
        logs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    return NextResponse.json({
      config: setting?.data || null,
      passwordConfigured: !!setting?.secret,
      templates: Object.entries(templateDefaults).map(([key, value]) => ({
        ...value,
        ...templates.find((t) => t.key === key),
        key,
      })),
      logs,
      inboundConfigured: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("settings:write", request.headers);
    const raw = await jsonBody(request);
    if (raw.action === "save") {
      const input = smtpSchema.safeParse(raw.config);
      if (!input.success)
        throw new HttpError(
          400,
          "Check the SMTP host, port and email addresses.",
        );
      const { password, ...data } = input.data;
      await prisma.$transaction(async (tx) => {
        await tx.emailSetting.upsert({
          where: { id: "smtp" },
          create: {
            id: "smtp",
            data,
            secret: password ? encryptSecret(password) : null,
          },
          update: {
            data,
            ...(password ? { secret: encryptSecret(password) } : {}),
          },
        });
        await audit(
          tx,
          admin.id,
          "updated",
          "email-settings",
          "smtp",
          "SMTP configuration changed; secrets omitted",
        );
      });
      return NextResponse.json({ ok: true });
    }
    if (raw.action === "template") {
      const input = z
        .object({
          key: z.enum(Object.keys(templateDefaults) as [string, ...string[]]),
          subject: z
            .string()
            .min(1)
            .max(200)
            .regex(/^[^\r\n]*$/),
          body: z.string().min(1).max(50000),
        })
        .parse(raw);
      await prisma.$transaction(async (tx) => {
        await tx.emailTemplate.upsert({
          where: { key: input.key },
          create: {
            key: input.key,
            subject: input.subject,
            body: safeEmailHtml(input.body),
          },
          update: { subject: input.subject, body: safeEmailHtml(input.body) },
        });
        await audit(
          tx,
          admin.id,
          "updated",
          "email-templates",
          input.key,
          "Email template updated",
        );
      });
      return NextResponse.json({ ok: true });
    }
    if (raw.action === "retry") {
      const row = await sendOutbox(z.string().parse(raw.id));
      return NextResponse.json({ ok: true, status: row.status });
    }
    const config = await smtpConfig();
    if (!config) throw new HttpError(409, "Save SMTP configuration first.");
    if (raw.action === "verify") {
      const transport = await smtpTransport(config);
      try {
        await transport.verify();
      } finally {
        transport.close();
      }
      return NextResponse.json({
        ok: true,
        message:
          "SMTP connection and authentication verified. Sending permission still depends on the provider.",
      });
    }
    if (raw.action === "test") {
      const row = await prisma.$transaction((tx) =>
        queueTemplate(
          tx,
          `test:${crypto.randomUUID()}`,
          admin.email,
          "general",
          {
            company_name: config.senderName,
            message_subject: "Your administrator SMTP test.",
          },
        ),
      );
      await sendOutbox(row.id);
      return NextResponse.json({
        ok: true,
        message:
          "SMTP provider accepted the test email. Inbox delivery is not confirmed.",
      });
    }
    throw new HttpError(400, "Unknown email action.");
  } catch (error) {
    return apiError(error);
  }
}
