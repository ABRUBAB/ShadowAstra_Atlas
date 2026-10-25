/**
 * Pinpoint: the 10 km piece of a 55 km place whose ground is most like the target's.
 *
 * Same heights (SRTM terrain tiles), grid spacing (1.19 km), smoothing and slope baseline as every
 * other ground number on the site. A 59.5 km square around the place is cut into 10 km windows
 * every 2.4 km (centres within the central 50 km), leaving out pieces more than 20% water (NASA
 * MODIS water mask: lakes and sea are dead flat in the height data); each window is scored by how
 * much its slope histogram overlaps the target's. Height range is shown but not scored: it grows with window
 * size, so it cannot be compared fairly with the target's 50 km range.
 *
 * The Python twin and its test on the 66 known and independent sites: pipeline/s23_pinpoint.py.
 * tests/unit/pinpoint.test.ts checks this file against it.
 */
import { useEffect, useState } from "react";
import { SLOPE_BINS, localToLatLon, sampleTerrain, sampleWater } from "./terrain";

export const PIN = { step: 50 / 42, n: 50, win: 8, stride: 2, half: 25, maxWater: 0.2 } as const;

export interface PinWindow {
  /** Window centre, km east and north of the place centre. */
  x: number;
  y: number;
  /** Slope-histogram overlap with the target, 0 to 1. */
  score: number;
  meanSlope: number;
  /** Height range inside the window (2nd to 98th percentile), metres. */
  relief: number;
}

/** Score every 10 km window of an n x n grid of smoothed heights (metres, row 0 = north). */
export function pinpointWindows(h: ArrayLike<number>, n: number, step: number, targetHist: number[], o: { win?: number; stride?: number; half?: number; water?: ArrayLike<number> | null } = {}): PinWindow[] {
  const win = o.win ?? PIN.win;
  const water = o.water ?? null;
  const stride = o.stride ?? PIN.stride;
  const half = o.half ?? PIN.half;
  const d = step * 1000 * 2;
  const m = n - 2;
  const s = new Float64Array(m * m); // s[j * m + i] is the slope at height pixel (j + 1, i + 1)
  for (let j = 0; j < m; j++)
    for (let i = 0; i < m; i++) {
      const gx = (h[(j + 1) * n + i + 2] - h[(j + 1) * n + i]) / d;
      const gy = (h[(j + 2) * n + i + 1] - h[j * n + i + 1]) / d;
      s[j * m + i] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  const out: PinWindow[] = [];
  const bins = SLOPE_BINS.length - 1;
  for (let wj = 0; wj + win <= m; wj += stride)
    for (let wi = 0; wi + win <= m; wi += stride) {
      const cj = wj + 1 + (win - 1) / 2;
      const ci = wi + 1 + (win - 1) / 2;
      const x = (ci + 0.5 - n / 2) * step;
      const y = (n / 2 - cj - 0.5) * step;
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      if (water) {
        // lakes and sea are dead flat in the height data, so a piece that is mostly water is left out
        let wet = 0;
        for (let j = wj; j < wj + win; j++) for (let i = wi; i < wi + win; i++) wet += water[(j + 1) * n + i + 1];
        if (wet / (win * win) > PIN.maxWater) continue;
      }
      const hist = new Array(bins).fill(0);
      const hs: number[] = [];
      let sum = 0;
      for (let j = wj; j < wj + win; j++)
        for (let i = wi; i < wi + win; i++) {
          const v = s[j * m + i];
          sum += v;
          for (let b = 0; b < bins; b++)
            if (v >= SLOPE_BINS[b] && v < SLOPE_BINS[b + 1]) {
              hist[b]++;
              break;
            }
          hs.push(h[(j + 1) * n + i + 1]);
        }
      const count = win * win;
      let score = 0;
      for (let b = 0; b < bins; b++) score += Math.min(hist[b] / count, targetHist[b]);
      hs.sort((a, b) => a - b);
      const q = (p: number) => hs[Math.min(hs.length - 1, Math.floor(p * hs.length))];
      out.push({ x, y, score, meanSlope: sum / count, relief: q(0.98) - q(0.02) });
    }
  return out;
}

export interface Pinpoint {
  best: PinWindow & { lat: number; lon: number };
  /** Average window score: how much better the best piece is than the place as a whole. */
  mean: number;
  /** How many 10 km windows were compared. */
  windows: number;
  /** Share of height samples the terrain tiles could not supply (filled with the mean). */
  missing: number;
}

const cache = new Map<string, Promise<Pinpoint>>();

/** The best 10 km spot of the place centred on (lat, lon) for a target's slope histogram. */
export function pinpoint(lat: number, lon: number, targetHist: number[]): Promise<Pinpoint> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${targetHist.join(",")}`;
  let p = cache.get(key);
  if (!p) {
    p = Promise.all([sampleTerrain({ body: "earth", lat, lon, footprintKm: PIN.n * PIN.step, spacingKm: PIN.step }), sampleWater(lat, lon, PIN.n * PIN.step, PIN.n).catch(() => null)]).then(([g, water]) => {
      let ws = pinpointWindows(g.heights, g.n, g.spacingKm, targetHist, { water: water && water.length === g.n * g.n ? water : null });
      if (!ws.length) ws = pinpointWindows(g.heights, g.n, g.spacingKm, targetHist); // all water: show the land-blind answer
      let best = ws[0];
      for (const w of ws) if (w.score > best.score) best = w;
      const [la, lo] = localToLatLon("earth", lat, lon, best.x, best.y);
      return { best: { ...best, lat: la, lon: lo }, mean: ws.reduce((a, w) => a + w.score, 0) / ws.length, windows: ws.length, missing: g.missing };
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** React hook around pinpoint(); null while loading, "failed" when the terrain tiles did not load. */
export function usePinpoint(lat: number | null, lon: number | null, targetHist: number[] | null) {
  const [state, setState] = useState<Pinpoint | "failed" | null>(null);
  const key = targetHist?.join(",");
  useEffect(() => {
    if (lat === null || lon === null || !targetHist) return;
    let alive = true;
    setState(null);
    pinpoint(lat, lon, targetHist).then(
      (r) => alive && setState(r),
      () => alive && setState("failed"),
    );
    return () => {
      alive = false;
    };
  }, [lat, lon, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
