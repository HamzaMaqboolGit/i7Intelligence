import PurchaseSuccess from "@/components/store/purchase-success";
import Cart from "@/components/store/cart";
import Link from "next/link";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ state?: string[] }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { state = [] } = await params;
  if (state[0] === "success")
    return <PurchaseSuccess reference={(await searchParams).reference || ""} />;
  if (state[0] === "cancel")
    return (
      <main className="container store-empty">
        <h1>Checkout was cancelled.</h1>
        <p>Your cart is still available.</p>
        <Link className="button" href="/cart">
          Return to cart
        </Link>
      </main>
    );
  return <Cart checkout />;
}
