import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./access";

export const smtpSchema = z.object({
  host: z
    .string()
    .trim()
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/),
  port: z.number().int().min(1).max(65535),
  encryption: z.enum(["tls", "ssl", "none"]),
  username: z.string().max(254),
  password: z.string().max(1000).optional(),
  senderName: z.string().trim().min(1).max(100),
  senderEmail: z.email(),
  replyTo: z.union([z.email(), z.literal("")]),
  adminEmail: z.union([z.email(), z.literal("")]),
  provider: z.string().max(80),
  enabled: z.boolean(),
});
export type SmtpConfig = z.infer<typeof smtpSchema>;
function encryptionKey() {
  const secret =
    process.env.SMTP_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "A server-side encryption key of at least 32 characters is required",
    );
  return createHash("sha256").update(secret).digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  return [iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decryptSecret(value: string) {
  const [iv, data, final, tag] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([
    cipher.update(data),
    cipher.update(final),
    cipher.final(),
  ]).toString("utf8");
}
export async function smtpConfig(): Promise<SmtpConfig | null> {
  const row = await prisma.emailSetting.findUnique({ where: { id: "smtp" } });
  if (!row) return null;
  return {
    ...smtpSchema.omit({ password: true }).parse(row.data),
    password: row.secret ? decryptSecret(row.secret) : undefined,
  };
}
// Fail closed: the server operator must allow the exact hostname; resolved IP is pinned.
// Local mock SMTP is available only to the standalone test process, never production.
export async function smtpTransport(config: SmtpConfig) {
  const mock =
    process.env.NODE_ENV === "test" &&
    process.env.SMTP_TEST_HOST === config.host;
  const allowed = (process.env.SMTP_ALLOWED_HOSTS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase());
  if (!mock && !allowed.includes(config.host.toLowerCase()))
    throw new HttpError(
      400,
      "SMTP host is not in the server's SMTP_ALLOWED_HOSTS allowlist.",
    );
  if (!mock && ![25, 465, 587, 2525].includes(config.port))
    throw new HttpError(400, "Unsupported SMTP port.");
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.BETTER_AUTH_URL?.startsWith("https://")
  )
    throw new HttpError(400, "Production email settings require HTTPS.");
  const addresses = await lookup(config.host, { all: true });
  const publicIp = (ip: string) => {
    if (net.isIPv4(ip)) {
      const [a, b] = ip.split(".").map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
      );
    }
    return net.isIPv6(ip) && !/^(::|f[cd]|fe[89ab])/i.test(ip);
  };
  if (
    !addresses.length ||
    (!mock && addresses.some((a) => !publicIp(a.address)))
  )
    throw new HttpError(
      400,
      "SMTP cannot connect to private or reserved network addresses.",
    );
  return nodemailer.createTransport({
    host: addresses[0].address,
    port: config.port,
    secure: config.encryption === "ssl",
    requireTLS: config.encryption === "tls",
    ignoreTLS: config.encryption === "none",
    tls: { servername: config.host, minVersion: "TLSv1.2" },
    auth: config.username
      ? { user: config.username, pass: config.password }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
export const templateDefaults: Record<
  string,
  { subject: string; body: string }
> = {
  order_placed: {
    subject: "Order received · {{order_reference}}",
    body: "<p>Hello {{customer_name}}, your order {{order_reference}} has been received. Payment is awaiting confirmation.</p>",
  },
  payment_confirmed: {
    subject: "Payment confirmed · {{order_reference}}",
    body: '<p>Hello {{customer_name}}, payment for {{order_reference}} has been confirmed.</p><p><a href="{{secure_download_link}}">View your order and secure downloads</a></p>',
  },
  order_delivery: {
    subject: "Your order is ready · {{order_reference}}",
    body: '<p>Hello {{customer_name}},</p><p>Your digital product {{product_name}} is ready.</p><p><a href="{{secure_download_link}}">Open your secure files</a></p><p>Product-specific expiration and download limits apply.</p>',
  },
  service_received: {
    subject: "Service order received · {{order_reference}}",
    body: "<p>Hello {{customer_name}}, your service order has been received. Please provide your project requirements through your secure order page.</p>",
  },
  service_status: {
    subject: "Service update · {{order_reference}}",
    body: "<p>Hello {{customer_name}}, {{message_subject}}</p>",
  },
  deliverables_ready: {
    subject: "Your deliverables are ready · {{order_reference}}",
    body: '<p>Hello {{customer_name}}, your project deliverables are ready.</p><p><a href="{{secure_download_link}}">Open your order</a></p>',
  },
  refund_processed: {
    subject: "Refund update · {{order_reference}}",
    body: "<p>Hello {{customer_name}}, a refund update is available for your order. {{message_subject}}</p>",
  },
  delivery_failure: {
    subject: "Delivery requires attention · {{order_reference}}",
    body: "<p>An order email requires administrator attention. Review the secure delivery log.</p>",
  },
  contact_ack: {
    subject: "We received your inquiry · {{inquiry_reference}}",
    body: "<p>Hello {{customer_name}},</p><p>Thank you for contacting {{company_name}}. We received your inquiry about {{message_subject}}.</p><p>Your reference is {{inquiry_reference}}.</p>",
  },
  contact_admin: {
    subject: "New inquiry · {{inquiry_reference}}",
    body: "<p>A new inquiry from {{customer_name}} is available in the administrator inbox.</p><p>Subject: {{message_subject}}</p>",
  },
  admin_reply: {
    subject: "Re: {{message_subject}}",
    body: "<p>Hello {{customer_name}},</p><p>Thank you for your message.</p>",
  },
  booking_received: {
    subject: "Booking request received",
    body: "<p>Hello {{customer_name}}, your request for {{booking_date}} has been received. This is not a confirmed appointment.</p>",
  },
  booking_confirmed: {
    subject: "Booking confirmed",
    body: "<p>Hello {{customer_name}}, your booking for {{booking_date}} is confirmed.</p>",
  },
  booking_cancelled: {
    subject: "Booking cancelled",
    body: "<p>Hello {{customer_name}}, your booking for {{booking_date}} has been cancelled.</p>",
  },
  newsletter_welcome: {
    subject: "Welcome to {{company_name}}",
    body: "<p>Thank you for subscribing to {{company_name}}.</p>",
  },
  general: {
    subject: "Notification from {{company_name}}",
    body: "<p>{{message_subject}}</p>",
  },
};
export function safeEmailHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "div",
      "span",
      "h1",
      "h4",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "hr",
      "img",
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
    ],
    allowedAttributes: {
      "*": ["style", "align"],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      table: ["width", "cellpadding", "cellspacing", "role"],
      td: ["colspan", "rowspan", "width"],
      th: ["colspan", "scope"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i],
        "font-size": [/^\d{1,3}(px|pt|em|rem|%)$/],
        "font-family": [/^[a-zA-Z ,'-]+$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "text-align": [/^(left|right|center)$/],
        "line-height": [/^[\d.]+(px|em|%)?$/],
        padding: [/^[\d\s.]+(px|em|%)?([\d\s.pxem%]*)$/],
        "border-radius": [/^\d+(px|%)$/],
        width: [/^\d+(px|%)$/],
        "max-width": [/^\d+(px|%)$/],
      },
    },
    allowedSchemes: ["https", "mailto"],
    allowProtocolRelative: false,
  });
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function queueTemplate(
  tx: Prisma.TransactionClient,
  key: string,
  recipient: string,
  template: string,
  variables: Record<string, string>,
) {
  z.email().parse(recipient);
  const stored = await tx.emailTemplate.findUnique({
    where: { key: template },
  });
  const source = stored || templateDefaults[template];
  if (!source) throw new Error("Unknown email template");
  const interpolate = (value: string, html: boolean) =>
    value.replace(/{{\s*([a-z_]+)\s*}}/g, (_, v) =>
      html
        ? escape(variables[v] || "")
        : (variables[v] || "").replace(/[\r\n]/g, " "),
    );
  return tx.emailOutbox.upsert({
    where: { key },
    update: {},
    create: {
      key,
      recipient,
      subject: interpolate(source.subject, false),
      html: safeEmailHtml(interpolate(source.body, true)),
      template,
      messageId: `<${randomUUID()}@agency.local>`,
    },
  });
}
export async function sendOutbox(id: string) {
  const config = await smtpConfig();
  if (!config?.enabled)
    throw new HttpError(
      409,
      "Email is not configured or is disabled. The message remains safely queued.",
    );
  const transport = await smtpTransport(config);
  const claimed = await prisma.emailOutbox.updateMany({
    where: { id, status: { in: ["pending", "failed"] }, attempts: { lt: 5 } },
    data: { status: "processing", attempts: { increment: 1 }, lastError: null },
  });
  if (!claimed.count) {
    const existing = await prisma.emailOutbox.findUniqueOrThrow({
      where: { id },
    });
    if (existing.status === "accepted") return existing;
    throw new HttpError(
      409,
      "This message is already being sent, needs reconciliation, or reached the retry limit.",
    );
  }
  const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  await prisma.emailDeliveryLog.create({
    data: { outboxId: id, status: "attempted" },
  });
  try {
    const info = await transport.sendMail({
      from: { name: config.senderName, address: config.senderEmail },
      to: row.recipient,
      replyTo: config.replyTo || config.senderEmail,
      subject: row.subject,
      html: row.html,
      text: sanitizeHtml(row.html, { allowedTags: [], allowedAttributes: {} }),
      messageId: row.messageId,
      inReplyTo: row.inReplyTo || undefined,
      references: row.referenceHeaders || undefined,
    });
    if (!info.accepted?.length)
      throw Object.assign(new Error("Recipient rejected"), {
        responseCode: 550,
      });
    return await prisma.$transaction(async (tx) => {
      const accepted = await tx.emailOutbox.update({
        where: { id },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      await tx.emailDeliveryLog.create({
        data: {
          outboxId: id,
          status: "accepted",
          detail:
            "SMTP provider accepted the recipient; final inbox delivery is not confirmed.",
        },
      });
      if (row.conversationId) {
        const message = await tx.conversationMessage.findUniqueOrThrow({
          where: { id: row.conversationId },
        });
        await tx.contactMessage.update({
          where: { id: message.inquiryId },
          data: { status: "replied" },
        });
      }
      return accepted;
    });
  } catch (error) {
    // A dropped connection after DATA may mean the provider accepted the email.
    // Never automatically resend an ambiguous attempt.
    const code = (error as { responseCode?: number }).responseCode;
    const definitive = !!code && code >= 400;
    const status = definitive ? "failed" : "unknown";
    const detail = definitive
      ? `SMTP rejected the attempt (${code}). Check configuration before retrying.`
      : "SMTP acceptance is uncertain. Check provider logs before sending again; automatic retry is disabled.";
    await prisma.$transaction([
      prisma.emailOutbox.update({
        where: { id },
        data: { status, lastError: detail },
      }),
      prisma.emailDeliveryLog.create({
        data: { outboxId: id, status, detail },
      }),
    ]);
    const { notify } = await import("./cms/store");
    await prisma.$transaction((tx) =>
      notify(
        tx,
        "email",
        "Email delivery requires attention",
        detail,
        "/admin/settings",
        "settings:write",
      ),
    );
    throw new HttpError(502, detail);
  } finally {
    transport.close();
  }
}
