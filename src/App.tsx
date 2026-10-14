import { useEffect, useState } from "react";
import { loadConfig } from "./config";
import { useTracker } from "./useTracker";
import { usePositions } from "./usePositions";
import { useHistory } from "./useHistory";
import { MapView } from "./MapView";
import { ClockHud } from "./ClockHud";
import type { Config } from "./types";

function Tracker({ config }: { config: Config }) {
  const { runId, simulatedAt, paused, connection, tickSeq } = useTracker(config);
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
        track={track}
        onSelect={setSelectedId}
        onDeselect={() => setSelectedId(null)}
        onBboxChange={setBbox}
      />
      <ClockHud
        runId={runId}
        simulatedAt={simulatedAt}
        paused={paused}
        connection={connection}
        count={positions.length}
        selected={selected}
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
