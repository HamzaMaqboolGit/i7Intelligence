"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { CmsRecord } from "@/lib/cms/store";
const Map = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="a-skeleton" style={{ height: 400 }} />,
});
export default function ContactLocations({
  locations,
}: {
  locations: CmsRecord[];
}) {
  const [active, setActive] = useState("");
  if (!locations.length)
    return (
      <section className="contact-location-panel no-location">
        <h2>
          Wherever you are,
          <br />
          let’s connect.
        </h2>
        <p style={{ marginTop: 20, maxWidth: 550 }}>
          Start with a message or request a call. We’ll find the right way to
          collaborate, wherever your next idea takes you.
        </p>
      </section>
    );
  return (
    <section className="contact-location-panel">
      <h2>Find your way to us.</h2>
      <div className="contact-location-list">
        {locations.map((r) => (
          <article key={r.id}>
            <h3>
              <button
                className="location-switch"
                onClick={() => {
                  setActive(r.id);
                }}
              >
                {r.title}
              </button>
            </h3>
            <address>
              {[r.data.address, r.data.city, r.data.country]
                .filter(Boolean)
                .join(", ")}
            </address>
            {r.data.phone && <a href={`tel:${r.data.phone}`}>{r.data.phone}</a>}
            {r.data.email && (
              <a href={`mailto:${r.data.email}`}>{r.data.email}</a>
            )}
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
              href={`https://www.openstreetmap.org/directions?to=${encodeURIComponent(`${r.data.latitude},${r.data.longitude}`)}`}
            >
              Open directions
            </a>
          </article>
        ))}
      </div>
      <Map
        key={active}
        locations={
          active
            ? [
                ...locations.filter((l) => l.id === active),
                ...locations.filter((l) => l.id !== active),
              ].map((l, i) => ({
                ...l,
                data: { ...l.data, primary: i === 0 },
              }))
            : locations
        }
      />
      <p className="caption">
        Map tiles © OpenStreetMap contributors. Loading the map connects to
        OpenStreetMap.
      </p>
    </section>
  );
}
