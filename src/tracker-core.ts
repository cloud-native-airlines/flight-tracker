// Pure state logic for the tracker, independent of React, NATS, and HTTP so it
// can be unit-tested directly. It enforces run isolation (a run change clears
// the aircraft) and discards ADS-B responses that belong to a superseded run.

import type { Report, Tick } from "./types";

export interface TrackerState {
  runId: string | null;
  simulatedAt: string | null;
  paused: boolean;
  aircraft: Report | null;
}

export const initialState: TrackerState = {
  runId: null,
  simulatedAt: null,
  paused: false,
  aircraft: null,
};

export type Action =
  | { type: "tick"; tick: Tick }
  | { type: "report"; report: Report | null; forRunId: string };

// Only airborne flights are shown on the map. A parked report — before
// departure or after landing — is not an active flight, so the marker is hidden
// (and a landed aircraft disappears from the map).
export function activeAircraft(state: TrackerState): Report | null {
  return state.aircraft && state.aircraft.status === "flying" ? state.aircraft : null;
}

export function reducer(state: TrackerState, action: Action): TrackerState {
  switch (action.type) {
    case "tick": {
      const { tick } = action;
      if (tick.run_id !== state.runId) {
        // Run changed (e.g. Simulator reset): clear the aircraft so two runs
        // never mix on the map.
        return {
          runId: tick.run_id,
          simulatedAt: tick.simulated_at,
          paused: tick.paused,
          aircraft: null,
        };
      }
      return { ...state, simulatedAt: tick.simulated_at, paused: tick.paused };
    }
    case "report": {
      // Ignore a response that belongs to a run we have already moved past.
      if (action.forRunId !== state.runId) return state;
      return { ...state, aircraft: action.report };
    }
  }
}
