# Cloud Native Airlines Flight Tracker

A flight-radar-style view of the simulated fleet. See
[FLIGHT_TRACKER_PROJECT_GOALS.md](FLIGHT_TRACKER_PROJECT_GOALS.md) for the vision
and [FLIGHT_TRACKER_DESIGN.md](FLIGHT_TRACKER_DESIGN.md) for the design.

**Phase 1 (this version):** a full-screen map, a clock driven by the Simulator,
and a moving aircraft icon following the in-progress MSP→ORD flight. It subscribes
to the Simulator's tick stream over NATS (WebSocket) for the clock and run id, and
polls ADS-B for the aircraft's latest position on each tick. Details panel, trail,
and rich freshness states are phase 2.

TypeScript + React + MapLibre, built with Vite and served by nginx.

## Run

The tracker expects the rest of the stack (Simulator, NATS, ADS-B) running. The
easiest path is the top-level compose in the `cloud-native-airlines` repo, which
includes this service — open <http://localhost:8090> and press play in the
Simulator.

### Local dev

```sh
npm install
npm run dev        # http://localhost:5173
```

Vite proxies `/adsb` and `/nats` to the compose-exposed ports by default
(`http://localhost:18080` and `ws://localhost:8083`); override with `ADSB_TARGET`
and `NATS_WS_TARGET`.

### Container

```sh
make build-image
docker run --rm -p 8090:8080 cna-flight-tracker:0.1.0
```

nginx serves the SPA and reverse-proxies `/adsb` → ADS-B and `/nats` → NATS, so
the browser only ever talks to one origin.

## Configuration

Runtime config is fetched from `/config.json` at startup, so one image works in
any environment without a rebuild. Defaults ([public/config.json](public/config.json)):

| Key | Meaning |
| --- | --- |
| `adsbBase` | Path the SPA calls for ADS-B (`/adsb`, proxied) |
| `natsUrl` | WebSocket path for NATS (`/nats`, proxied) |
| `tickSubject` | NATS subject for ticks (`cna.sim.tick`) |
| `aircraftId` | Aircraft to track (`N100CA`) |
| `mapStyle` | `"pmtiles"` (self-hosted basemap), `""` (plain dark), or a MapLibre style URL |
| `airports` | Airports to render (code, name, lat, lon) |

Mount your own `config.json` over `/usr/share/nginx/html/config.json` to change
endpoints, the tracked aircraft, or the map style.

## Basemap (PMTiles)

The map is a **self-hosted** Protomaps basemap — a single
[`public/basemap.pmtiles`](public/basemap.pmtiles) archive served statically and
read client-side via HTTP range requests. No API key, no tile server, no internet
at runtime. The style (dark, label-free) is built in code in
[`src/MapView.tsx`](src/MapView.tsx).

The committed archive is a ~43 MB **world** extract at zoom 0–6 — global coverage
at the detail a cruise-altitude tracker uses (no blank areas wherever a flight
goes); deep street-level zoom is traded away.

To (re)generate it, install the CLI once with `make pmtiles-cli`, then:

```sh
make basemap PMTILES_BBOX=-10,35,40,72 PMTILES_MAXZOOM=7   # custom bbox/zoom
```

Protomaps planet builds expire after ~3 months; bump `PMTILES_BUILD` to a current
date from <https://build.protomaps.com> if a download 404s. Labels are omitted to
stay self-contained; adding them requires bundling glyph fonts.

> **MapLibre is pinned to v4 on purpose.** v5/v6 load their web worker via
> `new Worker(new URL(…, import.meta.url))`, which Vite 8's rolldown bundler does
> not emit, so nothing source-backed renders. v4 inlines its worker as a Blob.
> Revisit when moving off Vite 8 (rolldown) or when the interop is fixed.

## How it works

- `nats.ws` subscribes to `cna.sim.tick`; each tick carries `run_id` and
  `simulated_at`. The clock shows the simulated time; a `run_id` change (Simulator
  reset) clears the map.
- Each tick triggers a non-overlapping `GET /adsb/api/v1/reports/latest`; responses
  for a superseded run are discarded. The marker moves to the latest position and
  rotates to its reported heading.

## Test

```sh
npm test          # vitest: run isolation, superseded responses, ADS-B client
npm run typecheck
```
