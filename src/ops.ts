// Client for the Operations control plane. ADS-B position reports carry no
// origin/destination/aircraft-type, so the tracker reads those from Operations:
// the selected aircraft's current leg, and the airport roster for names/coords.

export interface FlightDetail {
  flightNumber: string;
  aircraftId: string;
  aircraftType: string;
  originCode: string;
  destinationCode: string;
}

export interface OpsAirport {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface AircraftResponse {
  aircraft: {
    id: string;
    type: string;
    base_airport_code: string;
    location: {
      state: string;
      airport?: string;
      flight?: {
        flight_instance_id: string;
        flight_number: string;
        origin: string;
        destination: string;
      };
      source?: string;
    };
  };
}

// Fetch the selected aircraft's current leg. Returns null unless it is flying
// (only then are origin/destination meaningful for a planned route line).
export async function fetchFlightDetail(
  base: string,
  runId: string,
  aircraftId: string,
  at: string | null,
  signal?: AbortSignal,
): Promise<FlightDetail | null> {
  const params = new URLSearchParams({ run_id: runId });
  if (at) params.set("at", at);
  const res = await fetch(
    `${base}/api/v1/aircraft/${encodeURIComponent(aircraftId)}?${params.toString()}`,
    { signal },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Operations returned ${res.status}`);
  const body = (await res.json()) as AircraftResponse;
  const ac = body.aircraft;
  if (ac.location.state !== "flying" || !ac.location.flight) return null;
  return {
    flightNumber: ac.location.flight.flight_number,
    aircraftId: ac.id,
    aircraftType: ac.type,
    originCode: ac.location.flight.origin,
    destinationCode: ac.location.flight.destination,
  };
}

// Fetch the full airport roster keyed by code (for names and coordinates).
export async function fetchOpsAirports(
  base: string,
  signal?: AbortSignal,
): Promise<Map<string, OpsAirport>> {
  const res = await fetch(`${base}/api/v1/airports`, { signal });
  if (!res.ok) throw new Error(`Operations returned ${res.status}`);
  const body = (await res.json()) as { airports: OpsAirport[] };
  return new Map(body.airports.map((a) => [a.code, a]));
}
