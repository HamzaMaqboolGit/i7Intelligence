"use client";
import Link from "next/link";
import { toast } from "sonner";
import { SelectInput } from "./admin/ui";
import { useRef, useState } from "react";
export default function ContactForm() {
  const requestId = useRef("");
  const [service, setService] = useState("Website design");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  return (
    <form
      className="contact-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!requestId.current) requestId.current = crypto.randomUUID();
        setBusy(true);
        setStatus("");
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        try {
          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data,
              service,
              consent: data.consent === "on",
              requestId: requestId.current,
            }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              result.error || "Unable to save your message. Please try again.",
            );
          setOk(true);
          setStatus(
            `Thank you. Your enquiry has been saved. Reference: ${result.reference}`,
          );
          toast.success("Message received", {
            description: `Your enquiry has been saved. Reference: ${result.reference}`,
          });
          form.reset();
          requestId.current = "";
        } catch (error) {
          setOk(false);
          toast.error("Unable to send your message", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
          setStatus(
            error instanceof Error ? error.message : "Please try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Your name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          placeholder="Alex Morgan"
        />
      </label>
      <label>
        Email address
        <input
          name="email"
          required
          type="email"
          maxLength={254}
          autoComplete="email"
          placeholder="alex@company.com"
        />
      </label>
      <label>
        Phone number (optional)
        <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </label>
      <label>
        Subject
        <input
          name="subject"
          required
          minLength={2}
          maxLength={150}
          placeholder="A new website for our business"
        />
      </label>
      <label>
        What can we help with?
        <SelectInput
          label="Service selection"
          value={service}
          onChange={setService}
          options={[
            "Website design",
            "Brand identity",
            "Product design",
            "Development",
            "Careers",
            "Something else",
          ].map((value) => ({ value, label: value }))}
        />
      </label>
      <label>
        Tell us about your project
        <textarea
          name="message"
          required
          minLength={20}
          maxLength={5000}
          placeholder="A little about your idea, goals and timing…"
        />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="contact-consent">
        <input type="checkbox" name="consent" required />I agree to the privacy
        notice and to being contacted about this inquiry.
      </label>
      <p className="caption">
        We use these details to respond to your enquiry. Read our{" "}
        <Link href="/privacy">privacy notice</Link>.
      </p>
      <button className="button" disabled={busy} type="submit">
        {busy ? "Sending…" : "Send your enquiry"}
      </button>
      <p
        className={`form-message ${ok ? "" : "error"}`}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
    </form>
  );
}
