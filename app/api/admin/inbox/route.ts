import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { audit } from "@/lib/cms/store";
import { safeEmailHtml, sendOutbox } from "@/lib/email";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("contacts:read", request.headers);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new HttpError(400, "Select an inquiry.");
    const inquiry = await prisma.contactMessage.findFirst({
      where: { id, deletedAt: null },
      include: {
        conversation: {
          orderBy: { createdAt: "asc" },
          include: {
            outbox: {
              select: {
                id: true,
                status: true,
                recipient: true,
                acceptedAt: true,
                lastError: true,
                attempts: true,
              },
            },
          },
        },
      },
    });
    if (!inquiry) throw new HttpError(404, "Inquiry not found.");
    return NextResponse.json({ inquiry, inboundConfigured: false });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("contacts:write", request.headers);
    const input = z
      .object({
        inquiryId: z.string(),
        id: z.string().uuid(),
        action: z.enum(["draft", "send", "note"]),
        subject: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/^[^\r\n]*$/),
        body: z.string().min(1).max(50000),
      })
      .parse(await jsonBody(request));
    const body = safeEmailHtml(input.body);
    if (!body.replace(/<[^>]*>/g, "").trim())
      throw new HttpError(400, "Write a message before saving.");
    const result = await prisma.$transaction(async (tx) => {
      const inquiry = await tx.contactMessage.findFirst({
        where: { id: input.inquiryId, deletedAt: null },
      });
      if (!inquiry) throw new HttpError(404, "Inquiry not found.");
      const data = inquiry.data as Record<string, string>;
      const recipient = z.email().parse(data.email);
      const existing = await tx.conversationMessage.findUnique({
        where: { id: input.id },
        include: { outbox: true },
      });
      if (existing && existing.inquiryId !== inquiry.id)
        throw new HttpError(
          409,
          "Message reference conflicts with another inquiry.",
        );
      if (existing && existing.authorId !== admin.id)
        throw new HttpError(
          403,
          "Only the draft author can edit this message.",
        );
      if (existing?.outbox) {
        if (input.action === "note")
          throw new HttpError(
            400,
            "Create a separate internal note; an outgoing reply cannot become a note.",
          );
        if (
          ["accepted", "processing", "unknown"].includes(existing.outbox.status)
        ) {
          if (input.action === "send") return existing.outbox;
          throw new HttpError(
            409,
            "This message has been sent or is being processed and cannot be edited.",
          );
        }
        if (!["pending", "failed", "draft"].includes(existing.outbox.status))
          throw new HttpError(409, "This message cannot be edited.");
        // Claim the unsent job atomically so the worker cannot send it while it is edited.
        const claimed = await tx.emailOutbox.updateMany({
          where: {
            id: existing.outbox.id,
            status: { in: ["pending", "failed", "draft"] },
          },
          data: {
            status: input.action === "draft" ? "draft" : "pending",
            subject: input.subject,
            html: body,
            lastError: null,
          },
        });
        if (!claimed.count)
          throw new HttpError(
            409,
            "The message state changed. Refresh the conversation.",
          );
        await tx.conversationMessage.update({
          where: { id: existing.id },
          data: {
            subject: input.subject,
            body,
            kind: input.action === "draft" ? "draft" : "reply",
          },
        });
        await audit(
          tx,
          admin.id,
          "edited",
          "contacts",
          inquiry.id,
          "Unsent reply updated; private body omitted",
        );
        return input.action === "send"
          ? tx.emailOutbox.findUniqueOrThrow({
              where: { id: existing.outbox.id },
            })
          : null;
      }
      const kind =
        input.action === "note"
          ? "note"
          : input.action === "draft"
            ? "draft"
            : "reply";
      const message = await tx.conversationMessage.upsert({
        where: { id: input.id },
        create: {
          id: input.id,
          inquiryId: inquiry.id,
          authorId: admin.id,
          subject: input.subject,
          body,
          kind,
          messageId: `<${input.id}@agency.local>`,
        },
        update: { subject: input.subject, body, kind },
      });
      await audit(
        tx,
        admin.id,
        input.action === "send" ? "queued" : "saved",
        "contacts",
        inquiry.id,
        input.action === "note"
          ? "Internal note saved"
          : "Conversation message saved; email body omitted",
      );
      if (input.action !== "send") return null;
      const prior = await tx.emailOutbox.findMany({
        where: { conversation: { inquiryId: inquiry.id }, status: "accepted" },
        orderBy: { createdAt: "asc" },
        select: { messageId: true },
      });
      return tx.emailOutbox.create({
        data: {
          key: `reply:${input.id}`,
          conversationId: message.id,
          recipient,
          subject: input.subject,
          html: body,
          messageId: message.messageId,
          inReplyTo: prior.at(-1)?.messageId,
          referenceHeaders: prior.map((r) => r.messageId).join(" ") || null,
          template: "admin_reply",
        },
      });
    });
    if (result) {
      await sendOutbox(result.id);
      await prisma.$transaction((tx) =>
        audit(
          tx,
          admin.id,
          "sent",
          "contacts",
          input.inquiryId,
          "Reply accepted by SMTP provider",
        ),
      );
    }
    return NextResponse.json({
      ok: true,
      status: result ? "accepted" : "saved",
    });
  } catch (error) {
    return apiError(error);
  }
}
