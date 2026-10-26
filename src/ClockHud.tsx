import { useState } from "react";
import type { SimControls } from "./useTracker";
import type { FlightDetail, OpsAirport } from "./ops";
import type { Report } from "./types";

const AIRLINE = "Cloud Native Airlines";
const M_TO_FT = 3.28084;
const MPS_TO_KTS = 1.94384;

// Friendly names for the equipment types the scenario uses; falls back to the
// raw type code for anything not listed.
const AIRCRAFT_NAMES: Record<string, string> = {
  A319: "Airbus A319",
  A320: "Airbus A320",
  A321: "Airbus A321",
  B737: "Boeing 737",
  B738: "Boeing 737-800",
  B739: "Boeing 737-900",
  B752: "Boeing 757-200",
  E75L: "Embraer 175",
};

function timeParts(iso: string | null): { time: string; date: string } {
  if (!iso) return { time: "--:--:--", date: "—" };
  const d = new Date(iso);
  return {
    time: d.toISOString().slice(11, 19),
    date: d.toISOString().slice(0, 10),
  };
}

function round(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function ClockHud({
  simulatedAt,
  paused,
  speed,
  tickInterval,
  controls,
  count,
  selected,
  flightDetail,
  originAirport,
  destinationAirport,
}: {
  simulatedAt: string | null;
  paused: boolean;
  speed: number;
  tickInterval: number;
  controls: SimControls;
  count: number;
  selected: Report | null;
  flightDetail: FlightDetail | null;
  originAirport: OpsAirport | null;
  destinationAirport: OpsAirport | null;
}) {
  const { time, date } = timeParts(simulatedAt);
  const [busy, setBusy] = useState(false);
  const ready = simulatedAt !== null;

  function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    action()
      .catch((err) => console.error("simulator control failed", err))
      .finally(() => setBusy(false));
  }

  return (
    <div className="hud">
      <div className="hud-label">Simulated time (UTC)</div>
      <div className="hud-clock">{time}</div>
      <div className="hud-date">{date}</div>

      <div className={`hud-status ${paused ? "paused" : "running"}`}>
        <span className="dot" />
        {ready ? (paused ? "Paused" : "Running") : "Waiting for ticks"}
      </div>

      <div className="hud-controls">
        <div className="hud-buttons">
          <button className="btn primary" disabled={!ready || busy} onClick={() => run(controls.playPause)}>
            {paused ? "Play" : "Pause"}
          </button>
          <button className="btn" disabled={busy} onClick={() => run(controls.reset)}>
            Reset
          </button>
        </div>

        <div className="hud-stepper">
          <span className="step-label">Speed</span>
          <div className="stepper">
            <button className="btn step" disabled={!ready || busy} onClick={() => run(() => controls.stepSpeed(-1))}>−</button>
            <span className="step-value">{speed}×</span>
            <button className="btn step" disabled={!ready || busy} onClick={() => run(() => controls.stepSpeed(1))}>+</button>
          </div>
        </div>

        <div className="hud-stepper">
          <span className="step-label">Tick</span>
          <div className="stepper">
            <button className="btn step" disabled={!ready || busy} onClick={() => run(() => controls.stepInterval(-1))}>−</button>
            <span className="step-value">{tickInterval}s</span>
            <button className="btn step" disabled={!ready || busy} onClick={() => run(() => controls.stepInterval(1))}>+</button>
          </div>
        </div>
      </div>

      {selected ? (
        <FlightInfo
          selected={selected}
          detail={flightDetail}
          origin={originAirport}
          destination={destinationAirport}
        />
      ) : (
        <div className="hud-aircraft muted">
          {count} {count === 1 ? "flight" : "flights"} in view — click one to select
        </div>
      )}
    </div>
  );
}

function FlightInfo({
  selected,
  detail,
  origin,
  destination,
}: {
  selected: Report;
  detail: FlightDetail | null;
  origin: OpsAirport | null;
  destination: OpsAirport | null;
}) {
  const flightNumber = detail?.flightNumber ?? selected.flight_id;
  const type = detail?.aircraftType ?? "";
  const typeName = type ? AIRCRAFT_NAMES[type] ?? type : "";
  const originCode = detail?.originCode ?? origin?.code ?? "";
  const destCode = detail?.destinationCode ?? destination?.code ?? "";

  return (
    <div className="hud-flight">
      <div className="flight-head">
        <span className="flight-number">{flightNumber}</span>
        {type && <span className="flight-type">({type})</span>}
      </div>
      <div className="flight-airline">{AIRLINE}</div>

      {originCode && destCode && (
        <div className="route">
          <div className="route-codes">
            <span>{originCode}</span>
            <span className="route-arrow">→</span>
            <span>{destCode}</span>
          </div>
          <div className="route-names">
            <span>{origin?.name ?? ""}</span>
            <span>{destination?.name ?? ""}</span>
          </div>
        </div>
      )}

      <div className="aircraft-block">
        <div className="ac-reg">{selected.aircraft_id}</div>
        {typeName && <div className="ac-type">{typeName}</div>}
        <dl className="ac-metrics">
          <div><dt>Altitude</dt><dd>{round(selected.altitude_m * M_TO_FT)} ft</dd></div>
          <div><dt>Ground speed</dt><dd>{round(selected.ground_speed_mps * MPS_TO_KTS)} kts</dd></div>
          <div><dt>Bearing</dt><dd>{Math.round(selected.heading_deg)}°</dd></div>
        </dl>
      </div>
    </div>
  );
}
