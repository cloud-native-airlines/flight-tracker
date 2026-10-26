export interface SimClock {
  run_id: string;
  simulated_at: string;
  paused: boolean;
  speed: number;
  tick_interval: number;
  tick_id: number;
}

// Ladders mirror the Simulator UI so both surfaces step through the same values.
export const SPEED_LADDER = [1, 2, 5, 10, 30, 60, 120, 300, 600];
export const INTERVAL_LADDER = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30];

// Find the nearest ladder value to `current`, then move one notch in `dir` (+1 / -1).
export function stepLadder(ladder: number[], current: number, dir: 1 | -1): number {
  let idx = 0;
  let best = Infinity;
  ladder.forEach((v, i) => {
    const d = Math.abs(v - current);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  idx = Math.min(ladder.length - 1, Math.max(0, idx + dir));
  return ladder[idx];
}

async function clockRequest(
  base: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, number>,
): Promise<SimClock> {
  const opts: RequestInit = { method, cache: "no-store" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, opts);
  if (!res.ok) throw new Error(`simulator ${path} returned ${res.status}`);
  return (await res.json()) as SimClock;
}

// Fetch the Simulator's current clock so the tracker can initialize to the
// current simulated time and run on load — before (or without) any NATS ticks,
// which the Simulator does not publish while paused.
export function fetchClock(base: string): Promise<SimClock> {
  return clockRequest(base, "/clock", "GET");
}

export function resumeClock(base: string): Promise<SimClock> {
  return clockRequest(base, "/control/resume", "POST");
}

export function pauseClock(base: string): Promise<SimClock> {
  return clockRequest(base, "/control/pause", "POST");
}

export function resetClock(base: string): Promise<SimClock> {
  return clockRequest(base, "/control/reset", "POST");
}

export function patchClock(base: string, body: { speed?: number; tick_interval?: number }): Promise<SimClock> {
  return clockRequest(base, "/clock", "PATCH", body);
}
