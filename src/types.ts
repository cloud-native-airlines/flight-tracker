export interface Airport {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Config {
  adsbBase: string;
  simBase: string;
  natsUrl: string;
  tickSubject: string;
  aircraftId: string;
  mapStyle: string;
  airports: Airport[];
}

export interface Tick {
  run_id: string;
  tick_id: number;
  simulated_at: string;
  paused: boolean;
  speed: number;
  tick_interval_s: number;
}

export interface Report {
  report_id: string;
  run_id: string;
  tick_id: number;
  aircraft_id: string;
  flight_id: string;
  simulated_at: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
  ground_speed_mps: number;
  heading_deg: number;
  status: string;
  received_at?: string;
}
