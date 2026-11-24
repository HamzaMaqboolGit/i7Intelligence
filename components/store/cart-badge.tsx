"use client";
import { readCart } from "@/lib/cart-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ShoppingBag,
  X,
  Minus,
  Plus,
  Trash2,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { cartAction, money } from "./storefront";
import { cinematicEase } from "@/lib/motion";
type Cart = {
  items: {
    id: string;
    title: string;
    image?: string;
    quantity: number;
    unitAmount: number;
    total: number;
    package: string;
  }[];
  currency: string;
  subtotal: number;
};
export default function CartBadge() {
  const [cart, setCart] = useState<Cart | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reduced = useReducedMotion();
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await readCart<Cart>();
      if (signal?.aborted) return;
      setCart(d);
      setError("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => void load(controller.signal);
    refresh();
    window.addEventListener("cart-updated", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("cart-updated", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (open) void load();
  }, [open, load]);
  const count = (cart?.items || []).reduce((n, i) => n + i.quantity, 0);
  async function change(body: object) {
    setBusy(true);
    try {
      setCart(await cartAction(body));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="store-cart-badge"
          aria-label={`Open shopping bag, ${count} items`}
        >
          <ShoppingBag size={21} />
          {count > 0 && (
            <span className="cart-quantity" aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="mini-cart-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.25 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby="mini-cart-description">
              <motion.section
                className="mini-cart"
                initial={reduced ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{
                  duration: reduced ? 0 : 0.35,
                  ease: cinematicEase,
                }}
              >
                <header>
                  <div>
                    <Dialog.Title>
                      Your shopping bag <span>{count}</span>
                    </Dialog.Title>
                    <Dialog.Description id="mini-cart-description">
                      A considered collection, ready when you are.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close
                    className="mini-cart-close"
                    aria-label="Close shopping bag"
                  >
                    <X size={20} />
                  </Dialog.Close>
                </header>
                <div className="mini-cart-body">
                  {error && (
                    <div role="alert" className="mini-cart-error">
                      {error}
                      <button onClick={() => load()}>Retry</button>
                      <Link href="/cart" onClick={() => setOpen(false)}>
                        Manage cart
                      </Link>
                    </div>
                  )}
                  {!cart && !error ? (
                    <div className="a-skeleton" />
                  ) : !cart?.items.length ? (
                    <div className="mini-cart-empty">
                      <ShoppingBag size={40} />
                      <h3>Your bag is waiting.</h3>
                      <p>
                        Explore digital products and services made with care.
                      </p>
                    </div>
                  ) : (
                    cart.items.map((i) => (
                      <article className="mini-cart-item" key={i.id}>
                        {i.image ? (
                          <img src={i.image} alt="" />
                        ) : (
                          <span className="mini-cart-placeholder">
                            <ShoppingBag />
                          </span>
                        )}
                        <div>
                          <h3>{i.title}</h3>
                          <p>{i.package} license</p>
                          <strong>{money(i.total, cart.currency)}</strong>
                          <div className="mini-cart-quantity">
                            <button
                              aria-label={`Decrease ${i.title} quantity`}
                              disabled={busy || i.quantity <= 1}
                              onClick={() =>
                                change({
                                  action: "update",
                                  itemId: i.id,
                                  quantity: i.quantity - 1,
                                })
                              }
                            >
                              <Minus size={13} />
                            </button>
                            <span>{i.quantity}</span>
                            <button
                              aria-label={`Increase ${i.title} quantity`}
                              disabled={busy || i.quantity >= 20}
                              onClick={() =>
                                change({
                                  action: "update",
                                  itemId: i.id,
                                  quantity: i.quantity + 1,
                                })
                              }
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              className="mini-cart-remove"
                              aria-label={`Remove ${i.title}`}
                              disabled={busy}
                              onClick={() =>
                                change({ action: "remove", itemId: i.id })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
                <footer>
                  <div className="mini-cart-subtotal">
                    <span>Subtotal</span>
                    <strong>
                      {money(cart?.subtotal || 0, cart?.currency || "usd")}
                    </strong>
                  </div>
                  <p>
                    Discounts and applicable taxes are reviewed at checkout.
                  </p>
                  {!!cart?.items.length && (
                    <Link
                      className="button"
                      href="/checkout"
                      onClick={() => setOpen(false)}
                    >
                      <Lock size={16} />
                      Secure Checkout
                      <ArrowUpRight size={16} />
                    </Link>
                  )}
                  <Link
                    className="button secondary"
                    href="/shop"
                    onClick={() => setOpen(false)}
                  >
                    Continue Shopping
                  </Link>
                </footer>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
