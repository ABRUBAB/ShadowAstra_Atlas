/**
 * Terrain Twins, real elevation sampled at a shared physical scale.
 *
 *  Earth : AWS Terrain Tiles (Terrarium), built largely from NASA SRTM, metres, 16-bit.
 *  Moon  : NASA Trek LRO LOLA DEM (128 ppd), 8-bit preview tiles, global linear stretch.
 *  Mars  : NASA Trek MGS MOLA DEM (463 m), 8-bit preview tiles, global linear stretch.
 *
 * The 8-bit calibrations were fitted by us from known extremes (MOLA: Hellas floor
 * −8.2 km / Olympus summit +21.2 km; LOLA: −9.15 to +10.78 km). Vertical step is
 * ~130 m (Mars) and ~78 m (Moon), so grids are lightly smoothed and all statistics are
 * labelled as preview-grade. Full-precision LOLA/MOLA/HiRISE comes with the pipeline.
 */
import type { Body } from "../data/sites";
import { RADIUS } from "./geo";

export interface DemSource {
  body: Body;
  name: string;
  maxZoom: number;
  grid: "mercator" | "equirect";
  url: (z: number, x: number, y: number) => string;
  decode: (r: number, g: number, b: number, a: number) => number | null;
  vertical: string;
}

export const DEM: Record<Body, DemSource> = {
  earth: {
    body: "earth",
    name: "SRTM-based Terrain Tiles (AWS Open Data)",
    maxZoom: 12,
    grid: "mercator",
    url: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
    decode: (r, g, b) => r * 256 + g + b / 256 - 32768,
    vertical: "≈1 m",
  },
  moon: {
    body: "moon",
    name: "LRO LOLA DEM 128 ppd (NASA Trek, 8-bit)",
    maxZoom: 5,
    grid: "equirect",
    url: (z, x, y) => `https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_DEM_Global_128ppd_v04/1.0.0/default/default028mm/${z}/${y}/${x}.png`,
    decode: (r, _g, _b, a) => (a < 8 ? null : -9150 + 78.2 * r),
    vertical: "≈78 m step",
  },
  mars: {
    body: "mars",
    name: "MGS MOLA DEM 463 m (NASA Trek, 8-bit)",
    maxZoom: 5,
    grid: "equirect",
    url: (z, x, y) => `https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_DEM_mosaic_global_463m_8/1.0.0/default/default028mm/${z}/${y}/${x}.png`,
    decode: (r, _g, _b, a) => (a < 8 ? null : -10538 + 129.9 * r),
    vertical: "≈130 m step",
  },
};

/** Native ground spacing (km) of a source at a zoom and latitude. */
export function nativeKm(src: DemSource, z: number, lat: number) {
  if (src.grid === "mercator") return (156.543_033_92 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
  return (Math.PI * RADIUS[src.body]) / 1000 / (256 * 2 ** z);
}

function worldPx(src: DemSource, z: number, lat: number, lon: number): [number, number] {
  if (src.grid === "mercator") {
    const n = 256 * 2 ** z;
    const l = Math.max(-85, Math.min(85, lat)) * (Math.PI / 180);
    return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2) * n];
  }
  const w = 512 * 2 ** z;
  return [((lon + 180) / 360) * w, ((90 - lat) / 180) * (w / 2)];
}

/** Inverse azimuthal-equidistant projection around (lat0, lon0); x east, y north, in km. */
export function localToLatLon(body: Body, lat0: number, lon0: number, xKm: number, yKm: number): [number, number] {
  const R = RADIUS[body] / 1000;
  const rho = Math.hypot(xKm, yKm);
  if (rho < 1e-9) return [lat0, lon0];
  const c = rho / R;
  const p0 = (lat0 * Math.PI) / 180;
  const lat = Math.asin(Math.cos(c) * Math.sin(p0) + (yKm * Math.sin(c) * Math.cos(p0)) / rho);
  const lon = (lon0 * Math.PI) / 180 + Math.atan2(xKm * Math.sin(c), rho * Math.cos(p0) * Math.cos(c) - yKm * Math.sin(p0) * Math.sin(c));
  let lonDeg = (lon * 180) / Math.PI;
  lonDeg = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  return [(lat * 180) / Math.PI, lonDeg];
}

const tileCache = new Map<string, Promise<ImageData | null>>();

/** NASA MODIS land/water mask (MOD44W, 250 m) on GIBS: oceans, lakes and big rivers; water pixels are opaque. */
const WATER_URL = (z: number, x: number, y: number) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Water_Mask/default/GoogleMapsCompatible_Level9/${z}/${y}/${x}.png`;

/**
 * 1 where an n x n grid around (lat, lon) (same layout as sampleTerrain) falls on water, else 0.
 * Null when the mask could not be loaded (callers then go without it).
 */
export async function sampleWater(lat: number, lon: number, footprintKm: number, n: number): Promise<Uint8Array | null> {
  const z = 9;
  const W = 256 * 2 ** z;
  const step = footprintKm / n;
  const px: [number, number][] = [];
  const need = new Set<string>();
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const [la, lo] = localToLatLon("earth", lat, lon, (i + 0.5 - n / 2) * step, (n / 2 - j - 0.5) * step);
      const l = Math.max(-85, Math.min(85, la)) * (Math.PI / 180);
      const X = (((lo + 180) / 360) * W) % W;
      const Y = ((1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2) * W;
      px.push([X, Y]);
      need.add(`${Math.floor(X / 256)},${Math.floor(Y / 256)}`);
    }
  const tiles = new Map<string, ImageData | null>();
  await Promise.all([...need].map(async (k) => tiles.set(k, await loadTile(WATER_URL(z, +k.split(",")[0], +k.split(",")[1])))));
  if ([...tiles.values()].every((t) => !t)) return null;
  const out = new Uint8Array(n * n);
  px.forEach(([X, Y], k) => {
    const t = tiles.get(`${Math.floor(X / 256)},${Math.floor(Y / 256)}`);
    if (!t) return;
    const o = (Math.min(255, Math.floor(Y % 256)) * t.width + Math.min(255, Math.floor(X % 256))) * 4;
    out[k] = t.data[o + 3] > 127 ? 1 : 0;
  });
  return out;
}

export function loadTile(url: string): Promise<ImageData | null> {
  let p = tileCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    tileCache.set(url, p);
  }
  return p;
}

export interface TerrainGrid {
  body: Body;
  n: number;
  spacingKm: number;
  heights: Float32Array; // metres, row-major, row 0 = north
  min: number;
  max: number;
  zoom: number;
  nativeKm: number;
  source: DemSource;
  missing: number; // share of no-data samples
}

export interface SampleOptions {
  body: Body;
  lat: number;
  lon: number;
  footprintKm: number;
  spacingKm: number;
  onProgress?: (done: number, total: number) => void;
}

export function chooseZoom(src: DemSource, lat: number, spacingKm: number) {
  let z = src.maxZoom;
  // Coarsen Earth to roughly the shared spacing, never finer than needed.
  while (z > 0 && nativeKm(src, z - 1, lat) <= spacingKm * 1.05) z--;
  return z;
}

export async function sampleTerrain({ body, lat, lon, footprintKm, spacingKm, onProgress }: SampleOptions): Promise<TerrainGrid> {
  const src = DEM[body];
  const n = Math.max(24, Math.min(128, Math.round(footprintKm / spacingKm)));
  const step = footprintKm / n;
  let z = chooseZoom(src, lat, step);
  // Polar footprints touch every longitude column, cap the request count.
  const cols0 = (src.grid === "mercator" ? 1 : 2) * 2 ** z;
  if (Math.abs(lat) > 80 && cols0 > 64 && src.grid === "equirect") z = Math.max(0, z - 1);
  const worldW = (src.grid === "mercator" ? 256 : 512) * 2 ** z;

  // Pre-compute pixel positions and the set of tiles they touch.
  const px = new Float64Array(n * n * 2);
  const need = new Set<string>();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 - n / 2) * step;
      const y = (n / 2 - j - 0.5) * step;
      const [la, lo] = localToLatLon(body, lat, lon, x, y);
      const [X, Y] = worldPx(src, z, la, lo);
      const k = (j * n + i) * 2;
      px[k] = X;
      px[k + 1] = Y;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const tx = ((Math.floor((X + dx) / 256) % (worldW / 256)) + worldW / 256) % (worldW / 256);
        const ty = Math.floor((Y + dy) / 256);
        need.add(`${tx},${ty}`);
      }
    }
  }

  const tiles = new Map<string, ImageData | null>();
  const keys = [...need];
  let done = 0;
  await Promise.all(
    keys.map(async (key) => {
      const [tx, ty] = key.split(",").map(Number);
      const maxY = src.grid === "mercator" ? 2 ** z - 1 : 2 ** z - 1;
      tiles.set(key, ty < 0 || ty > maxY ? null : await loadTile(src.url(z, tx, ty)));
      onProgress?.(++done, keys.length);
    }),
  );

  const at = (X: number, Y: number): number | null => {
    const tx = ((Math.floor(X / 256) % (worldW / 256)) + worldW / 256) % (worldW / 256);
    const ty = Math.floor(Y / 256);
    const t = tiles.get(`${tx},${ty}`);
    if (!t) return null;
    const ix = Math.min(255, Math.max(0, Math.floor(X - Math.floor(X / 256) * 256)));
    const iy = Math.min(255, Math.max(0, Math.floor(Y - ty * 256)));
    const o = (iy * t.width + ix) * 4;
    return src.decode(t.data[o], t.data[o + 1], t.data[o + 2], t.data[o + 3]);
  };

  const raw = new Float32Array(n * n);
  let miss = 0;
  for (let k = 0; k < n * n; k++) {
    const X = px[k * 2] - 0.5;
    const Y = px[k * 2 + 1] - 0.5;
    const x0 = Math.floor(X);
    const y0 = Math.floor(Y);
    const fx = X - x0;
    const fy = Y - y0;
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    const vals = [a, b, c, d];
    if (vals.some((v) => v === null)) {
      const ok = vals.filter((v): v is number => v !== null);
      if (!ok.length) {
        miss++;
        raw[k] = NaN;
        continue;
      }
      raw[k] = ok.reduce((s, v) => s + v, 0) / ok.length;
    } else {
      raw[k] = (a! * (1 - fx) + b! * fx) * (1 - fy) + (c! * (1 - fx) + d! * fx) * fy;
    }
  }
  // Fill gaps with the mean so geometry stays continuous (reported as `missing`).
  let sum = 0;
  let cnt = 0;
  raw.forEach((v) => {
    if (!Number.isNaN(v)) {
      sum += v;
      cnt++;
    }
  });
  const mean = cnt ? sum / cnt : 0;
  for (let k = 0; k < raw.length; k++) if (Number.isNaN(raw[k])) raw[k] = mean;

  const heights = gaussian(raw, n, body === "earth" ? 0.8 : 1.1);
  let min = Infinity;
  let max = -Infinity;
  heights.forEach((v) => {
    if (v < min) min = v;
    if (v > max) max = v;
  });
  return { body, n, spacingKm: step, heights, min, max, zoom: z, nativeKm: nativeKm(src, z, lat), source: src, missing: miss / (n * n) };
}

function gaussian(src: Float32Array, n: number, sigma: number) {
  const r = Math.ceil(sigma * 2.5);
  const k: number[] = [];
  let ks = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    ks += v;
  }
  const kn = k.map((v) => v / ks);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let t = -r; t <= r; t++) s += src[j * n + Math.min(n - 1, Math.max(0, i + t))] * kn[t + r];
      tmp[j * n + i] = s;
    }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let t = -r; t <= r; t++) s += tmp[Math.min(n - 1, Math.max(0, j + t)) * n + i] * kn[t + r];
      out[j * n + i] = s;
    }
  return out;
}

/* ------------------------------------------------------------------ statistics */

export const SLOPE_BINS = [0, 1, 2, 4, 6, 10, 15, 25, 90];

export interface TerrainStats {
  slopeHist: number[];
  meanSlope: number;
  p90Slope: number;
  relief: number; // P98 − P2, metres
  roughness: number; // std of residual after smoothing, metres
}

export function terrainStats(g: TerrainGrid): TerrainStats {
  const { n, heights } = g;
  const d = g.spacingKm * 1000 * 2;
  const slopes: number[] = [];
  for (let j = 1; j < n - 1; j++)
    for (let i = 1; i < n - 1; i++) {
      const dzdx = (heights[j * n + i + 1] - heights[j * n + i - 1]) / d;
      const dzdy = (heights[(j + 1) * n + i] - heights[(j - 1) * n + i]) / d;
      slopes.push((Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI);
    }
  const hist = new Array(SLOPE_BINS.length - 1).fill(0);
  slopes.forEach((s) => {
    for (let b = SLOPE_BINS.length - 2; b >= 0; b--)
      if (s >= SLOPE_BINS[b]) {
        hist[b]++;
        break;
      }
  });
  const sorted = [...slopes].sort((a, b) => a - b);
  const hs = Array.from(heights).sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  const smooth = gaussian(heights, n, 4);
  let rss = 0;
  for (let k = 0; k < heights.length; k++) rss += (heights[k] - smooth[k]) ** 2;
  return {
    slopeHist: hist.map((v) => v / slopes.length),
    meanSlope: slopes.reduce((a, b) => a + b, 0) / slopes.length,
    p90Slope: q(sorted, 0.9),
    relief: q(hs, 0.98) - q(hs, 0.02),
    roughness: Math.sqrt(rss / heights.length),
  };
}

/** 0..1, slope-distribution overlap blended with relief agreement. */
export function topographySimilarity(a: TerrainStats, b: TerrainStats) {
  const overlap = a.slopeHist.reduce((s, v, i) => s + Math.min(v, b.slopeHist[i]), 0);
  const ratio = Math.max(a.relief, 1) / Math.max(b.relief, 1);
  const relief = Math.max(0, 1 - Math.abs(Math.log10(ratio)));
  return 0.65 * overlap + 0.35 * relief;
}

/* ------------------------------------------------------------- illumination */

export interface Illumination {
  lit: Float32Array; // fraction of azimuths from which the Sun is visible, per cell
  persistentShadow: number; // share of cells never lit during a full turn of the Sun
  meanLit: number;
}

/**
 * Horizon method: for each cell and 24 azimuths, find the highest terrain elevation
 * angle; the Sun (constant elevation, as at the lunar poles) lights the cell from that
 * azimuth only if it is above that horizon.
 */
export function illumination(g: TerrainGrid, sunElevDeg: number, azimuths = 24): Illumination {
  const { n, heights } = g;
  const cell = g.spacingKm * 1000;
  const tanSun = Math.tan((sunElevDeg * Math.PI) / 180);
  const lit = new Float32Array(n * n);
  const maxSteps = Math.floor(n * 0.6);
  const dirs = Array.from({ length: azimuths }, (_, a) => {
    const t = (2 * Math.PI * a) / azimuths;
    return [Math.sin(t), -Math.cos(t)];
  });
  let never = 0;
  let total = 0;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const h0 = heights[j * n + i];
      let count = 0;
      for (const [dx, dy] of dirs) {
        let blocked = false;
        for (let s = 1; s <= maxSteps; s++) {
          const x = Math.round(i + dx * s);
          const y = Math.round(j + dy * s);
          if (x < 0 || y < 0 || x >= n || y >= n) break;
          if ((heights[y * n + x] - h0) / (s * cell) > tanSun) {
            blocked = true;
            break;
          }
        }
        if (!blocked) count++;
      }
      const f = count / azimuths;
      lit[j * n + i] = f;
      total += f;
      if (count === 0) never++;
    }
  return { lit, persistentShadow: never / (n * n), meanLit: total / (n * n) };
}

/* ------------------------------------------------------------------ imagery */

export interface ImgSource {
  id: string;
  body: Body;
  name: string;
  instrument: string;
  res: string;
  grid: "mercator" | "equirect";
  maxZoom: number;
  url: (z: number, x: number, y: number) => string;
}

const TREK = "https://trek.nasa.gov/tiles";
const trek = (body: string, layer: string, ext: string) => (z: number, x: number, y: number) =>
  `${TREK}/${body}/EQ/${layer}/1.0.0/default/default028mm/${z}/${y}/${x}.${ext}`;

/** Real imagery, sampled onto the same ground footprint as the elevation grids. */
export const IMAGERY: Record<Body, { visible: ImgSource; second: ImgSource }> = {
  earth: {
    visible: {
      id: "s2",
      body: "earth",
      name: "Sentinel-2 cloudless 2020",
      instrument: "ESA Copernicus Sentinel-2 · EOX",
      res: "10 m",
      grid: "mercator",
      maxZoom: 14,
      url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/${z}/${y}/${x}.jpg`,
    },
    second: {
      id: "aster",
      body: "earth",
      name: "ASTER GDEM hillshade",
      instrument: "NASA/METI Terra ASTER",
      res: "30 m",
      grid: "mercator",
      maxZoom: 12,
      url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/${z}/${y}/${x}.jpg`,
    },
  },
  moon: {
    visible: {
      id: "wac",
      body: "moon",
      name: "LROC WAC global mosaic",
      instrument: "NASA LRO Camera",
      res: "100 m",
      grid: "equirect",
      maxZoom: 7,
      url: trek("Moon", "LRO_WAC_Mosaic_Global_303ppd_v02", "jpg"),
    },
    second: {
      id: "lola",
      body: "moon",
      name: "LOLA hillshade",
      instrument: "NASA LRO LOLA",
      res: "118 m",
      grid: "equirect",
      maxZoom: 6,
      url: trek("Moon", "LRO_LOLA_Shade_Global_256ppd_v06", "png"),
    },
  },
  mars: {
    visible: {
      id: "viking",
      body: "mars",
      name: "Viking MDIM 2.1 colour",
      instrument: "NASA Viking Orbiters",
      res: "232 m",
      grid: "equirect",
      maxZoom: 7,
      url: trek("Mars", "Mars_Viking_MDIM21_ClrMosaic_global_232m", "jpg"),
    },
    second: {
      id: "themis",
      body: "mars",
      name: "THEMIS day infrared",
      instrument: "NASA Mars Odyssey THEMIS",
      res: "100 m",
      grid: "equirect",
      maxZoom: 8,
      url: trek("Mars", "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018", "png"),
    },
  },
};

/** Sentinel-2 cloudless has colour artefacts over polar ice; use NASA Blue Marble there. */
export const EARTH_POLAR_VISIBLE: ImgSource = {
  id: "bmng",
  body: "earth",
  name: "Blue Marble Next Generation",
  instrument: "NASA Terra/Aqua MODIS",
  res: "500 m",
  grid: "mercator",
  maxZoom: 8,
  url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`,
};
export function earthVisible(lat: number) {
  return Math.abs(lat) > 60 ? EARTH_POLAR_VISIBLE : IMAGERY.earth.visible;
}

function srcKm(src: { grid: "mercator" | "equirect"; body: Body }, z: number, lat: number) {
  if (src.grid === "mercator") return (156.543_033_92 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
  return (Math.PI * RADIUS[src.body]) / 1000 / (256 * 2 ** z);
}

/** Resample real imagery onto an N×N ground grid (north up, same footprint as the DEM). */
export async function sampleImagery(src: ImgSource, lat: number, lon: number, footprintKm: number, size = 512): Promise<HTMLCanvasElement> {
  const step = footprintKm / size;
  let z = src.maxZoom;
  while (z > 0 && srcKm(src, z - 1, lat) <= step) z--;

  // tiles are keyed by number, not by a "x,y" string: this runs for every pixel (100,000 for a
  // 320 px thumbnail), and building strings there cost about a third of a second per thumbnail
  const TK = 16384;
  const tileKey = (tx: number, ty: number) => tx * TK + ty + 1;
  const plan = (zz: number) => {
    const worldW = (src.grid === "mercator" ? 256 : 512) * 2 ** zz;
    const pts = new Float64Array(size * size * 2);
    const need = new Set<number>();
    const fake: DemSource = { ...DEM[src.body], grid: src.grid };
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const [la, lo] = localToLatLon(src.body, lat, lon, (i + 0.5 - size / 2) * step, (size / 2 - j - 0.5) * step);
        const [X, Y] = worldPx(fake, zz, la, lo);
        pts[(j * size + i) * 2] = X;
        pts[(j * size + i) * 2 + 1] = Y;
        const cols = worldW / 256;
        need.add(tileKey(((Math.floor(X / 256) % cols) + cols) % cols, Math.floor(Y / 256)));
      }
    return { pts, need, worldW };
  };
  let p = plan(z);
  // Near the poles the footprint spans many longitudes, trade resolution for tile count.
  while (p.need.size > 80 && z > 0) p = plan(--z);

  const tiles = new Map<number, ImageData | null>();
  await Promise.all(
    [...p.need].map(async (key) => {
      const tx = Math.floor(key / TK);
      const ty = (key % TK) - 1;
      tiles.set(key, ty < 0 || ty >= 2 ** z ? null : await loadTile(src.url(z, tx, ty)));
    }),
  );

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!; // CPU canvas: toDataURL without a GPU read-back
  const out = ctx.createImageData(size, size);
  const cols = p.worldW / 256;
  const px = (X: number, Y: number, o: number[]) => {
    const tx = ((Math.floor(X / 256) % cols) + cols) % cols;
    const ty = Math.floor(Y / 256);
    const t = tiles.get(tileKey(tx, ty));
    if (!t) return false;
    const ix = Math.min(t.width - 1, Math.max(0, Math.floor(X - Math.floor(X / 256) * 256)));
    const iy = Math.min(t.height - 1, Math.max(0, Math.floor(Y - ty * 256)));
    const k = (iy * t.width + ix) * 4;
    o[0] = t.data[k];
    o[1] = t.data[k + 1];
    o[2] = t.data[k + 2];
    o[3] = t.data[k + 3];
    return true;
  };
  const a = [0, 0, 0, 0];
  const b = [0, 0, 0, 0];
  const c = [0, 0, 0, 0];
  const d = [0, 0, 0, 0];
  for (let k = 0; k < size * size; k++) {
    const X = p.pts[k * 2] - 0.5;
    const Y = p.pts[k * 2 + 1] - 0.5;
    const x0 = Math.floor(X);
    const y0 = Math.floor(Y);
    const fx = X - x0;
    const fy = Y - y0;
    const ok = px(x0, y0, a) && px(x0 + 1, y0, b) && px(x0, y0 + 1, c) && px(x0 + 1, y0 + 1, d);
    for (let ch = 0; ch < 3; ch++)
      out.data[k * 4 + ch] = ok ? (a[ch] * (1 - fx) + b[ch] * fx) * (1 - fy) + (c[ch] * (1 - fx) + d[ch] * fx) * fy : 12;
    out.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** W–E elevation profile through the centre row (metres relative to the grid mean). */
export function centreProfile(g: TerrainGrid) {
  const row = Math.floor(g.n / 2);
  const vals = Array.from(g.heights.slice(row * g.n, row * g.n + g.n));
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  return vals.map((v, i) => ({ km: (i + 0.5) * g.spacingKm, m: v - mean }));
}
