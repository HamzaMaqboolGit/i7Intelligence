"use client";
import { useBranding } from "../theme-provider";
import { CalendarDays, Clock3 } from "lucide-react";
export default function DateStamp({
  value,
  time = true,
}: {
  value: string | Date;
  time?: boolean;
}) {
  const settings = useBranding();
  const date = new Date(value);
  if (!Number.isFinite(+date)) return <span>—</span>;
  let locale = settings.language,
    timeZone = settings.timezone;
  try {
    new Intl.DateTimeFormat(locale, { timeZone });
  } catch {
    locale = "en";
    timeZone = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const part = (key: string) => parts.find((p) => p.type === key)?.value || "";
  const formatted =
    settings.dateFormat === "yyyy-MM-dd"
      ? `${part("year")}-${part("month")}-${part("day")}`
      : settings.dateFormat === "dd/MM/yyyy"
        ? `${part("day")}/${part("month")}/${part("year")}`
        : settings.dateFormat === "MM/dd/yyyy"
          ? `${part("month")}/${part("day")}/${part("year")}`
          : date.toLocaleDateString(locale, {
              timeZone,
              month: "short",
              day: "numeric",
              year: "numeric",
            });
  return (
    <time
      className="date-stamp"
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
    >
      <span suppressHydrationWarning>
        <CalendarDays size={12} />
        {formatted}
      </span>
      {time && (
        <small suppressHydrationWarning>
          <Clock3 size={11} />
          {date.toLocaleTimeString(locale, {
            timeZone,
            hour12: settings.timeFormat !== "24",
            hour: "numeric",
            minute: "2-digit",
          })}
        </small>
      )}
    </time>
  );
}
