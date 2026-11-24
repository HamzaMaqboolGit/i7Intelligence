import { NextRequest } from "next/server";
import { getCart, digest } from "./cart";
export async function ownedOrders(request: NextRequest) {
  const { cart } = await getCart(request);
  const secret = request.cookies.get("store_order")?.value;
  return {
    OR: [
      ...(cart ? [{ cartId: cart.id }] : []),
      ...(secret ? [{ accessHash: digest(secret) }] : []),
    ],
  };
}
