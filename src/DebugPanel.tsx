import { useState } from "react";
import type { Connection } from "./useTracker";
import type { Config } from "./types";

// Resolve a configured path (e.g. "/nats") to the absolute URL the browser
// actually talks to, so the debug panel shows the real endpoint.
function absolute(path: string): string {
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

export function DebugPanel({
  config,
  connection,
  runId,
  simulatedAt,
}: {
  config: Config;
  connection: Connection;
  runId: string | null;
  simulatedAt: string | null;
}) {
  const [open, setOpen] = useState(false);

  const natsProto = window.location.protocol === "https:" ? "wss" : "ws";
  const natsUrl = `${natsProto}://${window.location.host}${config.natsUrl}`;

  const rows: { label: string; value: string; status?: Connection }[] = [
    { label: "NATS", value: natsUrl, status: connection },
    { label: "NATS subject", value: config.tickSubject },
    { label: "ADS-B", value: absolute(config.adsbBase) },
    { label: "Operations", value: absolute(config.opsBase) },
    { label: "Simulator", value: absolute(config.simBase) },
    { label: "Run", value: runId ?? "—" },
    { label: "Simulated time", value: simulatedAt ?? "—" },
  ];

  return (
    <>
      <button
        className="debug-toggle"
        aria-label="Debug info"
        title="Debug info"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open && (
        <div className="debug-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="debug-modal" onClick={(e) => e.stopPropagation()}>
            <div className="debug-header">
              <span>Connections</span>
              <button className="debug-close" aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <dl className="debug-grid">
              {rows.map((r) => (
                <div className="debug-row" key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>
                    {r.status && <span className={`conn conn-${r.status}`}>{r.status} </span>}
                    <span className="debug-value">{r.value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
