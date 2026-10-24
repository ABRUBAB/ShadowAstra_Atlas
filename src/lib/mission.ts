/**
 * Mission builder logic: the user's requirements become hard filters and weights, the
 * planet is scored, and we explain which requirement is holding back better sites.
 */
import { TARGET_BY_ID, type TaskId, type World } from "../data/sites";
import { TASK_WEIGHTS, type Weights } from "./scoring";
import { sunRegime, sunSimilarity } from "./sun";
import { MODEL_MIX, haversineKm, rankPlaces, scoreAll, shapeOptions, type Candidate, type Grid, type GridTarget, type ShapeSource } from "./grid";

/** Default ground-shape judge, chosen on the known sites in the full score (pipeline/s14_validate.py, section 5b). */
export const DEFAULT_SHAPE: ShapeSource = "formula";

/* ------------------------------------------------------------------ mission */

export interface Home {
  name: string;
  lat: number;
  lon: number;
}

export interface Mission {
  target: string;
  task: TaskId;
  home: Home;
  /** Hard limits. null means "no limit". */
  maxKm: number | null;
  townKm: number | null;
  maxElev: number | null;
  month: number | null;
  skipAntarctica: boolean;
  onlyNew: boolean;
  weights: Weights;
  modelMix: number;
  /** What judges ground shape: our formula, the K3 terrain AI, or half and half. */
  shape: ShapeSource;
}

export const DHAKA: Home = { name: "Dhaka", lat: 23.81, lon: 90.41 };

export function defaultMission(target = "jezero", task: TaskId = "astrobio"): Mission {
  return {
    target,
    task,
    home: DHAKA,
    maxKm: null,
    townKm: null,
    maxElev: null,
    month: null,
    skipAntarctica: false,
    onlyNew: true,
    weights: { ...TASK_WEIGHTS[task] },
    modelMix: MODEL_MIX,
    shape: DEFAULT_SHAPE,
  };
}

export interface Preset {
  id: string;
  title: string;
  line: string;
  target: string;
  task: TaskId;
}

/** Ready-made missions for people who don't know where to start. */
export const PRESETS: Preset[] = [
  { id: "artemis", title: "Artemis base camp", line: "Live and work at the Moon's south pole", target: "shackleton", task: "base" },
  { id: "landing", title: "First crewed Mars landing", line: "Practise touching down on icy Arcadia Planitia", target: "arcadia", task: "landing" },
  { id: "rover", title: "Mars rover drive", line: "Drive the slopes of Gale crater like Curiosity", target: "gale", task: "traverse" },
  { id: "ice", title: "Ice hunt on Mars", line: "Find buried ice like at Deuteronilus Mensae", target: "deuteronilus", task: "ice" },
  { id: "caves", title: "Lava-tube shelter", line: "Explore volcanic caves like the Marius Hills pit", target: "marius-pit", task: "caves" },
  { id: "life", title: "Search for life", line: "Sample rocks like Perseverance does in Jezero", target: "jezero", task: "astrobio" },
];

/* ------------------------------------------------------------------ the four factors */

/** The challenge names four factors; we show the five measured scores grouped into them. */
export const FACTORS = [
  { id: "ground", label: "Ground shape", plain: "Slopes and height range across 50 km", dims: ["topography"] as const },
  { id: "rocks", label: "Rocks & craters", plain: "Volcanic ground, impact craters and bare rock", dims: ["geology"] as const },
  { id: "climate", label: "Cold & light", plain: "Cold nights, heat swing and how high the Sun climbs", dims: ["temperature", "lighting"] as const },
  { id: "resources", label: "Ice & loose ground", plain: "Frozen ground where ice matters, bare dry soil where digging matters", dims: ["regolith"] as const },
] as const;
export type FactorId = (typeof FACTORS)[number]["id"];

/** Simple importance levels for people, mapped to weights. */
export const LEVELS = [
  { id: 0, label: "Ignore", w: 0 },
  { id: 1, label: "A little", w: 0.1 },
  { id: 2, label: "Matters", w: 0.25 },
  { id: 3, label: "Most", w: 0.45 },
];

export function factorLevel(weights: Weights, f: FactorId) {
  const dims = FACTORS.find((x) => x.id === f)!.dims as readonly (keyof Weights)[];
  const w = dims.reduce((a, d) => a + weights[d], 0) / (f === "climate" ? 1.4 : 1);
  return w >= 0.38 ? 3 : w >= 0.18 ? 2 : w > 0.02 ? 1 : 0;
}

export function setFactorLevel(weights: Weights, f: FactorId, level: number): Weights {
  const w = LEVELS[level].w;
  const next = { ...weights };
  if (f === "ground") next.topography = w;
  if (f === "rocks") next.geology = w;
  if (f === "resources") next.regolith = w;
  if (f === "climate") {
    const share = weights.temperature + weights.lighting > 0 ? weights.temperature / (weights.temperature + weights.lighting) : 0.5;
    next.temperature = w * 1.4 * share;
    next.lighting = w * 1.4 * (1 - share);
  }
  return next;
}

/* ------------------------------------------------------------------ month light */

const monthCache = new Map<string, Float32Array>();

function monthWindow(m: number): [number, number] {
  const start = (m * 30.44 - 80 + 365) / 365;
  return [start, start + 30.44 / 365];
}

/** Sunlight match for every Earth latitude row in one month (0..1), cached. */
export function monthLight(grid: Grid, t: GridTarget, month: number): Float32Array {
  const key = `${t.id}|${month}`;
  const hit = monthCache.get(key);
  if (hit) return hit;
  const target = sunRegime(t.body, t.lat);
  const rows = grid.meta.rows;
  const out = new Float32Array(rows);
  const [a, b] = monthWindow(month);
  for (let r = 0; r < rows; r++) {
    const lat = 90 - (r + 0.5) * grid.meta.res;
    out[r] = sunSimilarity(sunRegime("earth", lat, a, b, 40), target);
  }
  monthCache.set(key, out);
  return out;
}

/** A copy of the target whose light table uses one month instead of the best month. */
export function targetForMonth(grid: Grid, t: GridTarget, month: number | null): GridTarget {
  if (month === null) return t;
  const m = monthLight(grid, t, month);
  return { ...t, light: Array.from(m, (v) => Math.round(v * 100)) };
}

/* ------------------------------------------------------------------ filters */

export type Rule = "distance" | "town" | "altitude" | "antarctica" | "known";

export const RULE_TEXT: Record<Rule, { label: string; relax: string }> = {
  distance: { label: "too far from your team", relax: "Allow longer trips" },
  town: { label: "too far from a town", relax: "Allow remote places" },
  altitude: { label: "too high", relax: "Allow high places" },
  antarctica: { label: "in Antarctica", relax: "Allow Antarctica" },
  known: { label: "next to a site teams already use", relax: "Show places teams already use" },
};

let knownCache: { grid: Grid; km: Float32Array } | null = null;

/** Distance from every cell to the nearest known test site (computed once). */
export function knownKm(grid: Grid): Float32Array {
  if (knownCache?.grid === grid) return knownCache.km;
  const km = new Float32Array(grid.n).fill(Infinity);
  for (const s of grid.meta.known)
    for (let k = 0; k < grid.n; k++) {
      const d = haversineKm(grid.lat(k), grid.lon(k), s.lat, s.lon);
      if (d < km[k]) km[k] = d;
    }
  knownCache = { grid, km };
  return km;
}

export function homeKm(grid: Grid, home: Home): Float32Array {
  const out = new Float32Array(grid.n);
  for (let k = 0; k < grid.n; k++) out[k] = haversineKm(home.lat, home.lon, grid.lat(k), grid.lon(k));
  return out;
}

export interface Screening {
  pass: Uint8Array;
  passCount: number;
  removed: Record<Rule, number>;
}

/** Which cells meet every requirement, and how many each rule removes on its own. */
export function screen(grid: Grid, m: Mission, distKm: Float32Array, ignore?: Rule): Screening {
  const known = knownKm(grid);
  const placeKm = grid.arr("n_place_km");
  const elev = grid.arr("f_elev");
  const elevScale = grid.scale("f_elev");
  const pass = new Uint8Array(grid.n);
  const removed: Record<Rule, number> = { distance: 0, town: 0, altitude: 0, antarctica: 0, known: 0 };
  let passCount = 0;
  for (let k = 0; k < grid.n; k++) {
    let ok = true;
    const fail = (r: Rule) => {
      removed[r]++;
      if (r !== ignore) ok = false;
    };
    if (m.maxKm !== null && distKm[k] > m.maxKm) fail("distance");
    if (m.townKm !== null && placeKm[k] > m.townKm) fail("town");
    if (m.maxElev !== null && elev[k] / elevScale > m.maxElev) fail("altitude");
    if (m.skipAntarctica && grid.lat(k) < -60) fail("antarctica");
    if (m.onlyNew && known[k] < 150) fail("known");
    if (ok) {
      pass[k] = 1;
      passCount++;
    }
  }
  return { pass, passCount, removed };
}

/* ------------------------------------------------------------------ search */

export interface SearchResult {
  scores: Float32Array;
  screening: Screening;
  places: Candidate[];
  hints: { rule: Rule; best: Candidate; gain: number }[];
  target: GridTarget;
}

function masked(scores: Float32Array, pass: Uint8Array) {
  const out = new Float32Array(scores.length);
  for (let k = 0; k < scores.length; k++) out[k] = pass[k] ? scores[k] : -1;
  return out;
}

export function runSearch(grid: Grid, m: Mission, distKm: Float32Array): SearchResult {
  const base = grid.targets[m.target];
  const target = targetForMonth(grid, base, m.month);
  const scores = scoreAll(grid, { target, task: m.task, weights: m.weights, modelMix: m.modelMix, ...shapeOptions(m.shape, m.target) });
  const screening = screen(grid, m, distKm);
  // ten different places: spaced out, and no two with the same name
  const seen = new Set<string>();
  const places = rankPlaces(grid, masked(scores, screening.pass), { count: 30, spacingKm: 300 })
    .filter((c) => {
      const title = grid.name(c.k).title;
      if (c.score <= 0 || seen.has(title)) return false;
      seen.add(title);
      return true;
    })
    .slice(0, 10);
  const best = places[0]?.score ?? 0;
  const hints: SearchResult["hints"] = [];
  const active: Rule[] = [];
  if (m.maxKm !== null) active.push("distance");
  if (m.townKm !== null) active.push("town");
  if (m.maxElev !== null) active.push("altitude");
  if (m.skipAntarctica) active.push("antarctica");
  if (m.onlyNew) active.push("known");
  for (const r of active) {
    const s = screen(grid, m, distKm, r);
    const top = rankPlaces(grid, masked(scores, s.pass), { count: 1, spacingKm: 300 })[0];
    if (top && top.score > best + 0.015) hints.push({ rule: r, best: top, gain: top.score - best });
  }
  hints.sort((a, b) => b.gain - a.gain);
  return { scores, screening, places, hints, target };
}

/* ------------------------------------------------------------------ words */

export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const DISTANCES = [
  { km: null, label: "anywhere on Earth" },
  { km: 500, label: "500 km" },
  { km: 1000, label: "1,000 km" },
  { km: 2000, label: "2,000 km" },
  { km: 4000, label: "4,000 km" },
  { km: 8000, label: "8,000 km" },
];

export const TOWN_LIMITS = [
  { km: null, label: "any distance" },
  { km: 50, label: "50 km" },
  { km: 100, label: "100 km" },
  { km: 250, label: "250 km" },
];

export const ALTITUDES = [
  { m: null, label: "any height" },
  { m: 2500, label: "2,500 m" },
  { m: 4000, label: "4,000 m" },
];

export function worldOf(targetId: string): World {
  return TARGET_BY_ID[targetId]?.body ?? "mars";
}

/** What a field team would actually do there, by job. */
export const FIELD_TESTS: Record<TaskId, string[]> = {
  base: ["Set up a habitat for two weeks and live on limited power and water", "Test dust seals on doors and suits", "Practise night operations in deep cold"],
  landing: ["Fly a drone over the area to map hazards from above", "Test hazard-detection cameras on real rocks and slopes", "Measure how much dust a rocket plume would lift"],
  traverse: ["Drive a rover 10 km over the steepest ground you can find", "Measure wheel slip on loose sand and gravel", "Plan routes from orbital images, then check them on foot"],
  isru: ["Dig and sieve the loose soil, measure grain sizes", "Test drills and scoops on bare rock", "Try heating soil samples to release water or oxygen"],
  ice: ["Use ground radar to look for buried ice", "Drill shallow cores in frozen ground", "Test how ice samples survive storage and transport"],
  caves: ["Map lava tubes or caves with lidar and drones", "Test radio links from inside a cave", "Practise moving safely in darkness and rubble"],
  astrobio: ["Collect samples while keeping them clean of contamination", "Test life-detection instruments on dry rocks and salts", "Choose the best sample using only rover-style images"],
  impact: ["Map the crater rim, floor and ejecta from orbit and on foot", "Find and sample shocked rocks and impact melt", "Practise geology training for astronauts"],
  polar: ["Work through long shadows with a low Sun", "Test solar power when the Sun stays near the horizon", "Practise finding cold, permanently shadowed ground"],
};
