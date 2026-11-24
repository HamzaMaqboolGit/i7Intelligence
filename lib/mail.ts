import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
export async function sendPasswordReset(email: string, url: string) {
  const { smtpConfig, sendOutbox } = await import("./email");
  const configured = await smtpConfig();
  if (configured?.enabled) {
    const { prisma } = await import("./prisma");
    const row = await prisma.emailOutbox.create({
      data: {
        key: `reset:${randomUUID()}`,
        recipient: email,
        subject: "Reset your administrator password",
        html: `<p>Use this one-time link within 30 minutes:</p><p><a href="${url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
        messageId: `<${randomUUID()}@agency.local>`,
        template: "password_reset",
      },
    });
    await sendOutbox(row.id);
    return;
  }
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Reset your Royal Studio password",
      text: `Reset your password using this one-time link (expires in 30 minutes):\n${url}\nIf you did not request this, ignore this message.`,
    });
    return;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Password reset email delivery is not configured");
  const directory = path.join(process.cwd(), ".local-mails");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(directory, `${randomUUID()}.json`),
    JSON.stringify({ to: email, url }),
    { mode: 0o600 },
  );
}
