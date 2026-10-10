# Cloud Native Airlines Flight Tracker Project Goals

## Purpose

Flight Tracker is the visual view of aircraft activity in Cloud Native Airlines. It shows simulated aircraft moving between airports, lets viewers inspect a flight, and makes reporting interruptions visible.

Cloud Native Airlines is an observability demo built around a simulated airline. Aircraft will run as individual Kubernetes pods, calculate their state on simulation ticks, and send position reports to ADS-B. Flight Tracker turns those reports into a world people can watch. When a marker stops updating, viewers should be able to investigate the software and infrastructure behind that behavior.

The goal is a flight-radar-style interface for the simulated fleet, with clear distinctions between aircraft state, reporting freshness, and the health of the connection to the backend.

## Initial scope

Start with one aircraft flying from Minneapolis (MSP) to Chicago O'Hare (ORD). Display a map with both airports and an aircraft marker positioned from the latest ADS-B report. Selecting the aircraft opens a details panel with its identity, flight, movement, status, and reporting timestamps.

The first version reads directly from the implemented ADS-B query API and uses configured airport information. It does not require Operations, Simulator controls, or FIDS. TypeScript with React and MapLibre is the proposed implementation stack.

Provide a usable loading state, an empty state when there are no reports, and a visible error state when ADS-B cannot be reached. A viewer should not need to inspect browser logs to understand why the map has no aircraft.

## Map and flight details

| Element | Behavior |
| --- | --- |
| Airport markers | Identify the origin and destination; show airport code and name |
| Aircraft marker | Display the latest reported coordinates and rotate to its reported heading |
| Flight details | Show aircraft ID, flight ID when available, status, altitude, ground speed, and heading |
| Report timing | Show simulated state time and real receipt time separately |
| Flight trail | Show the recorded path from ADS-B history for the selected flight |
| Reporting indicator | Identify fresh or stale position data using a configurable threshold |

Keep units explicit. The API uses meters and meters per second in the proposed contract; the interface may convert to feet and knots for aviation familiarity as long as conversion is consistent and labels are clear.

The historical trail represents positions actually reported. A planned route is a separate overlay and should be labeled accordingly. In the first version, a planned route may come from sample configuration; later it can come from Operations.

Map tiles and styles are a separate dependency from the application API. Make their source configurable, retain required attribution, and show a useful error if the map background cannot load.

## Data ownership and integration

ADS-B is the source of reported aircraft positions and flight history. Flight Tracker queries it through an API and never connects directly to its database. Use the actual implemented endpoint paths, response shapes, and pagination rules when integrating.

Every query must select a simulation run. Support a configured run ID or an explicit run selection control. Changing runs clears aircraft selection, trails, and cached positions so the interface does not mix separate demonstrations.

Start with periodic polling at a configurable real-time interval. Prevent overlapping polls, bound request duration, and discard responses that belong to a previous run or have been superseded by newer data. Preserve the last successful snapshot during temporary errors and label it with its age. An unavailable API is different from a successful response containing no aircraft.

Fetch history when an aircraft or flight is selected, with bounded results and support for the API's pagination. Streaming updates and browser reconnection protocols can follow after polling works reliably.

## Simulation time and reporting freshness

Simulated time describes the aircraft's state in the airline world. Real time describes when the data was received and how recently the browser successfully queried the backend. These timestamps must not be subtracted from each other to calculate latency.

Use ADS-B's real receipt timestamp to display report age, allowing for browser and server clock differences. Separately indicate when the browser last retrieved data successfully. This distinguishes an aircraft that stopped reporting from a tracker that lost its backend connection.

A stale report means its last known position is old; it does not establish that the aircraft stopped moving, landed, or crashed. Keep the last position visible and label it as stale.

Simulator may stop emitting ticks while paused or continue sending ticks with unchanged simulated time. Without authoritative pause metadata, Flight Tracker should show report age rather than diagnose an outage from age alone. A paused world may have stationary aircraft with either fresh or aging reports, depending on that policy.

## Component boundaries

| Component | Responsibility |
| --- | --- |
| Flight Tracker | Render reported positions, flight details, trails, and data freshness |
| ADS-B | Accept, store, and query position reports |
| Aircraft | Calculate physical state and deliver reports |
| Simulator | Own simulation time, speed, ticks, and reset |
| Operations | Own fleet records, routes, schedules, assignments, and operational flight status |
| FIDS | Display airport departures and arrivals |

Later, Flight Tracker can enrich positions with Operations data and provide airport views showing scheduled flights and reported activity. Airport operations remain owned by Operations; rendering them does not make Flight Tracker responsible for scheduling or dispatch.

## Observability goals

The interface should help viewers answer: Where is the aircraft? How old is that information? Is the browser receiving data successfully?

Instrument API request duration, failures, and frontend errors. Capture enough context to connect an issue to the selected run and backend request. Where browser tracing is enabled, propagate trace context to ADS-B for configured application endpoints. Keep propagation and telemetry export away from unrelated map providers.

Measure request and rendering performance in real time. Use aircraft, flight, and run identifiers in diagnostic logs and traces rather than unbounded metric labels. The interface should remain usable when telemetry export is disabled or unavailable.

## First milestone success criteria

- The application runs locally against ADS-B with documented configuration.
- A selected simulation run displays one MSP-to-ORD aircraft using real reports.
- Aircraft details show explicit units and separate simulated and real timestamps.
- Periodic queries update the marker without overlapping requests or applying older responses over newer state.
- A selected flight shows its recorded trail.
- Loading, no-data, stale-report, map-loading failure, and API-error states are visible and understandable.
- Temporary API failures preserve the last known positions with a clear freshness indicator.
- A container build and README describe startup, backend configuration, map dependencies, and how to demonstrate a flight.
- Meaningful checks cover run isolation, stale-state handling, failed polling, and unit conversion where used.

## Future development

Expand to multiple aircraft, filters, airport activity, and Operations enrichment. Add streaming updates, smooth movement between known reports, and historical playback when the underlying contracts support them. Interpolation is a display effect and must not be presented as a new aircraft report; stop prediction when reporting becomes stale.

Links into observability tools can eventually connect a selected aircraft or time window to relevant logs and traces. The priority remains a clear live view that makes both normal flights and reporting problems visible.
