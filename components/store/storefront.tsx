"use client";
import { cinematicEase, motionTiming } from "@/lib/motion";
import { readCart } from "@/lib/cart-client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Search, ArrowUpRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { CmsRecord } from "@/lib/cms/store";
import { SelectInput } from "../admin/ui";
export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "usd",
  }).format(
    amount /
      10 **
        (new Intl.NumberFormat("en", {
          style: "currency",
          currency: currency || "usd",
        }).resolvedOptions().maximumFractionDigits || 0),
  );
export async function cartAction(body: object) {
  await readCart().catch(() => undefined);
  const r = await fetch("/api/store/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  window.dispatchEvent(new Event("cart-updated"));
  return d;
}
export default function Storefront() {
  const [rows, setRows] = useState<CmsRecord[]>([]),
    [q, setQ] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("featured"),
    [maximum, setMaximum] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    fetch("/api/store/products")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRows(d.records);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const categories = [
    ...new Set(rows.map((r) => String(r.data.category)).filter(Boolean)),
  ];
  const filtered = rows
    .filter(
      (r) =>
        `${r.title} ${r.description}`.toLowerCase().includes(q.toLowerCase()) &&
        (category === "all" || r.data.category === category) &&
        (maximum === "" || Number(r.data.priceMinor) <= Number(maximum) * 100),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.data.priceMinor - b.data.priceMinor
        : sort === "high"
          ? b.data.priceMinor - a.data.priceMinor
          : sort === "newest"
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : Number(b.data.featured || false) -
              Number(a.data.featured || false),
    );
  return (
    <main id="main">
      <motion.section
        className="store-hero container"
        initial={reduced ? false : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: motionTiming.section, ease: cinematicEase }}
      >
        <span className="eyebrow">THE DIGITAL STORE</span>
        <h1>
          Premium Digital Products
          <br />& Professional Services
        </h1>
        <p>
          High-quality website templates, UI kits, design assets, and expert
          services to grow your brand and business.
        </p>
        <div className="store-actions">
          <a className="button" href="#products">
            Browse products
            <ArrowUpRight size={17} />
          </a>
          <Link className="button secondary" href="/services">
            Our services
          </Link>
        </div>
      </motion.section>
      <section className="container store-catalog" id="products">
        <div className="store-toolbar">
          <label className="store-search">
            <Search size={18} />
            <input
              aria-label="Search products"
              placeholder="Search products and services…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <SelectInput
            label="Product category"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All products" },
              ...categories.map((value) => ({ value, label: value })),
            ]}
          />
          <SelectInput
            label="Sort products"
            value={sort}
            onChange={setSort}
            options={[
              { value: "featured", label: "Featured" },
              { value: "newest", label: "Newest" },
              { value: "low", label: "Price: low to high" },
              { value: "high", label: "Price: high to low" },
            ]}
          />
          <input
            className="store-price-filter"
            type="number"
            min={0}
            placeholder="Max price"
            aria-label="Maximum price"
            value={maximum}
            onChange={(e) => setMaximum(e.target.value)}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <div className="store-grid">
            {[1, 2, 3].map((n) => (
              <div className="a-skeleton" key={n} />
            ))}
          </div>
        ) : filtered.length ? (
          <>
            <div className="store-grid">
              {filtered.slice((page - 1) * 9, page * 9).map((p, i) => (
                <motion.article
                  className="store-card"
                  key={p.id}
                  initial={reduced ? false : { opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{
                    duration: motionTiming.section,
                    ease: cinematicEase,
                    delay: reduced ? 0 : (i % 3) * motionTiming.stagger,
                  }}
                >
                  <Link href={`/shop/${p.slug}`} className="store-card-image">
                    {p.data.image ? (
                      <img src={p.data.image} alt={p.title} />
                    ) : (
                      <div>
                        <ShoppingBag size={45} />
                      </div>
                    )}
                    <span>
                      {p.data.kind === "service"
                        ? "Professional service"
                        : "Digital product"}
                    </span>
                  </Link>
                  <div className="store-card-body">
                    <small>{p.data.category}</small>
                    <Link href={`/shop/${p.slug}`}>
                      <h2>{p.title}</h2>
                    </Link>
                    <p>{p.description}</p>
                    <div className="store-card-price">
                      <strong>
                        {money(p.data.priceMinor, p.data.currency)}
                      </strong>
                      <small>
                        {p.data.kind === "service"
                          ? "Professional delivery"
                          : "Secure digital access"}
                      </small>
                    </div>
                    <div className="store-card-buttons">
                      <button
                        className="button secondary"
                        onClick={async () => {
                          try {
                            await cartAction({
                              action: "add",
                              productId: p.id,
                            });
                            toast.success("Added to cart");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        Add to cart
                      </button>
                      <Link className="button" href={`/shop/${p.slug}`}>
                        View details
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
            <div className="store-pagination">
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                {page} / {Math.ceil(filtered.length / 9)}
              </span>
              <button
                className="button secondary"
                disabled={page * 9 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="store-empty">
            <ShoppingBag size={40} />
            <h2>
              {rows.length
                ? "No matching products"
                : "The collection is coming together."}
            </h2>
            <p>
              {rows.length
                ? "Try another search or filter."
                : "Published digital products and professional services will appear here."}
            </p>
            <Link className="button" href="/contact">
              Discuss a project
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
