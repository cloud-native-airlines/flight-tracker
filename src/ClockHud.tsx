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
  aircraft,
}: {
  runId: string | null;
  simulatedAt: string | null;
  paused: boolean;
  connection: Connection;
  aircraft: Report | null;
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

      {aircraft ? (
        <div className="hud-aircraft">
          <span className="ac-id">{aircraft.aircraft_id}</span>
          <span className="ac-flight">{aircraft.flight_id}</span>
          <div className="ac-stats">
            <span>{aircraft.status}</span>
            <span>{Math.round(aircraft.altitude_m).toLocaleString()} m</span>
            <span>{aircraft.ground_speed_mps.toFixed(0)} m/s</span>
            <span>{Math.round(aircraft.heading_deg)}°</span>
          </div>
        </div>
      ) : (
        <div className="hud-aircraft muted">No active flight</div>
      )}

      <div className="hud-meta">
        <span className={`conn conn-${connection}`}>NATS: {connection}</span>
        {runId && <span className="run">run {runId}</span>}
      </div>
    </div>
  );
}
