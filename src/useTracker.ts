import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connect, type NatsConnection } from "nats.ws";
import { natsWsUrl } from "./config";
import {
  fetchClock,
  pauseClock,
  patchClock,
  resetClock,
  resumeClock,
  stepLadder,
  SPEED_LADDER,
  INTERVAL_LADDER,
  type SimClock,
} from "./sim";
import type { Config, Tick } from "./types";

export type Connection = "connecting" | "open" | "closed";

export interface SimControls {
  playPause: () => Promise<void>;
  reset: () => Promise<void>;
  stepSpeed: (dir: 1 | -1) => Promise<void>;
  stepInterval: (dir: 1 | -1) => Promise<void>;
}

const decoder = new TextDecoder();

// Subscribes to the Simulator's tick stream over NATS and exposes the clock
// (run, simulated time, paused, speed, tick interval) plus a tick sequence number
// that increments on every tick — consumers use it to refetch viewport data in
// step with the sim. Also exposes controls that drive the Simulator's HTTP API
// and apply the returned snapshot immediately (important while paused, when no
// ticks arrive to refresh the display).
export function useTracker(config: Config) {
  const [runId, setRunId] = useState<string | null>(null);
  const [simulatedAt, setSimulatedAt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [tickInterval, setTickInterval] = useState(0);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [tickSeq, setTickSeq] = useState(0);

  // Latest clock values, readable by control callbacks without stale closures.
  const latest = useRef({ paused: false, speed: 0, tickInterval: 0 });

  const applyClock = useCallback(
    (c: { run_id: string; simulated_at: string; paused: boolean; speed: number; tickInterval: number }) => {
      setRunId(c.run_id);
      setSimulatedAt(c.simulated_at);
      setPaused(c.paused);
      setSpeed(c.speed);
      setTickInterval(c.tickInterval);
      latest.current = { paused: c.paused, speed: c.speed, tickInterval: c.tickInterval };
    },
    [],
  );

  const applySnapshot = useCallback(
    (s: SimClock) =>
      applyClock({
        run_id: s.run_id,
        simulated_at: s.simulated_at,
        paused: s.paused,
        speed: s.speed,
        tickInterval: s.tick_interval,
      }),
    [applyClock],
  );

  useEffect(() => {
    let cancelled = false;
    let nc: NatsConnection | null = null;

    const onTick = (tick: Tick) => {
      applyClock({
        run_id: tick.run_id,
        simulated_at: tick.simulated_at,
        paused: tick.paused,
        speed: tick.speed,
        tickInterval: tick.tick_interval_s,
      });
      setTickSeq((n) => n + 1);
    };

    (async () => {
      // Initialize from the Simulator's current clock so the tracker shows the
      // current time and run immediately — even while paused (no ticks then).
      try {
        const clock = await fetchClock(config.simBase);
        if (!cancelled) {
          applySnapshot(clock);
          setTickSeq((n) => n + 1);
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
  }, [config, applyClock, applySnapshot]);

  const controls = useMemo<SimControls>(
    () => ({
      async playPause() {
        const base = config.simBase;
        applySnapshot(latest.current.paused ? await resumeClock(base) : await pauseClock(base));
      },
      async reset() {
        applySnapshot(await resetClock(config.simBase));
      },
      async stepSpeed(dir) {
        const next = stepLadder(SPEED_LADDER, latest.current.speed, dir);
        applySnapshot(await patchClock(config.simBase, { speed: next }));
      },
      async stepInterval(dir) {
        const next = stepLadder(INTERVAL_LADDER, latest.current.tickInterval, dir);
        applySnapshot(await patchClock(config.simBase, { tick_interval: next }));
      },
    }),
    [config, applySnapshot],
  );

  return { runId, simulatedAt, paused, speed, tickInterval, connection, tickSeq, controls };
}
