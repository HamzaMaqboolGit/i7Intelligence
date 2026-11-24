"use client";
import DateStamp from "../../controls/date-stamp";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingBag, CreditCard, Download, Plus } from "lucide-react";
import { Metric, Skeleton, Empty, Badge, SelectInput } from "../ui";
import Manager from "../manager";
import StoreSettings from "./settings";
import OrderDetail from "./order-detail";
import ProductEditor from "./product-editor";
import { money } from "../../store/storefront";
/* eslint-disable @typescript-eslint/no-explicit-any -- Commerce overview responses are validated by authorized server routes. */
export default function StoreAdmin({
  path,
  permissions,
}: {
  path: string[];
  permissions: string[];
}) {
  const screen = path[0] || "overview",
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1);
  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/admin/store/overview?page=${page}&status=${status}&q=${encodeURIComponent(q)}`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page, q, status]);
  useEffect(() => {
    void load();
  }, [load]);
  if (screen === "settings")
    return (
      <StoreSettings canWrite={permissions.includes("store-settings:write")} />
    );
  if (screen === "orders" && path[1])
    return (
      <OrderDetail
        id={path[1]}
        canWrite={permissions.includes("store:write")}
      />
    );
  if (screen === "products" && (path[1] === "create" || path[2] === "edit"))
    return <ProductEditor id={path[2] === "edit" ? path[1] : undefined} />;
  if (screen === "products")
    return (
      <>
        <div className="a-button-row" style={{ marginBottom: 25 }}>
          <Link className="a-button" href="/admin/store/products/create">
            <Plus size={16} />
            Create product / service
          </Link>
        </div>
        <Manager module="store-products" permissions={permissions} />
      </>
    );
  if (screen === "categories" || screen === "coupons")
    return <Manager module={`store-${screen}`} permissions={permissions} />;
  if (error)
    return (
      <div className="a-error">
        {error}
        <button onClick={load}>Retry</button>
      </div>
    );
  if (!data) return <Skeleton />;
  const title =
    (
      {
        overview: "Digital Store",
        orders: "Orders",
        customers: "Customers",
        payments: "Payments",
        deliveries: "Digital Deliveries",
        settings: "Store Settings",
      } as Record<string, string>
    )[screen] || "Digital Store";
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>{title}</h1>
          <p>Manage digital products, service orders and protected delivery.</p>
        </div>
        <Link className="a-button" href="/admin/store/products/create">
          <Plus size={16} />
          Add product
        </Link>
      </div>
      {screen === "overview" && (
        <>
          <div className="a-metrics">
            <Metric
              label="Total orders"
              value={data.total}
              icon={<ShoppingBag />}
            />
            <Metric
              label="Digital products"
              value={data.products}
              icon={<Package />}
            />
            <Metric
              label="Active services"
              value={data.services}
              icon={<CreditCard />}
            />
            <Metric
              label="Downloads"
              value={data.downloads}
              icon={<Download />}
            />
          </div>
          <div className="a-panel">
            <h2>Revenue by currency</h2>
            {data.groups
              .filter((g: any) => g.paymentStatus === "paid")
              .map((g: any) => (
                <p key={g.currency}>
                  {g.currency.toUpperCase()} ·{" "}
                  {money(g._sum.total || 0, g.currency)} · {g._count} paid
                  orders
                </p>
              ))}
            {!data.groups.some((g: any) => g.paymentStatus === "paid") && (
              <p className="a-muted">
                No paid orders yet. Revenue appears only after verified
                payments.
              </p>
            )}
          </div>
        </>
      )}
      {["overview", "orders", "payments"].includes(screen) && (
        <div className="a-panel">
          <div className="a-toolbar">
            <input
              className="a-search-input"
              aria-label="Search orders"
              placeholder="Search order or customer…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <SelectInput
              label="Payment status filter"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                "all",
                "paid",
                "pending",
                "failed",
                "refunded",
                "disputed",
              ].map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Delivery</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o: any) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/store/orders/${o.id}`}>
                        {o.reference}
                      </Link>
                    </td>
                    <td>
                      <strong>{o.customer.name}</strong>
                      <p>{o.customer.email}</p>
                    </td>
                    <td>{o.items.map((i: any) => i.title).join(", ")}</td>
                    <td>{money(o.total, o.currency)}</td>
                    <td>
                      <Badge status={o.paymentStatus} />
                    </td>
                    <td>
                      <Badge status={o.fulfillmentStatus} />
                    </td>
                    <td>{<DateStamp value={o.createdAt} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.orders.length && (
            <Empty
              title="No orders yet"
              description="Customer orders and provider-confirmed payment records will appear here."
            />
          )}
          <div className="a-pagination">
            <span>{data.total} orders</span>
            <div>
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>{page}</span>
              <button
                disabled={page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      {screen === "customers" && (
        <div className="a-panel a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Country</th>
                <th>Orders</th>
                <th>Spent by currency</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <p>{c.email}</p>
                  </td>
                  <td>{c.country || "—"}</td>
                  <td>{c.orders.length}</td>
                  <td>
                    {Object.entries(
                      c.orders
                        .filter((o: any) => o.paymentStatus === "paid")
                        .reduce(
                          (sum: any, o: any) => ({
                            ...sum,
                            [o.currency]: (sum[o.currency] || 0) + o.total,
                          }),
                          {},
                        ),
                    ).map(([currency, total]) => (
                      <p key={currency}>{money(total as number, currency)}</p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.customers.length && (
            <Empty
              title="No customers yet"
              description="Guest customers are created during checkout and matched by normalized email."
            />
          )}
        </div>
      )}
      {screen === "deliveries" && (
        <div className="a-panel a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>File</th>
                <th>Expires</th>
                <th>Downloads used</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveries.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.item.order.reference}</td>
                  <td>{d.item.order.customer.email}</td>
                  <td>
                    {d.file.name} · {d.file.version}
                  </td>
                  <td>{<DateStamp value={d.expiresAt} />}</td>
                  <td>
                    {d.used} / {d.maximum}
                  </td>
                  <td>
                    <Badge
                      status={
                        d.revokedAt
                          ? "revoked"
                          : new Date(d.expiresAt) < new Date()
                            ? "expired"
                            : "active"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.deliveries.length && (
            <Empty
              title="No digital deliveries yet"
              description="Entitlements are created only after verified payment."
            />
          )}
        </div>
      )}
      {screen === "settings" && (
        <div className="a-panel">
          <h2>Payment & delivery configuration</h2>
          <p className="a-muted">
            Stripe:{" "}
            {data.stripeConfigured
              ? `${data.mode} mode configured`
              : "Not configured"}{" "}
            · Webhook:{" "}
            {data.webhookConfigured ? "Configured" : "Not configured"}
          </p>
          <p className="a-muted">
            Stripe secrets are server-side environment variables. No secret key
            is returned to this screen.
          </p>
          <p className="a-muted">
            Private files are stored separately from public media. Configure
            STORE_FILE_DIRECTORY for persistent private storage.
          </p>
          <Link className="a-button secondary" href="/admin/settings">
            Configure SMTP and delivery templates
          </Link>
        </div>
      )}
    </div>
  );
}
