"use client";
import Link from "next/link";
import ContactLocations from "./contact-locations";
import type { CmsRecord } from "@/lib/cms/store";
import DateTimePicker, { localDateValue } from "./controls/date-time-picker";
import { SelectInput } from "./admin/ui";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSite } from "./site-context";
import { Reveal } from "./site";
export default function BookingForm({
  heading,
  description,
  locations = [],
}: {
  locations?: CmsRecord[];
  heading?: string;
  description?: string;
}) {
  const requestId = useRef("");
  const [date, setDate] = useState("");
  const [service, setService] = useState("Discovery call");
  const [busy, setBusy] = useState(false);
  const site = useSite();
  return (
    <section className="section contact-grid" id="booking">
      <Reveal>
        <h2>{heading || "A little time. A lot of possibility."}</h2>
        <p>
          {description ||
            "Request a discovery call. Share a preferred time and we’ll confirm availability with you."}
        </p>
        {locations.length > 0 && (
          <div className="booking-locations">
            <ContactLocations locations={locations} />
          </div>
        )}
      </Reveal>
      <form
        className="contact-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            values = Object.fromEntries(new FormData(form));
          if (!requestId.current) requestId.current = crypto.randomUUID();
          setBusy(true);
          try {
            const response = await fetch("/api/public/booking", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...values,
                requestId: requestId.current,
                requestedAt: new Date(String(values.requestedAt)).toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success("Booking request received", {
              description: "Your preferred time is pending confirmation.",
            });
            form.reset();
            requestId.current = "";
            setDate("");
            setService("Discovery call");
          } catch (error) {
            toast.error("Unable to request a call", {
              description: error instanceof Error ? error.message : "",
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Your name
          <input name="name" required minLength={2} autoComplete="name" />
        </label>
        <label>
          Email address
          <input name="email" required type="email" autoComplete="email" />
        </label>
        <label>
          Phone (optional)
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </label>
        <label>
          Service
          <SelectInput
            name="service"
            label="Service"
            value={service}
            onChange={setService}
            options={[
              ...site.services.map((r) => ({ value: r.title, label: r.title })),
              { value: "Discovery call", label: "Discovery call" },
            ]}
          />
        </label>
        <label>
          Preferred date and time
          <DateTimePicker
            name="requestedAt"
            label="Preferred date and time"
            required
            value={date}
            onChange={setDate}
            min={localDateValue(new Date(Date.now() + 3600000))}
          />
        </label>
        <label>
          A little about your idea
          <textarea name="message" maxLength={3000} />
        </label>
        <label className="honeypot" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <p className="caption">
          We use your details to respond to your request. Read our{" "}
          <Link href="/privacy">privacy notice</Link>.
        </p>
        <button disabled={busy} className="button">
          {busy ? "Sending…" : "Request a call"}
        </button>
      </form>
    </section>
  );
}
