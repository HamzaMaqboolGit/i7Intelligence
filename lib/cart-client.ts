"use client";
// Share the in-flight read, including initial cookie creation, across the existing
// navbar/cart/product components. The MySQL cart remains the single source of truth.
let pending: Promise<unknown> | null = null;
export function readCart<T>(): Promise<T> {
  if (!pending)
    pending = fetch("/api/store/cart")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load your cart.");
        return data;
      })
      .finally(() => {
        pending = null;
      });
  return pending as Promise<T>;
}
