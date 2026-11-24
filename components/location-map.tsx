"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import type { CmsRecord } from "@/lib/cms/store";
import "leaflet/dist/leaflet.css";
export default function LocationMap({ locations }: { locations: CmsRecord[] }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timer);
  }, [loaded, attempt]);
  const first = locations.find((l) => l.data.primary) || locations[0];
  const marker = L.divIcon({
    className: "agency-map-marker",
    html: '<span aria-hidden="true"></span>',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
  });
  return (
    <div
      className="office-map"
      role="region"
      aria-label="Agency office locations"
      style={{
        height: 420,
        borderRadius: 24,
        overflow: "hidden",
        marginTop: 30,
      }}
    >
      <MapContainer
        key={attempt}
        center={[Number(first.data.latitude), Number(first.data.longitude)]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        {
          <TileLayer
            eventHandlers={{
              tileload: () => {
                setLoaded(true);
                setFailed(false);
              },
              tileerror: () => setFailed(true),
            }}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        }
        {locations.map((r) => (
          <Marker
            key={r.id}
            position={[Number(r.data.latitude), Number(r.data.longitude)]}
            icon={marker}
          >
            <Popup>
              <strong>{r.title}</strong>
              <br />
              {[r.data.address, r.data.city, r.data.country]
                .filter(Boolean)
                .join(", ")}
              <br />
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={
                  r.data.mapsUrl ||
                  `https://www.openstreetmap.org/directions?to=${r.data.latitude},${r.data.longitude}`
                }
              >
                Directions
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {failed && !loaded && (
        <div className="office-map-status" role="status">
          <strong>Map imagery is unavailable.</strong>
          <p>Your office location is still available through directions.</p>
          <a
            href={`https://www.openstreetmap.org/directions?to=${first.data.latitude},${first.data.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open directions ↗
          </a>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setAttempt((v) => v + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
