import { useEffect, useState } from "react";
import { loadConfig } from "./config";
import { useTracker } from "./useTracker";
import { usePositions } from "./usePositions";
import { useHistory } from "./useHistory";
import { useFlightDetail } from "./useFlightDetail";
import { useOpsAirports } from "./useOpsAirports";
import { MapView } from "./MapView";
import { ClockHud } from "./ClockHud";
import { DebugPanel } from "./DebugPanel";
import type { Config, Report } from "./types";

// Reports for one flight number can span multiple tour cycles. Within a single
// leg the tick ids are consecutive; between cycles there's a large gap. Keep only
// the final run of near-consecutive ticks — the leg currently being flown.
function lastContiguousSegment(reports: Report[]): Report[] {
  if (reports.length < 2) return reports;
  const sorted = [...reports].sort((a, b) => a.tick_id - b.tick_id);
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].tick_id - sorted[i - 1].tick_id > 3) start = i;
  }
  return sorted.slice(start);
}

function Tracker({ config }: { config: Config }) {
  const { runId, simulatedAt, paused, speed, tickInterval, connection, tickSeq, controls } =
    useTracker(config);
  const [bbox, setBbox] = useState<string | undefined>(undefined);

  // Pre-select an aircraft from the URL (?flight=<id>); cleared by clicking away.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("flight"),
  );

  // The fleet in view (latest position per flying aircraft), refetched each tick
  // and whenever the viewport changes.
  const positions = usePositions(config, runId, bbox, tickSeq);
  const selected = positions.find((p) => p.aircraft_id === selectedId) ?? null;

  // The selected flight's reported track, refreshed as its position advances.
  const track = useHistory(config, runId, selectedId ?? "", selectedId !== null, selected?.tick_id ?? 0);

  // Operations supplies what ADS-B can't: the current leg's flight number, origin,
  // destination and aircraft type, plus the airport roster (names + coordinates).
  const opsAirports = useOpsAirports(config);
  const flightDetail = useFlightDetail(config, runId, simulatedAt, selectedId, selected?.tick_id ?? 0);

  // Scope the track to the current leg: keep only this flight number's reports,
  // then the last contiguous run of ticks — so neither a prior leg (different
  // flight number) nor an earlier cycle of the same flight number bleeds in.
  const activeFlightId = selected?.flight_id ?? flightDetail?.flightNumber ?? null;
  const legTrack = activeFlightId
    ? lastContiguousSegment(track.filter((r) => r.flight_id === activeFlightId))
    : track;

  // The current leg's airports, for the dashed planned line and the info panel.
  const originAirport = flightDetail ? opsAirports.get(flightDetail.originCode) ?? null : null;
  const destinationAirport = flightDetail ? opsAirports.get(flightDetail.destinationCode) ?? null : null;
  const destination = destinationAirport
    ? { lon: destinationAirport.longitude, lat: destinationAirport.latitude }
    : null;

  // Keep the selection in the URL so links are shareable (hash preserved).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("flight", selectedId);
    else url.searchParams.delete("flight");
    window.history.replaceState(null, "", url);
  }, [selectedId]);

  return (
    <>
      <MapView
        config={config}
        positions={positions}
        selectedId={selectedId}
        track={legTrack}
        destination={destination}
        onSelect={setSelectedId}
        onDeselect={() => setSelectedId(null)}
        onBboxChange={setBbox}
      />
      <ClockHud
        simulatedAt={simulatedAt}
        paused={paused}
        speed={speed}
        tickInterval={tickInterval}
        controls={controls}
        count={positions.length}
        selected={selected}
        flightDetail={flightDetail}
        originAirport={originAirport}
        destinationAirport={destinationAirport}
      />
      <DebugPanel
        config={config}
        connection={connection}
        runId={runId}
        simulatedAt={simulatedAt}
      />
    </>
  );
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="splash" role="alert">
        <h1>Flight Tracker</h1>
        <p>Could not load configuration: {error}</p>
      </div>
    );
  }
  if (!config) {
    return (
      <div className="splash">
        <h1>Flight Tracker</h1>
        <p>Loading…</p>
      </div>
    );
  }
  return <Tracker config={config} />;
}
