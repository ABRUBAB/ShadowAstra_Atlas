import { EARTH_BY_ID, type EarthSite } from "../data/sites";
import { formatCoord } from "./geo";

/** "@-24.08,-70.00" → { lat, lon }. Used for any place picked on the finder map. */
export function parseAt(id: string): { lat: number; lon: number } | null {
  const m = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(id.trim());
  if (!m) return null;
  const lat = +m[1];
  const lon = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

export const atId = (lat: number, lon: number) => `@${lat.toFixed(2)},${lon.toFixed(2)}`;

/** A catalogue site, or a custom place built from coordinates. */
export function earthSite(id: string, label?: { name: string; country: string | null } | null): EarthSite | null {
  if (EARTH_BY_ID[id]) return EARTH_BY_ID[id];
  const p = parseAt(id);
  if (!p) return null;
  return {
    id,
    name: label?.name ?? `Place at ${formatCoord(p.lat, p.lon)}`,
    country: label?.country ?? formatCoord(p.lat, p.lon),
    lat: p.lat,
    lon: p.lon,
    worlds: ["moon", "mars"],
    tasks: [],
    summary: "A place picked on the Find new sites map. It has not been used for field tests yet, as far as we know.",
    heritage: "",
    pairs: [],
    fit: { topography: "unknown", geology: "unknown", environment: "unknown", resources: "unknown", access: "unknown" },
    gaps: [],
  };
}
