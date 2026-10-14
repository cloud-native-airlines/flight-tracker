import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLatest, fetchPositions, fetchAirports } from "./adsb";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchLatest", () => {
  it("returns the report on 200", async () => {
    const report = { run_id: "run-A", aircraft_id: "N100CA", latitude: 44 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ report }),
      }),
    );
    const got = await fetchLatest("/adsb", "run-A", "N100CA");
    expect(got).toEqual(report);
  });

  it("returns null on 404 (no report yet)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await fetchLatest("/adsb", "run-A", "N100CA")).toBeNull();
  });

  it("throws on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchLatest("/adsb", "run-A", "N100CA")).rejects.toThrow("500");
  });

  it("encodes query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ report: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    await fetchLatest("/adsb", "run A/1", "N/100", undefined);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("run_id=run%20A%2F1");
    expect(url).toContain("aircraft_id=N%2F100");
  });
});

describe("fetchPositions", () => {
  it("returns the positions array and passes run_id, bbox, status", async () => {
    const positions = [{ aircraft_id: "N1" }, { aircraft_id: "N2" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ positions }) });
    vi.stubGlobal("fetch", fetchMock);
    const got = await fetchPositions("/adsb", "run-A", "-104,36,-80,49", "flying");
    expect(got).toEqual(positions);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/adsb/api/v1/positions?");
    expect(url).toContain("run_id=run-A");
    expect(url).toContain("bbox=-104%2C36%2C-80%2C49");
    expect(url).toContain("status=flying");
  });

  it("omits bbox and status when not given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ positions: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await fetchPositions("/adsb", "run-A");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("bbox=");
    expect(url).not.toContain("status=");
  });

  it("throws on error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchPositions("/adsb", "run-A")).rejects.toThrow("500");
  });
});

describe("fetchAirports", () => {
  it("returns the airports array; bbox optional", async () => {
    const airports = [{ code: "MSP" }, { code: "ORD" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ airports }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAirports("/adsb")).toEqual(airports);
    expect(fetchMock.mock.calls[0][0]).toBe("/adsb/api/v1/airports");

    await fetchAirports("/adsb", "-104,36,-80,49");
    expect(fetchMock.mock.calls[1][0] as string).toContain("bbox=-104%2C36%2C-80%2C49");
  });
});
