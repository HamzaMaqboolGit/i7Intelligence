import { stripeConfiguration } from "@/lib/store/stripe";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { encryptSecret, decryptSecret } from "@/lib/email";
import { audit } from "@/lib/cms/store";
const schema = z.object({
  mode: z.enum(["test", "live"]),
  publishableKey: z.string().max(300),
  secretKey: z.string().max(300).optional(),
  webhookSecret: z.string().max(300).optional(),
  taxMode: z.enum(["none", "manual", "stripe"]),
  taxBehavior: z.enum(["exclusive", "inclusive"]),
  taxRateBps: z.number().int().min(0).max(10000),
  taxLabel: z.string().trim().max(60),
  taxRegistration: z.string().max(150),
  taxCountry: z.string().max(2),
});
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("store-settings:read", request.headers);
    const row = await prisma.integrationSetting.findUnique({
      where: { id: "stripe" },
    });
    let secret: { secretKey?: string; webhookSecret?: string } = {};
    if (row?.secret) secret = JSON.parse(decryptSecret(row.secret));
    return NextResponse.json({
      config: row?.data || {
        mode: "test",
        publishableKey: "",
        taxMode: "none",
        taxBehavior: "exclusive",
        taxRateBps: 0,
        taxLabel: "Tax",
        taxRegistration: "",
        taxCountry: "",
      },
      secretConfigured: !!secret.secretKey || !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured:
        !!secret.webhookSecret || !!process.env.STRIPE_WEBHOOK_SECRET,
      checkoutEnabled: (await stripeConfiguration()).enabled,
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"}/api/store/webhook`,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("store-settings:write", request.headers);
    const input = schema.parse(await jsonBody(request, 10000));
    if (
      input.publishableKey &&
      !input.publishableKey.startsWith(`pk_${input.mode}_`)
    )
      throw new HttpError(
        400,
        "Publishable key must match the selected test/live mode.",
      );
    if (
      input.secretKey &&
      !new RegExp(`^(sk|rk)_${input.mode}_[A-Za-z0-9]+$`).test(input.secretKey)
    )
      throw new HttpError(
        400,
        "Secret or restricted key must match the selected mode.",
      );
    if (
      input.webhookSecret &&
      !/^whsec_[A-Za-z0-9]+$/.test(input.webhookSecret)
    )
      throw new HttpError(400, "Enter a valid webhook signing secret.");
    const { secretKey, webhookSecret, ...data } = input;
    await prisma.$transaction(async (tx) => {
      const old = await tx.integrationSetting.findUnique({
        where: { id: "stripe" },
      });
      const prior = old?.secret ? JSON.parse(decryptSecret(old.secret)) : {};
      if (
        old &&
        (old.data as Record<string, string>).mode !== input.mode &&
        !secretKey &&
        prior.secretKey
      )
        throw new HttpError(
          400,
          "Provide a matching secret key when switching modes.",
        );
      const secret = encryptSecret(
        JSON.stringify({
          ...prior,
          ...(secretKey ? { secretKey } : {}),
          ...(webhookSecret ? { webhookSecret } : {}),
        }),
      );
      await tx.integrationSetting.upsert({
        where: { id: "stripe" },
        create: { id: "stripe", data, secret },
        update: { data, secret },
      });
      await audit(
        tx,
        admin.id,
        "updated",
        "store-settings",
        "stripe",
        "Payment/tax configuration saved; all secret values omitted",
      );
    });
    return NextResponse.json({ ok: true, checkoutEnabled: false });
  } catch (error) {
    return apiError(error);
  }
}
