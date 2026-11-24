import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkOrigin, jsonBody, HttpError } from "@/lib/access";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getCart,
  cartCookie,
  totals,
  cartInclude,
  price,
} from "@/lib/store/cart";
export async function GET(request: NextRequest) {
  try {
    const { cart, secret } = await getCart(request, true);
    return cartCookie(NextResponse.json(await totals(cart!)), secret);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = z
      .object({
        action: z.enum(["add", "update", "remove", "coupon"]),
        productId: z.string().optional(),
        itemId: z.string().optional(),
        quantity: z.number().int().min(1).max(20).default(1),
        package: z.string().max(100).default("standard"),
        code: z.string().max(80).optional(),
      })
      .parse(await jsonBody(request));
    const { cart, secret } = await getCart(request, true);
    if (!cart) throw new HttpError(400, "Cart unavailable.");
    if (input.action === "add") {
      const product = await prisma.storeProduct.findFirst({
        where: { id: input.productId, status: "published", deletedAt: null },
      });
      if (!product) throw new HttpError(404, "Product unavailable.");
      price(product.data as Record<string, unknown>, input.package);
      if (
        cart.items.some(
          (i) =>
            (i.product.data as Record<string, unknown>).currency !==
            (product.data as Record<string, unknown>).currency,
        )
      )
        throw new HttpError(
          400,
          "Purchase different currencies in separate orders.",
        );
      if (cart.items.length >= 30)
        throw new HttpError(400, "Cart has reached its item limit.");
      const existing = cart.items.find(
        (i) => i.productId === product.id && i.package === input.package,
      );
      await prisma.storeCartItem.upsert({
        where: {
          cartId_productId_package: {
            cartId: cart.id,
            productId: product.id,
            package: input.package,
          },
        },
        create: {
          cartId: cart.id,
          productId: product.id,
          package: input.package,
          quantity: input.quantity,
        },
        update: {
          quantity: Math.min(20, (existing?.quantity || 0) + input.quantity),
        },
      });
    }
    if (input.action === "update")
      await prisma.storeCartItem.updateMany({
        where: { id: input.itemId, cartId: cart.id },
        data: { quantity: input.quantity },
      });
    if (input.action === "remove")
      await prisma.storeCartItem.deleteMany({
        where: { id: input.itemId, cartId: cart.id },
      });
    if (input.action === "coupon") {
      const candidate = {
        ...cart,
        coupon: input.code?.trim().toUpperCase() || null,
      };
      await totals(candidate);
      await prisma.storeCart.update({
        where: { id: cart.id },
        data: { coupon: candidate.coupon },
      });
    }
    await prisma.storeCart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
    });
    const updated = await prisma.storeCart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });
    return cartCookie(NextResponse.json(await totals(updated)), secret);
  } catch (error) {
    return apiError(error);
  }
}
