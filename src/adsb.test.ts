import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLatest } from "./adsb";

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
