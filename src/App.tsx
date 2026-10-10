import { useEffect, useState } from "react";
import { loadConfig } from "./config";
import { useTracker } from "./useTracker";
import { activeAircraft } from "./tracker-core";
import { MapView } from "./MapView";
import { ClockHud } from "./ClockHud";
import type { Config } from "./types";

function Tracker({ config }: { config: Config }) {
  const { state, connection } = useTracker(config);
  const aircraft = activeAircraft(state); // only airborne flights are shown
  return (
    <>
      <MapView config={config} aircraft={aircraft} />
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
