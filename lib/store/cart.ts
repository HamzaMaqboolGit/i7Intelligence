import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "../prisma";
import { HttpError } from "../access";
import type { Prisma } from "@prisma/client";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export const cartInclude = {
  items: { include: { product: true } },
} satisfies Prisma.StoreCartInclude;
export async function getCart(request: NextRequest, create = false) {
  const secret = request.cookies.get("store_cart")?.value;
  const existing = secret
    ? await prisma.storeCart.findFirst({
        where: { tokenHash: digest(secret), expiresAt: { gt: new Date() } },
        include: cartInclude,
      })
    : null;
  if (existing) return { cart: existing, secret: null };
  if (!create) return { cart: null, secret: null };
  const next = token();
  const cart = await prisma.storeCart.create({
    data: {
      tokenHash: digest(next),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
    include: cartInclude,
  });
  return { cart, secret: next };
}
export function cartCookie(response: NextResponse, secret: string | null) {
  if (secret)
    response.cookies.set("store_cart", secret, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.BETTER_AUTH_URL?.startsWith("https://"),
      maxAge: 30 * 86400,
      path: "/",
    });
  return response;
}
export function price(data: Record<string, unknown>, packageKey: string) {
  const packages = (data.packages || []) as {
    key: string;
    title: string;
    priceMinor: number;
    terms: string;
  }[];
  const selected = packages.find((p) => p.key === packageKey);
  if (packageKey !== "standard" && !selected)
    throw new HttpError(400, "Selected license is unavailable.");
  const sale =
    data.salePriceMinor !== undefined &&
    data.salePriceMinor !== "" &&
    (!data.saleStart || new Date(String(data.saleStart)) <= new Date()) &&
    (!data.saleEnd || new Date(String(data.saleEnd)) > new Date());
  const amount = selected
    ? selected.priceMinor
    : sale
      ? Number(data.salePriceMinor)
      : Number(data.priceMinor);
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new HttpError(400, "Product price is invalid.");
  return amount;
}
export type LoadedCart = NonNullable<
  Awaited<ReturnType<typeof getCart>>["cart"]
>;
export async function totals(cart: LoadedCart, email?: string) {
  let currency = "",
    subtotal = 0;
  const items = cart.items.map((item) => {
    const p = item.product,
      d = p.data as Record<string, unknown>;
    if (p.status !== "published" || p.deletedAt)
      throw new HttpError(
        409,
        `The product “${p.title}” is no longer available. Remove it from the cart.`,
      );
    if (currency && currency !== d.currency)
      throw new HttpError(
        400,
        "Checkout supports one currency per order. Purchase different currencies separately.",
      );
    currency = String(d.currency);
    const amount = price(d, item.package);
    const total = amount * item.quantity;
    if (!Number.isSafeInteger(total))
      throw new HttpError(400, "Invalid cart total.");
    subtotal += total;
    return {
      id: item.id,
      productId: p.id,
      title: p.title,
      description: p.description,
      image: d.image,
      kind: d.kind,
      package: item.package,
      quantity: item.quantity,
      unitAmount: amount,
      total,
      currency: String(d.currency),
      snapshot: d,
    };
  });
  let discount = 0;
  if (cart.coupon) {
    const row = await prisma.storeCoupon.findFirst({
      where: {
        status: "published",
        deletedAt: null,
        data: { path: "$.code", equals: cart.coupon },
      },
    });
    if (!row) throw new HttpError(400, "Coupon is unavailable.");
    const d = row.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (
      (d.startsAt && new Date(d.startsAt) > new Date()) ||
      (d.expiresAt && new Date(d.expiresAt) <= new Date()) ||
      (d.minimumMinor && subtotal < d.minimumMinor) ||
      (d.kind === "fixed" && d.currency !== currency)
    )
      throw new HttpError(400, "Coupon does not apply to this order.");
    const uses = await prisma.storeOrder.count({
      where: {
        coupon: cart.coupon,
        paymentStatus: { in: ["pending", "paid"] },
        createdAt: {
          gt: d.expiresAt
            ? new Date(0)
            : new Date(Date.now() - 3650 * 86400000),
        },
      },
    });
    if (d.maximumUses && uses >= d.maximumUses)
      throw new HttpError(400, "Coupon usage limit reached.");
    if (email && d.perCustomer) {
      const count = await prisma.storeOrder.count({
        where: {
          coupon: cart.coupon,
          customer: { email },
          paymentStatus: { in: ["pending", "paid"] },
        },
      });
      if (count >= d.perCustomer)
        throw new HttpError(400, "Your coupon usage limit has been reached.");
    }
    const productIds = String(d.products || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      categories = String(d.categories || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const eligible = items
      .filter(
        (i) =>
          (!productIds.length || productIds.includes(i.productId)) &&
          (!categories.length ||
            categories.includes(String(i.snapshot.category))),
      )
      .reduce((sum, i) => sum + i.total, 0);
    discount =
      d.kind === "percentage"
        ? Math.floor((eligible * d.value) / 100)
        : Math.min(eligible, d.value);
  }
  if (!Number.isSafeInteger(subtotal) || subtotal > 99999999)
    throw new HttpError(400, "Cart total is too large.");
  return {
    items: items.map(({ snapshot: _snapshot, ...item }) => item),
    currency,
    subtotal,
    discount,
    tax: 0,
    total: Math.max(0, subtotal - discount),
    coupon: cart.coupon,
    taxNote:
      "Tax, where applicable, is calculated securely during Stripe Checkout.",
  };
}
