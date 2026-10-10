import { describe, it, expect } from "vitest";
import { reducer, initialState, activeAircraft } from "./tracker-core";
import type { Report, Tick } from "./types";

function tick(runId: string, tickId: number, simulatedAt: string, paused = false): Tick {
  return {
    run_id: runId,
    tick_id: tickId,
    simulated_at: simulatedAt,
    paused,
    speed: 60,
    tick_interval_s: 1,
  };
}

function report(runId: string, lat: number): Report {
  return {
    report_id: `${runId}-N100CA-000001`,
    run_id: runId,
    tick_id: 1,
    aircraft_id: "N100CA",
    flight_id: "CNA100",
    simulated_at: "2026-10-06T14:10:00Z",
    latitude: lat,
    longitude: -90,
    altitude_m: 10668,
    ground_speed_mps: 199,
    heading_deg: 127,
    status: "flying",
  };
}

describe("tracker reducer", () => {
  it("adopts the run from the first tick", () => {
    const s = reducer(initialState, { type: "tick", tick: tick("run-A", 0, "2026-10-06T14:00:00Z") });
    expect(s.runId).toBe("run-A");
    expect(s.simulatedAt).toBe("2026-10-06T14:00:00Z");
  });

  it("applies a report for the current run", () => {
    let s = reducer(initialState, { type: "tick", tick: tick("run-A", 1, "2026-10-06T14:01:00Z") });
    s = reducer(s, { type: "report", report: report("run-A", 44), forRunId: "run-A" });
    expect(s.aircraft?.latitude).toBe(44);
  });

  it("clears the aircraft when the run changes", () => {
    let s = reducer(initialState, { type: "tick", tick: tick("run-A", 1, "2026-10-06T14:01:00Z") });
    s = reducer(s, { type: "report", report: report("run-A", 44), forRunId: "run-A" });
    expect(s.aircraft).not.toBeNull();
    s = reducer(s, { type: "tick", tick: tick("run-B", 0, "2026-10-06T14:00:00Z") });
    expect(s.runId).toBe("run-B");
    expect(s.aircraft).toBeNull();
  });

  it("discards a report from a superseded run", () => {
    let s = reducer(initialState, { type: "tick", tick: tick("run-B", 0, "2026-10-06T14:00:00Z") });
    // A late response for run-A arrives after we moved to run-B.
    s = reducer(s, { type: "report", report: report("run-A", 44), forRunId: "run-A" });
    expect(s.aircraft).toBeNull();
  });

  it("shows only airborne aircraft (hides parked/landed)", () => {
    let s = reducer(initialState, { type: "tick", tick: tick("run-A", 1, "2026-10-06T14:01:00Z") });
    const flying = report("run-A", 44);
    s = reducer(s, { type: "report", report: flying, forRunId: "run-A" });
    expect(activeAircraft(s)).toEqual(flying);

    const landed = { ...report("run-A", 41.97), status: "parked" };
    s = reducer(s, { type: "report", report: landed, forRunId: "run-A" });
    expect(activeAircraft(s)).toBeNull();
  });

  it("updates time on a same-run tick without touching the aircraft", () => {
    let s = reducer(initialState, { type: "tick", tick: tick("run-A", 1, "2026-10-06T14:01:00Z") });
    s = reducer(s, { type: "report", report: report("run-A", 44), forRunId: "run-A" });
    s = reducer(s, { type: "tick", tick: tick("run-A", 2, "2026-10-06T14:02:00Z", true) });
    expect(s.simulatedAt).toBe("2026-10-06T14:02:00Z");
    expect(s.paused).toBe(true);
    expect(s.aircraft?.latitude).toBe(44);
  });
});
