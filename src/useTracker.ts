import { useEffect, useReducer, useRef, useState } from "react";
import { connect, type NatsConnection } from "nats.ws";
import { natsWsUrl } from "./config";
import { fetchLatest } from "./adsb";
import { fetchClock } from "./sim";
import { initialState, reducer } from "./tracker-core";
import type { Config, Tick } from "./types";

export type Connection = "connecting" | "open" | "closed";

const decoder = new TextDecoder();

export function useTracker(config: Config) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [adsbError, setAdsbError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let nc: NatsConnection | null = null;

    // Fire-and-forget ADS-B fetch for a run; non-overlapping, and the reducer
    // discards the result if the run has since changed.
    const fetchFor = (runId: string) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      fetchLatest(config.adsbBase, runId, config.aircraftId)
        .then((report) => {
          if (cancelled) return;
          setAdsbError(null);
          dispatch({ type: "report", report, forRunId: runId });
        })
        .catch((err) => {
          if (!cancelled) setAdsbError(String(err));
        })
        .finally(() => {
          fetchingRef.current = false;
        });
    };

    (async () => {
      // Initialize from the Simulator's current clock, so the tracker shows the
      // current simulated time and run immediately on load — even while paused
      // (no ticks are published then).
      try {
        const clock = await fetchClock(config.simBase);
        if (!cancelled) {
          dispatch({
            type: "tick",
            tick: {
              run_id: clock.run_id,
              tick_id: 0,
              simulated_at: clock.simulated_at,
              paused: clock.paused,
              speed: 0,
              tick_interval_s: 0,
            },
          });
          fetchFor(clock.run_id);
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

      // Track connection status for the HUD.
      (async () => {
        for await (const s of nc!.status()) {
          if (cancelled) break;
          if (s.type === "disconnect" || s.type === "reconnecting") {
            setConnection("connecting");
          } else if (s.type === "reconnect") {
            setConnection("open");
          }
        }
      })().catch(() => {});

      const sub = nc.subscribe(config.tickSubject);
      for await (const msg of sub) {
        if (cancelled) break;
        let tick: Tick;
        try {
          tick = JSON.parse(decoder.decode(msg.data)) as Tick;
        } catch {
          continue;
        }
        dispatch({ type: "tick", tick });
        fetchFor(tick.run_id);
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

  return { state, connection, adsbError };
}
