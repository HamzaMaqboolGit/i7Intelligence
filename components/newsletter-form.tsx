"use client";
import { useState } from "react";
import { toast } from "sonner";
export default function NewsletterForm({
  title = "A fresh perspective, now and then.",
}: {
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="newsletter-signup">
      <h3>{title}</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = e.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          try {
            const response = await fetch("/api/public/newsletter", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: values.email,
                consent: values.consent === "on",
                website: values.website,
              }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success("Subscription received");
            form.reset();
          } catch (error) {
            toast.error("Unable to subscribe", {
              description: error instanceof Error ? error.message : "",
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="Your email address"
          autoComplete="email"
        />
        <button className="button" disabled={busy}>
          {busy ? "Sending…" : "Subscribe"}
        </button>
        <label className="newsletter-consent">
          <input name="consent" type="checkbox" required />I agree to receive
          occasional studio updates.
        </label>
        <label className="honeypot" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </form>
    </section>
  );
}
