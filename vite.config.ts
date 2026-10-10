/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server proxy mirrors the production nginx: same-origin /adsb (HTTP) and
// /nats (WebSocket). Targets point at the compose-exposed host ports by default.
const ADSB_TARGET = process.env.ADSB_TARGET ?? "http://localhost:18080";
const NATS_WS_TARGET = process.env.NATS_WS_TARGET ?? "ws://localhost:8083";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/adsb": {
        target: ADSB_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/adsb/, ""),
      },
      "/sim": {
        target: process.env.SIM_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sim/, ""),
      },
      "/nats": {
        target: NATS_WS_TARGET,
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nats/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
