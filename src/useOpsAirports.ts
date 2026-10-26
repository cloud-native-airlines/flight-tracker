import { useEffect, useState } from "react";
import { fetchOpsAirports, type OpsAirport } from "./ops";
import type { Config } from "./types";

// Fetch the Operations airport roster once, keyed by code. Used for airport names
// in the info panel and destination coordinates for the planned route line.
export function useOpsAirports(config: Config): Map<string, OpsAirport> {
  const [airports, setAirports] = useState<Map<string, OpsAirport>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    fetchOpsAirports(config.opsBase, controller.signal)
      .then(setAirports)
      .catch(() => {
        /* roster unavailable; panel falls back to codes only */
      });
    return () => controller.abort();
  }, [config]);

  return airports;
}
