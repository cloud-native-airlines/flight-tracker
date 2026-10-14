import { useEffect, useState } from "react";
import { connect, type NatsConnection } from "nats.ws";
import { natsWsUrl } from "./config";
import { fetchClock } from "./sim";
import type { Config, Tick } from "./types";

export type Connection = "connecting" | "open" | "closed";

const decoder = new TextDecoder();

// Subscribes to the Simulator's tick stream over NATS and exposes the clock
// (run, simulated time, paused) plus a tick sequence number that increments on
// every tick — consumers use it to refetch viewport data in step with the sim.
export function useTracker(config: Config) {
  const [runId, setRunId] = useState<string | null>(null);
  const [simulatedAt, setSimulatedAt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [tickSeq, setTickSeq] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let nc: NatsConnection | null = null;

    const onTick = (tick: Tick) => {
      setRunId(tick.run_id);
      setSimulatedAt(tick.simulated_at);
      setPaused(tick.paused);
      setTickSeq((n) => n + 1);
    };

    (async () => {
      // Initialize from the Simulator's current clock so the tracker shows the
      // current time and run immediately — even while paused (no ticks then).
      try {
        const clock = await fetchClock(config.simBase);
        if (!cancelled) {
          onTick({
            run_id: clock.run_id,
            tick_id: 0,
            simulated_at: clock.simulated_at,
            paused: clock.paused,
            speed: 0,
            tick_interval_s: 0,
          });
        }
      } catch (err) {
        console.warn("initial clock fetch failed", err);
      }

      nc = await connect({
        servers: natsWsUrl(config.natsUrl),
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000,
        waitOnFirstConnect: true,
      });
      if (cancelled) {
        void nc.close();
        return;
      }
      setConnection("open");

      (async () => {
        for await (const s of nc!.status()) {
          if (cancelled) break;
          if (s.type === "disconnect" || s.type === "reconnecting") setConnection("connecting");
          else if (s.type === "reconnect") setConnection("open");
        }
      })().catch(() => {});

      const sub = nc.subscribe(config.tickSubject);
      for await (const msg of sub) {
        if (cancelled) break;
        try {
          onTick(JSON.parse(decoder.decode(msg.data)) as Tick);
        } catch {
          /* ignore malformed tick */
        }
      }
    })().catch((err) => {
      if (!cancelled) {
        console.error("nats connection failed", err);
        setConnection("closed");
      }
    });

    return () => {
      cancelled = true;
      void nc?.close();
    };
  }, [config]);

  return { runId, simulatedAt, paused, connection, tickSeq };
}
