import type { Report } from "./types";

// Fetch the latest position for an aircraft within a run. Returns null when ADS-B
// has no report yet (404) — a distinct state from an error (which throws).
export async function fetchLatest(
  base: string,
  runId: string,
  aircraftId: string,
  signal?: AbortSignal,
): Promise<Report | null> {
  const url =
    `${base}/api/v1/reports/latest?run_id=${encodeURIComponent(runId)}` +
    `&aircraft_id=${encodeURIComponent(aircraftId)}`;
  const res = await fetch(url, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ADS-B returned ${res.status}`);
  const body = (await res.json()) as { report: Report };
  return body.report;
}

// Fetch the full chronological history for an aircraft within a run — the
// reported track (origin through current position).
export async function fetchHistory(
  base: string,
  runId: string,
  aircraftId: string,
  signal?: AbortSignal,
): Promise<Report[]> {
  const url =
    `${base}/api/v1/reports?run_id=${encodeURIComponent(runId)}` +
    `&aircraft_id=${encodeURIComponent(aircraftId)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`ADS-B returned ${res.status}`);
  const body = (await res.json()) as { reports: Report[] };
  return body.reports;
}

// Fetch the latest position of every aircraft in a run, optionally restricted to
// a map viewport (bbox) and/or a status (e.g. "flying").
export async function fetchPositions(
  base: string,
  runId: string,
  bbox?: string,
  status?: string,
  signal?: AbortSignal,
): Promise<Report[]> {
  const params = new URLSearchParams({ run_id: runId });
  if (bbox) params.set("bbox", bbox);
  if (status) params.set("status", status);
  const res = await fetch(`${base}/api/v1/positions?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`ADS-B returned ${res.status}`);
  const body = (await res.json()) as { positions: Report[] };
  return body.positions;
}

export interface Airport {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation_m?: number | null;
  icao?: string | null;
  country?: string | null;
}

// Fetch airports, optionally restricted to a map viewport
// (bbox = "minLon,minLat,maxLon,maxLat").
export async function fetchAirports(
  base: string,
  bbox?: string,
  signal?: AbortSignal,
): Promise<Airport[]> {
  const query = bbox ? `?bbox=${encodeURIComponent(bbox)}` : "";
  const res = await fetch(`${base}/api/v1/airports${query}`, { signal });
  if (!res.ok) throw new Error(`ADS-B returned ${res.status}`);
  const body = (await res.json()) as { airports: Airport[] };
  return body.airports;
}
