import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Config, Report } from "./types";

// A plane pointing north (up) at rotation 0; MapView rotates it to the heading.
const PLANE_SVG = `
<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
  <path d="M12 2 L14 11 L22 15 L22 17 L13 15 L13 20 L16 22 L16 23 L12 22 L8 23 L8 22 L11 20 L11 15 L2 17 L2 15 L10 11 Z"
        fill="#f8fafc" stroke="#0f172a" stroke-width="0.8" stroke-linejoin="round"/>
</svg>`;

// A self-contained style needing no network, used when the configured style
// cannot load (e.g. offline). Markers still render on this plain background.
const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b1b2b" } }],
};

type Mode = "loading" | "live" | "offline";

export function MapView({ config, aircraft }: { config: Config; aircraft: Report | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const aircraftMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mode, setMode] = useState<Mode>("loading");

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    // A URL hash (#zoom/lat/lng) makes the view shareable; MapLibre keeps it in
    // sync on move. If one is present we honor it instead of auto-fitting.
    const hadHash = window.location.hash.length > 1;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: config.mapStyle,
      center: [config.airports[0].lon, config.airports[0].lat],
      zoom: 5,
      attributionControl: { compact: true },
      hash: true,
    });
    mapRef.current = map;

    let overlaysAdded = false;
    let fellBack = false;
    let loaded = false;

    const addOverlays = () => {
      if (overlaysAdded) return;
      overlaysAdded = true;
      const bounds = new maplibregl.LngLatBounds();
      for (const airport of config.airports) {
        bounds.extend([airport.lon, airport.lat]);
        const el = document.createElement("div");
        el.className = "airport";
        el.innerHTML = `<span class="airport-dot"></span><span class="airport-code">${airport.code}</span>`;
        el.title = airport.name;
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([airport.lon, airport.lat])
          .addTo(map);
      }
      // Don't override a shared view from the URL.
      if (!hadHash) map.fitBounds(bounds, { padding: 140, duration: 0 });
    };

    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      setMode("offline");
      map.setStyle(OFFLINE_STYLE);
    };

    map.on("load", () => {
      loaded = true;
      setMode((m) => (m === "offline" ? m : "live"));
    });
    // Fires for the initial style and again after setStyle (offline fallback).
    map.on("style.load", addOverlays);
    map.on("error", () => {
      if (!loaded && !map.isStyleLoaded()) fallback();
    });

    // If nothing has loaded in time, assume the style is unreachable.
    const timer = window.setTimeout(() => {
      if (!loaded) fallback();
    }, 8000);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, [config]);

  // Create/update/remove the aircraft marker as reports arrive.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!aircraft) {
      aircraftMarkerRef.current?.remove();
      aircraftMarkerRef.current = null;
      return;
    }

    if (!aircraftMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "aircraft";
      el.innerHTML = PLANE_SVG;
      aircraftMarkerRef.current = new maplibregl.Marker({
        element: el,
        rotationAlignment: "map",
      }).setLngLat([aircraft.longitude, aircraft.latitude]);
      aircraftMarkerRef.current.addTo(map);
    } else {
      aircraftMarkerRef.current.setLngLat([aircraft.longitude, aircraft.latitude]);
    }
    aircraftMarkerRef.current.setRotation(aircraft.heading_deg);
  }, [aircraft]);

  return (
    <>
      <div ref={containerRef} className="map" />
      {mode === "offline" && (
        <div className="map-note" role="status">
          Offline map background — the configured map style could not be reached.
        </div>
      )}
    </>
  );
}
