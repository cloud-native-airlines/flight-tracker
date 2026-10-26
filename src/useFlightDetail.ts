import { useEffect, useState } from "react";
import { fetchFlightDetail, type FlightDetail } from "./ops";
import type { Config } from "./types";

// Fetch the selected aircraft's current-leg detail from Operations (flight
// number, aircraft type, origin/destination). Refetches when `version` changes
// (the latest tick id), so it tracks leg changes. Null when nothing is selected
// or the aircraft is not currently flying.
export function useFlightDetail(
  config: Config,
  runId: string | null,
  simulatedAt: string | null,
  aircraftId: string | null,
  version: number,
): FlightDetail | null {
  const [detail, setDetail] = useState<FlightDetail | null>(null);

  useEffect(() => {
    if (!runId || !aircraftId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    fetchFlightDetail(config.opsBase, runId, aircraftId, simulatedAt, controller.signal)
      .then(setDetail)
      .catch(() => {
        /* keep the last detail on a transient error */
      });
    return () => controller.abort();
  }, [config, runId, simulatedAt, aircraftId, version]);

  return detail;
}
