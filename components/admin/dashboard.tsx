"use client";
import DateStamp from "../controls/date-stamp";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Briefcase,
  Mail,
  CalendarDays,
  FileText,
  Plus,
  ArrowUpRight,
  ChartNoAxesCombined,
  Activity,
} from "lucide-react";
import { Metric, Skeleton, Empty, Badge } from "./ui";
import type { CmsRecord } from "@/lib/cms/store";
type Overview = {
  metrics: {
    projects: number;
    articles: number;
    contacts: number | null;
    bookings: number | null;
  };
  recentContacts: CmsRecord[];
  recentBookings: CmsRecord[];
  logs: { id: string; description: string; createdAt: string }[];
  drafts: CmsRecord[];
  series: { date: string; inquiries: number; bookings: number }[];
};
export function DataChart({
  series,
  metric = "inquiries",
}: {
  series: Overview["series"];
  metric?: "inquiries" | "bookings";
}) {
  const values = series.map((d) => d[metric]);
  if (!values.some(Boolean))
    return (
      <Empty
        title="No activity in this period"
        description="The chart will update as new requests arrive."
      />
    );
  const max = Math.max(...values, 1);
  const points = values.map(
    (v, i) =>
      `${40 + i * (700 / Math.max(values.length - 1, 1))},${205 - (v / max) * 170}`,
  );
  return (
    <div className="a-chart">
      <svg
        role="img"
        aria-label={`${metric} over the last 30 days, based on stored requests`}
        viewBox="0 0 780 245"
      >
        <defs>
          <linearGradient id={`chart-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="currentColor" stopOpacity=".22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="40"
              x2="740"
              y1={35 + i * 57}
              y2={35 + i * 57}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <text x="10" y={40 + i * 57}>
              {Math.round(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        <path
          d={`M40 205 L${points.join(" L")} L740 205Z`}
          fill={`url(#chart-${metric})`}
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[0, 7, 14, 21, 29].map((i) => (
          <text key={i} x={40 + i * (700 / 29)} y="235" textAnchor="middle">
            {series[i]?.date.slice(5)}
          </text>
        ))}
      </svg>
      <p className="a-chart-caption">
        Stored requests · last 30 days · no estimated visitors
      </p>
    </div>
  );
}
export default function Dashboard({
  name,
  analytics = false,
  permissions,
}: {
  name: string;
  analytics?: boolean;
  permissions: string[];
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<"inquiries" | "bookings">("inquiries");
  const load = useCallback(() => {
    setError("");
    fetch("/api/admin/overview")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  if (error)
    return (
      <Empty
        title="Unable to load dashboard"
        description={error}
        action={
          <button className="a-button" onClick={load}>
            Try again
          </button>
        }
      />
    );
  if (!data) return <Skeleton />;
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: "Asia/Karachi",
  }).format(new Date());
  return (
    <>
      <div className="a-page-heading">
        <div>
          <h1>
            {analytics
              ? "Agency analytics"
              : `Welcome back, ${name.split(" ")[0]}`}
            {!analytics && <span className="a-greeting"> ✦</span>}
          </h1>
          <p>
            {analytics
              ? "A clear view of real enquiries and booking requests."
              : "Here’s what’s happening with your agency today."}
          </p>
        </div>
        <div className="a-date">
          <CalendarDays size={17} />
          {date}
        </div>
      </div>
      <div className="a-metrics">
        <Metric
          label="Portfolio projects"
          value={data.metrics.projects}
          icon={<Briefcase />}
        />
        <Metric
          label="Contact inquiries"
          value={data.metrics.contacts ?? "Restricted"}
          icon={<Mail />}
        />
        <Metric
          label="Booking requests"
          value={data.metrics.bookings ?? "Restricted"}
          icon={<CalendarDays />}
        />
        <Metric
          label="Published articles"
          value={data.metrics.articles}
          icon={<FileText />}
        />
      </div>
      <div className="a-dashboard-charts">
        <section className="a-panel">
          <header>
            <h2>Website inquiries</h2>
            <div className="a-tabs compact">
              <button
                className={metric === "inquiries" ? "active" : ""}
                onClick={() => setMetric("inquiries")}
              >
                Inquiries
              </button>
              <button
                className={metric === "bookings" ? "active" : ""}
                onClick={() => setMetric("bookings")}
              >
                Bookings
              </button>
            </div>
          </header>
          <DataChart series={data.series} metric={metric} />
        </section>
        <section className="a-panel">
          <header>
            <h2>Visitor analytics</h2>
            <ChartNoAxesCombined size={18} />
          </header>
          <Empty
            title="No analytics connected"
            description="Visitor counts and traffic sources appear only when a real analytics integration is configured."
          />
        </section>
      </div>
      <div className="a-dashboard-lower">
        <section className="a-panel">
          <header>
            <h2>Recent inquiries</h2>
            <Link href="/admin/contacts">
              View all <ArrowUpRight size={14} />
            </Link>
          </header>
          {data.recentContacts.length ? (
            <div className="a-recent-list">
              {data.recentContacts.map((r) => (
                <Link href={`/admin/contacts?edit=${r.id}`} key={r.id}>
                  <span className="a-person-avatar">
                    {r.data.name?.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{r.data.name}</strong>
                    <p>{r.title}</p>
                  </div>
                  <DateStamp value={r.createdAt} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="No inquiries yet"
              description="Contact form messages will appear here."
            />
          )}
        </section>
        <section className="a-panel">
          <header>
            <h2>Latest bookings</h2>
            <Link href="/admin/bookings">
              View all <ArrowUpRight size={14} />
            </Link>
          </header>
          {data.recentBookings.length ? (
            <div className="a-recent-list">
              {data.recentBookings.map((r) => (
                <Link href={`/admin/bookings?edit=${r.id}`} key={r.id}>
                  <span className="a-person-avatar">
                    <CalendarDays size={18} />
                  </span>
                  <div>
                    <strong>{r.data.name}</strong>
                    <p>
                      {r.data.requestedAt ? (
                        <DateStamp value={r.data.requestedAt} />
                      ) : (
                        r.title
                      )}
                    </p>
                  </div>
                  <Badge status={r.status} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="No booking requests"
              description="New requests will appear here when submitted."
            />
          )}
        </section>
        <section className="a-panel">
          <header>
            <h2>Recent activity</h2>
            <Activity size={18} />
          </header>
          {data.logs.length ? (
            <div className="a-activity-list">
              {data.logs.map((log) => (
                <div key={log.id}>
                  <span />
                  <div>
                    <strong>{log.description}</strong>
                    <DateStamp value={log.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="A quiet moment"
              description="Authorized content activity will appear here."
            />
          )}
        </section>
      </div>
      <div className="a-dashboard-charts">
        <section className="a-panel">
          <header>
            <h2>Draft articles</h2>
            <Link href="/admin/blog">
              Open editor <ArrowUpRight size={14} />
            </Link>
          </header>
          {data.drafts.length ? (
            data.drafts.map((r) => (
              <Link
                className="a-draft-link"
                href={`/admin/blog?edit=${r.id}`}
                key={r.id}
              >
                <FileText size={18} />
                {r.title}
                <Badge status="draft" />
              </Link>
            ))
          ) : (
            <Empty
              title="No drafts waiting"
              description="Your next idea can start here."
            />
          )}
        </section>
        <section className="a-panel">
          <header>
            <h2>Quick actions</h2>
          </header>
          <div className="a-quick-actions">
            {[
              ["portfolio", "Add project", Plus],
              ["blog", "New article", FileText],
              ["sections", "Edit homepage", LayersIcon],
              ["settings", "Site settings", ChartNoAxesCombined],
            ]
              .filter(([href]) => permissions.includes(`${href}:write`))
              .map(([href, label, Icon]) => {
                const Component = Icon as React.ElementType;
                return (
                  <Link
                    key={String(href)}
                    href={`/admin/${href}${href === "portfolio" || href === "blog" ? "?new=1" : ""}`}
                  >
                    <span>
                      <Component size={22} />
                    </span>
                    {String(label)}
                  </Link>
                );
              })}
          </div>
        </section>
      </div>
    </>
  );
}
function LayersIcon() {
  return <Briefcase />;
}
