/** The same place in NASA's own tools, so anyone can check our numbers there.
 * Links only: nothing is loaded from these sites. Formats checked by hand on 13 Nov 2026. */
import type { World } from "../data/sites";

const r2 = (x: number) => String(Math.round(x * 100) / 100);
const clampLat = (x: number) => Math.max(-90, Math.min(90, x));
const clampLon = (x: number) => Math.max(-180, Math.min(180, x));

/** NASA Worldview: true-colour MODIS imagery and coastlines over a box around the place. */
export function worldviewUrl(lat: number, lon: number, half = 0.6): string {
  const dLon = Math.min(180, half / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const v = [clampLon(lon - dLon), clampLat(lat - half), clampLon(lon + dLon), clampLat(lat + half)].map(r2).join(",");
  return `https://worldview.earthdata.nasa.gov/?v=${v}&l=MODIS_Terra_CorrectedReflectance_TrueColor,Coastlines_15m`;
}

/** NASA Earthdata Search: every NASA dataset that covers this 0.5° place (a bounding-box filter). */
export function earthdataUrl(lat: number, lon: number, half = 0.25): string {
  const sb = [clampLon(lon - half), clampLat(lat - half), clampLon(lon + half), clampLat(lat + half)].map(r2).join(",");
  return `https://search.earthdata.nasa.gov/search?sb=${encodeURIComponent(sb)}`;
}

/** Where the target's orbital data lives in NASA's Planetary Data System. */
export function targetDataLink(body: World): { label: string; url: string } {
  return body === "moon"
    ? { label: "LRO data in NASA PDS", url: "https://pds-geosciences.wustl.edu/missions/lro/" }
    : { label: "Mars data in NASA PDS", url: "https://ode.rsl.wustl.edu/mars/" };
}
