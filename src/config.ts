import type { Config } from "./types";

export async function loadConfig(): Promise<Config> {
  const res = await fetch("/config.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`config.json returned ${res.status}`);
  return (await res.json()) as Config;
}

// Build the NATS WebSocket URL from the current origin and the configured path
// (e.g. "/nats"), so the browser only ever talks to its own origin.
export function natsWsUrl(natsPath: string): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}${natsPath}`;
}
