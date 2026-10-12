import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import type { Config, Report } from "./types";

// Register the pmtiles:// protocol so MapLibre can read a self-hosted PMTiles
// archive via HTTP range requests. Safe to call once at module load.
maplibregl.addProtocol("pmtiles", new Protocol().tile);

// A plane pointing north (up) at rotation 0; MapView rotates it to the heading.
// Fill is currentColor so CSS can tint it (white normally, yellow when selected).
const PLANE_SVG = `
<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
  <path d="M12 2 L14 11 L22 15 L22 17 L13 15 L13 20 L16 22 L16 23 L12 22 L8 23 L8 22 L11 20 L11 15 L2 17 L2 15 L10 11 Z"
        fill="currentColor" stroke="#0f172a" stroke-width="0.8" stroke-linejoin="round"/>
</svg>`;

const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b1b2b" } }],
};

// A dark basemap over a self-hosted PMTiles archive (served at /basemap.pmtiles).
// No glyphs/sprite, so no font/icon network dependency — fully offline.
function pmtilesStyle(): StyleSpecification {
  const url = `pmtiles://${window.location.origin}/basemap.pmtiles`;
  return {
    version: 8,
    sources: {
      basemap: { type: "vector", url, attribution: "© OpenStreetMap contributors, © Protomaps" },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0b1b2b" } },
      { id: "earth", type: "fill", source: "basemap", "source-layer": "earth", paint: { "fill-color": "#15293b" } },
      {
        id: "landcover",
        type: "fill",
        source: "basemap",
        "source-layer": "landcover",
        paint: { "fill-color": "#17324a", "fill-opacity": 0.5 },
      },
      { id: "water", type: "fill", source: "basemap", "source-layer": "water", paint: { "fill-color": "#0b1f33" } },
      {
        id: "roads",
        type: "line",
        source: "basemap",
        "source-layer": "roads",
        paint: { "line-color": "#2b405a", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 8, 1.2] },
      },
      {
        id: "boundaries",
        type: "line",
        source: "basemap",
        "source-layer": "boundaries",
        paint: { "line-color": "#3a5674", "line-width": 0.7 },
      },
    ],
  } as StyleSpecification;
}

function resolveStyle(mapStyle: string): string | StyleSpecification {
  if (mapStyle === "pmtiles") return pmtilesStyle();
  if (mapStyle) return mapStyle; // an external style URL
  return OFFLINE_STYLE; // plain dark background
}

const SELECTED = "#facc15";
const LINE_SRC = "ft-line";
const LINE_LYR = "ft-line-layer";
const PTS_SRC = "ft-points";
const PTS_LYR = "ft-points-layer";
const PLAN_SRC = "ft-plan";
const PLAN_LYR = "ft-plan-layer";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type Lng = [number, number];

function lineFeature(coordinates: Lng[]): GeoJSON.Feature {
  return { type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} };
}
function pointsCollection(coords: Lng[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: coords.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} })),
  };
}

export function MapView({
  config,
  aircraft,
  selected,
  track,
  onSelect,
  onDeselect,
}: {
  config: Config;
  aircraft: Report | null;
  selected: boolean;
  track: Report[];
  onSelect: () => void;
  onDeselect: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const hadHashRef = useRef(false);
  const userMovedRef = useRef(false);
  const aircraftFitDoneRef = useRef(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  // Live mirrors so event handlers (which outlive a render) read current values.
  const selectedRef = useRef(selected);
  const aircraftRef = useRef(aircraft);
  const trackRef = useRef(track);
  const onSelectRef = useRef(onSelect);
  const onDeselectRef = useRef(onDeselect);
  selectedRef.current = selected;
  aircraftRef.current = aircraft;
  trackRef.current = track;
  onSelectRef.current = onSelect;
  onDeselectRef.current = onDeselect;

  // Create the track sources/layers (empty, hidden). Called on style load, when
  // the style is guaranteed ready to accept them — unlike isStyleLoaded(), which
  // is unreliable after a setStyle (offline fallback).
  const ensureTrackLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || map.getSource(LINE_SRC)) return;
    map.addSource(PLAN_SRC, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: PLAN_LYR,
      type: "line",
      source: PLAN_SRC,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#9aa0aa", "line-width": 2, "line-dasharray": [2, 2] },
    });
    map.addSource(LINE_SRC, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: LINE_LYR,
      type: "line",
      source: LINE_SRC,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: { "line-color": SELECTED, "line-width": 2 },
    });
    map.addSource(PTS_SRC, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: PTS_LYR,
      type: "circle",
      source: PTS_SRC,
      layout: { visibility: "none" },
      paint: { "circle-radius": 3, "circle-color": SELECTED, "circle-stroke-color": "#0f172a", "circle-stroke-width": 1 },
    });
  }, []);

  // Push current selection/track into the layers (setData + visibility work once
  // the layers exist, regardless of isStyleLoaded()).
  const applyTrack = useCallback(() => {
    const map = mapRef.current;
    const lineSrc = map?.getSource(LINE_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!map || !lineSrc) return; // layers not created yet; style.load will apply
    try {
      const sel = selectedRef.current;
      const ac = aircraftRef.current;
      const tr = trackRef.current;
      const show = sel && !!ac && tr.length > 0;
      if (show) {
        const coords: Lng[] = tr.map((r) => [r.longitude, r.latitude]);
        const dest = config.airports[config.airports.length - 1];
        lineSrc.setData(lineFeature(coords));
        (map.getSource(PTS_SRC) as maplibregl.GeoJSONSource).setData(pointsCollection(coords));
        (map.getSource(PLAN_SRC) as maplibregl.GeoJSONSource).setData(
          lineFeature([[ac!.longitude, ac!.latitude], [dest.lon, dest.lat]]),
        );
      }
      const vis = show ? "visible" : "none";
      for (const id of [LINE_LYR, PTS_LYR, PLAN_LYR]) map.setLayoutProperty(id, "visibility", vis);
      map.triggerRepaint();
      setDrawError(null);
    } catch (err) {
      console.error("track render failed", err);
      setDrawError(String(err));
    }
  }, [config]);

  // Initialize the map once, synchronously, with a self-contained dark style by
  // default. External tile styles are unreliable here, and a background-only
  // style loads instantly — so isStyleLoaded() is true (which MapLibre needs to
  // render added layers) and the aircraft marker is available on first paint.
  // Set config.mapStyle to a reachable style URL to use a real basemap.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    hadHashRef.current = window.location.hash.length > 1;

    const map = new maplibregl.Map({
      container,
      style: resolveStyle(config.mapStyle),
      center: [config.airports[0].lon, config.airports[0].lat],
      zoom: 5,
      attributionControl: { compact: true },
      hash: true,
    });
    mapRef.current = map;

    let overlaysAdded = false;
    const addOverlays = () => {
      if (overlaysAdded) return;
      overlaysAdded = true;
      for (const airport of config.airports) {
        const el = document.createElement("div");
        el.className = "airport";
        el.innerHTML = `<span class="airport-dot"></span><span class="airport-code">${airport.code}</span>`;
        el.title = airport.name;
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([airport.lon, airport.lat])
          .addTo(map);
      }
    };

    map.on("style.load", () => {
      addOverlays();
      ensureTrackLayers();
      applyTrack();
    });

    // Deselect only on a stationary click on the map background — not a drag.
    let downPt: maplibregl.Point | null = null;
    map.on("mousedown", (e) => {
      downPt = e.point;
    });
    map.on("mouseup", (e) => {
      const start = downPt;
      downPt = null;
      if (start && Math.hypot(e.point.x - start.x, e.point.y - start.y) <= 3) {
        onDeselectRef.current();
      }
    });
    const markMoved = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userMovedRef.current = true;
    };
    map.on("dragstart", markMoved);
    map.on("zoomstart", markMoved);
    map.on("rotatestart", markMoved);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      markerElRef.current = null;
    };
  }, [config, ensureTrackLayers, applyTrack]);

  // Default view: a box containing the airports (and the aircraft once known),
  // unless the URL specifies a view or the user has moved the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hadHashRef.current || userMovedRef.current || aircraftFitDoneRef.current) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const a of config.airports) bounds.extend([a.lon, a.lat]);
    if (aircraft) {
      bounds.extend([aircraft.longitude, aircraft.latitude]);
      aircraftFitDoneRef.current = true;
    }
    map.fitBounds(bounds, { padding: 140, duration: 0 });
  }, [aircraft, config]);

  // Create/update/remove the aircraft marker; tint it when selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!aircraft) {
      markerRef.current?.remove();
      markerRef.current = null;
      markerElRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "aircraft";
      el.innerHTML = PLANE_SVG;
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current();
      });
      markerElRef.current = el;
      markerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([aircraft.longitude, aircraft.latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([aircraft.longitude, aircraft.latitude]);
    }
    markerRef.current.setRotation(aircraft.heading_deg);
    markerElRef.current?.classList.toggle("selected", selected);
  }, [aircraft, selected]);

  // Update the track whenever selection or reports change.
  useEffect(() => {
    applyTrack();
  }, [selected, track, aircraft, applyTrack]);

  return (
    <>
      <div ref={containerRef} className="map" />
      {drawError && (
        <div className="map-note track-error" role="alert">
          Track render error: {drawError}
        </div>
      )}
    </>
  );
}
