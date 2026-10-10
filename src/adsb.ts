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
