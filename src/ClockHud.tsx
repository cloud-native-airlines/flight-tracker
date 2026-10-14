import type { Connection } from "./useTracker";
import type { Report } from "./types";

function timeParts(iso: string | null): { time: string; date: string } {
  if (!iso) return { time: "--:--:--", date: "—" };
  const d = new Date(iso);
  return {
    time: d.toISOString().slice(11, 19),
    date: d.toISOString().slice(0, 10),
  };
}

export function ClockHud({
  runId,
  simulatedAt,
  paused,
  connection,
  count,
  selected,
}: {
  runId: string | null;
  simulatedAt: string | null;
  paused: boolean;
  connection: Connection;
  count: number;
  selected: Report | null;
}) {
  const { time, date } = timeParts(simulatedAt);
  return (
    <div className="hud">
      <div className="hud-label">Simulated time (UTC)</div>
      <div className="hud-clock">{time}</div>
      <div className="hud-date">{date}</div>

      <div className={`hud-status ${paused ? "paused" : "running"}`}>
        <span className="dot" />
        {simulatedAt ? (paused ? "Paused" : "Running") : "Waiting for ticks"}
      </div>

      {selected ? (
        <div className="hud-aircraft">
          <span className="ac-id">{selected.aircraft_id}</span>
          <span className="ac-flight">{selected.flight_id}</span>
          <div className="ac-stats">
            <span>{selected.status}</span>
            <span>{Math.round(selected.altitude_m).toLocaleString()} m</span>
            <span>{selected.ground_speed_mps.toFixed(0)} m/s</span>
            <span>{Math.round(selected.heading_deg)}°</span>
          </div>
        </div>
      ) : (
        <div className="hud-aircraft muted">
          {count} {count === 1 ? "flight" : "flights"} in view — click one to select
        </div>
      )}

      <div className="hud-meta">
        <span className={`conn conn-${connection}`}>NATS: {connection}</span>
        {runId && <span className="run">run {runId}</span>}
      </div>
    </div>
  );
}
