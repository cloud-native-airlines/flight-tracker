import { useEffect, useState } from "react";
import { loadConfig } from "./config";
import { useTracker } from "./useTracker";
import { useHistory } from "./useHistory";
import { activeAircraft } from "./tracker-core";
import { MapView } from "./MapView";
import { ClockHud } from "./ClockHud";
import type { Config } from "./types";

function Tracker({ config }: { config: Config }) {
  const { state, connection } = useTracker(config);
  const aircraft = activeAircraft(state); // only airborne flights are shown

  // Pre-select from the URL (?flight=<id>); selection persists across the
  // flight's lifecycle and is only cleared by clicking away.
  const [selected, setSelected] = useState(
    () => new URLSearchParams(window.location.search).get("flight") === config.aircraftId,
  );

  // Keep the selection in the URL query so links are shareable (hash, which
  // holds the map view, is preserved).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("flight", config.aircraftId);
    else url.searchParams.delete("flight");
    window.history.replaceState(null, "", url);
  }, [selected, config.aircraftId]);

  // The reported track is fetched only while a flight is selected, and refreshed
  // as its position advances (keyed on the latest tick id).
  const track = useHistory(
    config,
    state.runId,
    config.aircraftId,
    selected && !!aircraft,
    aircraft?.tick_id ?? 0,
  );

  return (
    <>
      <MapView
        config={config}
        aircraft={aircraft}
        selected={selected}
        track={track}
        onSelect={() => setSelected(true)}
        onDeselect={() => setSelected(false)}
      />
      <ClockHud
        runId={state.runId}
        simulatedAt={state.simulatedAt}
        paused={state.paused}
        connection={connection}
        aircraft={aircraft}
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
