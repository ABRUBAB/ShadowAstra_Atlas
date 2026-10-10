/**
 * Light Twin — solar-geometry comparison between an Earth site and a Moon/Mars target.
 *
 * Computed, not demo: for each body we sample the Sun's elevation over a full year
 * (Earth / Mars) or a full seasonal cycle (Moon) and every hour angle, then compare
 * the distributions of daylight Sun elevation. Circular orbits are assumed, which is
 * accurate to a degree or two — enough to separate "polar low-Sun" from "tropical".
 */
import type { Body } from "../data/sites";

const D2R = Math.PI / 180;
export const OBLIQUITY: Record<Body, number> = { earth: 23.44, moon: 1.54, mars: 25.19 };

/** Elevation-bin edges in degrees (daylight only). */
export const SUN_BINS = [0, 2, 5, 10, 20, 30, 45, 60, 90];

function elevation(lat: number, decl: number, hourAngle: number) {
  const s = Math.sin(lat * D2R) * Math.sin(decl * D2R) + Math.cos(lat * D2R) * Math.cos(decl * D2R) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, s))) / D2R;
}

function binOf(e: number) {
  for (let i = SUN_BINS.length - 2; i >= 0; i--) if (e >= SUN_BINS[i]) return i;
  return 0;
}

export interface SunRegime {
  hist: number[]; // normalised daylight elevation distribution (display bins)
  fine: number[]; // 1° bins, 0–90°, for the distance metric
  daylight: number; // fraction of time the Sun is up
  maxElev: number;
  medianElev: number;
}

/** Distribution over a season fraction window [from, to) of the orbit (0..1). */
export function sunRegime(body: Body, lat: number, from = 0, to = 1, steps = 96): SunRegime {
  const hist = new Array(SUN_BINS.length - 1).fill(0);
  const fine = new Array(90).fill(0);
  let up = 0;
  let total = 0;
  let maxElev = -90;
  const all: number[] = [];
  const seasons = 72;
  for (let i = 0; i < seasons; i++) {
    const f = from + ((to - from) * (i + 0.5)) / seasons;
    const decl = OBLIQUITY[body] * Math.sin(2 * Math.PI * f);
    for (let h = 0; h < steps; h++) {
      const e = elevation(lat, decl, (2 * Math.PI * h) / steps);
      total++;
      if (e > 0) {
        up++;
        hist[binOf(e)]++;
        fine[Math.min(89, Math.floor(e))]++;
        all.push(e);
        if (e > maxElev) maxElev = e;
      }
    }
  }
  const n = hist.reduce((a, b) => a + b, 0) || 1;
  all.sort((a, b) => a - b);
  return {
    hist: hist.map((v) => v / n),
    fine: fine.map((v) => v / n),
    daylight: up / total,
    maxElev: Math.max(0, maxElev),
    medianElev: all.length ? all[Math.floor(all.length / 2)] : 0,
  };
}

export function histOverlap(a: number[], b: number[]) {
  return a.reduce((s, v, i) => s + Math.min(v, b[i] ?? 0), 0);
}

/**
 * Similarity of two daylight Sun-elevation distributions: 1 − W1/25°, where W1 is the
 * earth-mover (Wasserstein-1) distance in degrees. A 2° vs 1° Sun scores ~0.96;
 * a tropical vs polar Sun scores 0.
 */
export function sunSimilarity(a: SunRegime, b: SunRegime) {
  if (a.daylight === 0 || b.daylight === 0) return 0;
  let ca = 0;
  let cb = 0;
  let w1 = 0;
  for (let i = 0; i < 90; i++) {
    ca += a.fine[i];
    cb += b.fine[i];
    w1 += Math.abs(ca - cb);
  }
  return Math.max(0, 1 - w1 / 25);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Earth "orbit fraction" f for month m: declination follows sin(2π f), which is 0 at the
 * March equinox (~day 80). f = (day - 80) / 365.
 */
function monthWindow(m: number): [number, number] {
  const start = (m * 30.44 - 80 + 365) / 365;
  return [start, start + 30.44 / 365];
}

export interface LightTwin {
  score: number; // 0..1 in the best rehearsal season
  annual: number; // 0..1 over the whole year
  earth: SunRegime;
  target: SunRegime;
  months: { month: string; score: number }[];
  best: string[];
}

export function lightTwin(earthLat: number, targetBody: Body, targetLat: number): LightTwin {
  const target = sunRegime(targetBody, targetLat);
  const earth = sunRegime("earth", earthLat);
  const months = MONTHS.map((month, m) => {
    const [a, b] = monthWindow(m);
    return { month, score: sunSimilarity(sunRegime("earth", earthLat, a, b, 48), target) };
  });
  const top = Math.max(...months.map((m) => m.score));
  return {
    score: top,
    annual: sunSimilarity(earth, target),
    earth,
    target,
    months,
    best: months.filter((m) => m.score >= top - 0.03 && top > 0).map((m) => m.month),
  };
}

/** Daily noon and midnight Sun elevation at an Earth latitude, for the rehearsal calendar. */
export function earthDailyExtremes(lat: number) {
  const out: { day: number; max: number; min: number }[] = [];
  for (let d = 0; d < 365; d += 3) {
    const decl = OBLIQUITY.earth * Math.sin((2 * Math.PI * (d - 80)) / 365);
    out.push({ day: d, max: elevation(lat, decl, 0), min: elevation(lat, decl, Math.PI) });
  }
  return out;
}

/** Highest and lowest noon Sun the target ever sees (its full seasonal band). */
export function targetBand(body: Body, lat: number) {
  const ob = OBLIQUITY[body];
  let max = -90;
  let min = 90;
  for (let i = 0; i < 72; i++) {
    const decl = ob * Math.sin((2 * Math.PI * i) / 72);
    max = Math.max(max, elevation(lat, decl, 0));
    min = Math.min(min, elevation(lat, decl, 0));
  }
  return { max, min };
}
