import { useEffect, useState } from "react";
import { fetchHistory } from "./adsb";
import type { Config, Report } from "./types";

// Fetch the reported track for a selected flight. Refetches when `version`
// changes (e.g. the latest tick id), so the trail grows as new reports arrive.
export function useHistory(
  config: Config,
  runId: string | null,
  aircraftId: string,
  enabled: boolean,
  version: number,
): Report[] {
  const [track, setTrack] = useState<Report[]>([]);

  useEffect(() => {
    if (!enabled || !runId) {
      setTrack([]);
      return;
    }
    const controller = new AbortController();
    fetchHistory(config.adsbBase, runId, aircraftId, controller.signal)
      .then((reports) => setTrack(reports))
      .catch(() => {
        /* keep the last track on a transient error */
      });
    return () => controller.abort();
  }, [config, runId, aircraftId, enabled, version]);

  return track;
}
