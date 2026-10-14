import { useEffect, useState } from "react";
import { fetchPositions } from "./adsb";
import type { Config, Report } from "./types";

// The fleet in view: the latest position of every flying aircraft within the
// current run and viewport. Refetches when the run, viewport (bbox), or tick
// changes. Each run uses an AbortController, so a superseded request is
// cancelled and only the latest response is applied.
export function usePositions(
  config: Config,
  runId: string | null,
  bbox: string | undefined,
  tickSeq: number,
): Report[] {
  const [positions, setPositions] = useState<Report[]>([]);

  useEffect(() => {
    if (!runId) {
      setPositions([]);
      return;
    }
    const controller = new AbortController();
    fetchPositions(config.adsbBase, runId, bbox, "flying", controller.signal)
      .then(setPositions)
      .catch(() => {
        /* transient error or aborted; keep the last snapshot */
      });
    return () => controller.abort();
  }, [config, runId, bbox, tickSeq]);

  return positions;
}
