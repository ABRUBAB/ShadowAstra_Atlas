import type { Body } from "../data/sites";

/** Mean radii in metres (IAU). */
export const RADIUS: Record<Body, number> = {
  earth: 6_371_000,
  moon: 1_737_400,
  mars: 3_389_500,
};

/** Unit-sphere position for a lat/lon, matching three.js SphereGeometry UV layout. */
export function latLonToVec3(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}

/** Web-Mercator ground resolution (m/px) for 256-px tiles on Earth. */
export function mercatorMetresPerPixel(lat: number, zoom: number): number {
  return (156_543.033_92 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * Leaflet EPSG:4326 grid used by NASA Trek: world is 512·2^z px wide for 360°.
 * North–south resolution is constant; we use it as the body's map scale.
 */
export function equirectMetresPerPixel(body: Body, zoom: number): number {
  return (Math.PI * RADIUS[body]) / (256 * 2 ** zoom);
}

export function zoomForEquirect(body: Body, metresPerPixel: number): number {
  return Math.log2((Math.PI * RADIUS[body]) / (256 * metresPerPixel));
}

export function zoomForMercator(lat: number, metresPerPixel: number): number {
  return Math.log2((156_543.033_92 * Math.cos((lat * Math.PI) / 180)) / metresPerPixel);
}

/* ---------- Lunar south pole, polar stereographic image (see scripts/build_textures.py) ---------- */

export const POLAR_IMAGE_SIZE = 1400;
export const POLAR_EDGE_LAT = -80;
const R_EDGE = Math.tan((((90 + POLAR_EDGE_LAT) / 2) * Math.PI) / 180);

/** Pixel coordinates (x right, y down) of a south-polar lat/lon in the reprojected image. */
export function polarPixel(lat: number, lon: number): [number, number] {
  const rho = Math.tan((((90 + lat) / 2) * Math.PI) / 180) / R_EDGE; // 0 at pole, 1 at edge
  const a = (lon * Math.PI) / 180;
  const half = POLAR_IMAGE_SIZE / 2;
  return [half + rho * Math.sin(a) * half, half - rho * Math.cos(a) * half];
}

/** Ground metres per image pixel near the pole at zoom 0. */
export const POLAR_METRES_PER_PIXEL = (2 * RADIUS.moon * R_EDGE) / (POLAR_IMAGE_SIZE / 2);

export function formatLat(lat: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
}
export function formatLon(lon: number) {
  return `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}
export function formatCoord(lat: number, lon: number) {
  return `${formatLat(lat)} ${formatLon(lon)}`;
}

export function niceScale(metres: number): { value: number; label: string } {
  const pow = 10 ** Math.floor(Math.log10(metres));
  const n = metres / pow;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  const value = step * pow;
  return { value, label: value >= 1000 ? `${value / 1000} km` : `${value} m` };
}
