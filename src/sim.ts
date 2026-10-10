export interface SimClock {
  run_id: string;
  simulated_at: string;
  paused: boolean;
}

// Fetch the Simulator's current clock so the tracker can initialize to the
// current simulated time and run on load — before (or without) any NATS ticks,
// which the Simulator does not publish while paused.
export async function fetchClock(base: string): Promise<SimClock> {
  const res = await fetch(`${base}/clock`, { cache: "no-store" });
  if (!res.ok) throw new Error(`simulator /clock returned ${res.status}`);
  return (await res.json()) as SimClock;
}
