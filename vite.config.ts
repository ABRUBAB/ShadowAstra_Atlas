import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** The security headers Vercel sends (vercel.json), so `npm run preview` behaves like production. */
function productionHeaders(): Record<string, string> {
  const cfg = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf-8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const all = cfg.headers.find((h) => h.source === "/(.*)")?.headers ?? [];
  // localhost is plain http, so upgrading requests would break the preview
  return Object.fromEntries(all.map((h) => [h.key, h.value.replace("; upgrade-insecure-requests", "")]));
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  preview: {
    headers: productionHeaders(),
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
