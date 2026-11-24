"use client";
import { useState } from "react";
import { ShoppingBag, Lock, Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CmsRecord } from "@/lib/cms/store";
import { SelectInput, Drawer } from "../admin/ui";
import { cartAction, money } from "./storefront";
export default function Product({ product: p }: { product: CmsRecord }) {
  const [image, setImage] = useState(p.data.image || ""),
    [license, setLicense] = useState("standard"),
    [quantity, setQuantity] = useState(1),
    [tab, setTab] = useState("Overview"),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const packages = p.data.packages || [];
  const amount =
    packages.find((l: { key: string }) => l.key === license)?.priceMinor ??
    p.data.priceMinor;
  async function add(buy = false) {
    setBusy(true);
    try {
      await cartAction({
        action: "add",
        productId: p.id,
        package: license,
        quantity,
      });
      toast.success("Added to cart");
      if (buy) router.push("/checkout");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container store-product" id="main">
      <p className="eyebrow">STORE / {p.data.category || p.data.kind}</p>
      <div className="store-product-grid">
        <section>
          <div className="store-main-image">
            {image ? (
              <img src={image} alt={p.title} />
            ) : (
              <ShoppingBag size={80} />
            )}
            <button
              aria-label="Fullscreen product preview"
              onClick={() => setPreview(true)}
            >
              <Maximize2 size={20} />
            </button>
          </div>
          <div className="store-thumbnails">
            {[
              p.data.image,
              ...(p.data.gallery || []).map((i: { image: string }) => i.image),
            ]
              .filter(Boolean)
              .map((src, i) => (
                <button
                  aria-label={`View image ${i + 1}`}
                  key={i}
                  onClick={() => setImage(src)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
          </div>
        </section>
        <section className="store-product-info">
          <span className="store-pill">
            {p.data.kind === "service"
              ? "Professional service"
              : "Digital product"}
          </span>
          <h1>{p.title}</h1>
          <strong className="store-product-price">
            {money(amount, p.data.currency)}
          </strong>
          <p>{p.description}</p>
          <ul>
            {String(p.data.features || "")
              .split("\n")
              .filter(Boolean)
              .map((f, i) => (
                <li key={i}>{f}</li>
              ))}
          </ul>
          <label>
            License / package
            <SelectInput
              label="Product license"
              value={license}
              onChange={setLicense}
              options={[
                { value: "standard", label: "Standard license" },
                ...packages.map((l: { key: string; title: string }) => ({
                  value: l.key,
                  label: l.title,
                })),
              ]}
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.min(20, Math.max(1, Number(e.target.value))))
              }
            />
          </label>
          <div className="store-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => add()}
            >
              Add to cart
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => add(true)}
            >
              Buy now
            </button>
          </div>
          <p className="store-secure">
            <Lock size={15} />
            Payments processed securely by Stripe when configured.
          </p>
          <p>
            {p.data.kind === "service"
              ? `Turnaround: ${p.data.turnaround || "Agreed during project planning"}`
              : "Private file access is granted only after verified payment."}
          </p>
        </section>
      </div>
      <section className="store-product-tabs">
        <div className="a-tabs">
          {[
            "Overview",
            "What's Included",
            "Requirements",
            "FAQs",
            "Reviews",
          ].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="prose interaction-reveal" key={tab}>
          {tab === "Overview" ? (
            <div dangerouslySetInnerHTML={{ __html: p.data.body || "" }} />
          ) : tab === "What's Included" ? (
            <p className="a-message-text">
              {p.data.included || "Details are available from the studio."}
            </p>
          ) : tab === "Requirements" ? (
            <>
              <p className="a-message-text">
                {p.data.requirements ||
                  "No additional requirements configured."}
              </p>
              <p>{p.data.license}</p>
              <p>{p.data.revisions}</p>
            </>
          ) : tab === "Reviews" ? (
            <p>No verified reviews have been published for this product.</p>
          ) : (
            <p>
              Have a question? Contact the studio before placing your order.
            </p>
          )}
        </div>
      </section>
      <Drawer
        open={preview}
        onClose={() => setPreview(false)}
        title={p.title}
        wide
      >
        {image && (
          <img
            src={image}
            alt={p.title}
            style={{ width: "100%", height: "auto" }}
          />
        )}
      </Drawer>
    </main>
  );
}
