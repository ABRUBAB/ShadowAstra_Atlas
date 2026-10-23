/**
 * The global discovery grid: every land cell on Earth at 0.5° (about 55 km), built by
 * pipeline/s06_build.py from NASA POWER, NASA GIBS (MODIS), AWS Terrain Tiles,
 * Smithsonian GVP, impact craters and Natural Earth names.
 *
 * Everything here runs in the browser, so every slider re-ranks the whole planet live.
 */
import { useEffect, useState } from "react";
import type { TaskId, World } from "../data/sites";
import { TASK_WEIGHTS, type Weights } from "./scoring";

/* ------------------------------------------------------------------ types */

type DType = "uint8" | "int8" | "int16" | "uint16";
interface Field {
  name: string;
  dtype: DType;
  offset: number;
  scale: number;
  nodata: number;
  kind: string;
}

export interface GridTarget {
  id: string;
  body: World;
  name: string;
  lat: number;
  lon: number;
  terrain: { hist: number[]; mean_slope: number; p90_slope: number; relief: number; rough: number };
  /** Best-month sunlight match per Earth latitude row, 0 to 100. */
  light: number[];
  /** Month index (0 = Jan) of that best match, per row. */
  light_month: number[];
}

export interface KnownSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  worlds: World[];
  cell: number;
}

export interface Evaluation {
  positives: number;
  model_median_top_pct: number;
  baseline_median_top_pct: number;
  model_in_top10_pct: number;
  baseline_in_top10_pct: number;
  per_site: Record<string, [number, number]>;
  importance: [string, number][];
}

export interface GridMeta {
  version: number;
  res: number;
  rows: number;
  cols: number;
  count: number;
  mask_bytes: number;
  bin_bytes?: number;
  layout: Field[];
  slope_bins: number[];
  targets: GridTarget[];
  names: { country: string[]; region: string[]; place: string[]; place_ll?: [number, number][]; volcano: string[]; impact: string[] };
  known: KnownSite[];
  evaluation: Record<World, Evaluation>;
  sources: Record<string, string>;
}

type Arr = Uint8Array | Int8Array | Int16Array | Uint16Array;
const CTOR = { uint8: Uint8Array, int8: Int8Array, int16: Int16Array, uint16: Uint16Array } as const;

export const INDICATORS = ["dry", "bare", "cold", "swing", "airdry", "hot", "volcanic", "impact", "ice", "remote", "rugged"] as const;
export type Indicator = (typeof INDICATORS)[number];

/* ------------------------------------------------------------------ grid */

export class Grid {
  readonly meta: GridMeta;
  readonly n: number;
  readonly row: Uint16Array;
  readonly col: Uint16Array;
  /** rows × cols → cell index, or -1 for sea and ice-free gaps. */
  readonly index: Int32Array;
  private a: Record<string, Arr> = {};
  private f: Record<string, Field> = {};
  readonly targets: Record<string, GridTarget>;

  constructor(meta: GridMeta, buf: ArrayBuffer) {
    this.meta = meta;
    this.n = meta.count;
    for (const fl of meta.layout) {
      this.a[fl.name] = new CTOR[fl.dtype](buf, fl.offset, meta.count);
      this.f[fl.name] = fl;
    }
    const mask = new Uint8Array(buf, 0, meta.mask_bytes);
    this.row = new Uint16Array(this.n);
    this.col = new Uint16Array(this.n);
    this.index = new Int32Array(meta.rows * meta.cols).fill(-1);
    let k = 0;
    for (let p = 0; p < meta.rows * meta.cols && k < this.n; p++) {
      if (mask[p >> 3] & (0x80 >> (p & 7))) {
        this.row[k] = Math.floor(p / meta.cols);
        this.col[k] = p % meta.cols;
        this.index[p] = k++;
      }
    }
    this.targets = Object.fromEntries(meta.targets.map((t) => [t.id, t]));
  }

  lat(k: number) {
    return 90 - (this.row[k] + 0.5) * this.meta.res;
  }
  lon(k: number) {
    return -180 + (this.col[k] + 0.5) * this.meta.res;
  }
  has(name: string) {
    return name in this.a;
  }
  /** Raw typed array (fast loops). */
  arr(name: string): Arr {
    return this.a[name];
  }
  /** A measured value in real units, or null where the source has no data. */
  value(name: string, k: number): number | null {
    const fl = this.f[name];
    if (!fl) return null;
    const v = this.a[name][k];
    return v === fl.nodata ? null : v / fl.scale;
  }
  ind(name: Indicator, k: number) {
    return this.a[`i_${name}`][k] / 254;
  }
  /** Learned-model rank (0 to 1) for a world. */
  model(world: World, k: number) {
    return this.a[`model_${world}`][k] / this.f[`model_${world}`].scale;
  }
  scale(name: string) {
    return this.f[name]?.scale ?? 1;
  }
  hist(k: number) {
    const h: number[] = [];
    for (let b = 0; b < 8; b++) h.push(this.a[`h${b}`][k] / 254);
    return h;
  }

  /** Nearest land cell to a point (searches a few cells around coasts). */
  cellAt(lat: number, lon: number, maxRing = 4): number {
    const r0 = Math.min(this.meta.rows - 1, Math.max(0, Math.floor((90 - lat) / this.meta.res)));
    const c0 = Math.floor((((lon + 180) % 360) + 360) % 360 / this.meta.res);
    for (let ring = 0; ring <= maxRing; ring++) {
      let best = -1;
      let bd = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const r = r0 + dr;
          if (r < 0 || r >= this.meta.rows) continue;
          const c = (c0 + dc + this.meta.cols) % this.meta.cols;
          const k = this.index[r * this.meta.cols + c];
          if (k >= 0 && dr * dr + dc * dc < bd) {
            bd = dr * dr + dc * dc;
            best = k;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  name(k: number) {
    const N = this.meta.names;
    const ci = this.value("n_country", k);
    const ri = this.value("n_region", k);
    const pi = this.value("n_place", k);
    const country = ci === null ? null : N.country[ci];
    const region = ri === null ? null : N.region[ri];
    const place = pi === null ? null : N.place[pi];
    const placeKm = this.value("n_place_km", k);
    const lat = this.lat(k);
    const where = country ?? (lat < -60 ? "Antarctica" : null);
    const title = region ?? (place ? `Near ${place}` : where ?? "Remote land");
    const near = region && place && (placeKm ?? 0) < 400 ? `${Math.round(placeKm ?? 0)} km from ${place}` : null;
    const parts = [near, where].filter(Boolean);
    return { title, subtitle: parts.join(" · "), country: where, region, place, placeKm };
  }

  volcano(k: number) {
    const v = this.value("n_volc", k);
    const d = this.value("f_volc_km", k);
    return v === null || d === null ? null : { name: this.meta.names.volcano[v], km: d };
  }
  crater(k: number) {
    const v = this.value("n_impact", k);
    return v === null ? null : { name: this.meta.names.impact[v], score: this.ind("impact", k) };
  }
}

/* ------------------------------------------------------------------ loading */

let cache: Promise<Grid> | null = null;
const listeners = new Set<(p: number) => void>();
let lastProgress = 0;

async function fetchWithProgress(url: string, expected: number | undefined, onChunk: (got: number, total: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || expected || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onChunk(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out.buffer;
}

export function loadGrid(): Promise<Grid> {
  if (!cache) {
    const emit = (p: number) => {
      lastProgress = p;
      listeners.forEach((l) => l(p));
    };
    cache = (async () => {
      const meta: GridMeta = await (await fetch("/data/grid.json")).json();
      emit(0.08);
      const buf = await fetchWithProgress("/data/grid.bin", meta.bin_bytes, (got, total) => total && emit(0.08 + 0.9 * Math.min(1, got / total)));
      const g = new Grid(meta, buf);
      emit(1);
      return g;
    })();
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** React hook: the grid once loaded, plus download progress (0 to 1). */
export function useGrid() {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [progress, setProgress] = useState(lastProgress);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const on = (p: number) => alive && setProgress(p);
    listeners.add(on);
    loadGrid()
      .then((g) => alive && setGrid(g))
      .catch(() => alive && setError("The global data could not be loaded. Check your connection and try again."));
    return () => {
      alive = false;
      listeners.delete(on);
    };
  }, []);
  return { grid, progress, error };
}

/* ------------------------------------------------------------------ scoring */

export type Dim = keyof Weights;
export const DIMS: Dim[] = ["topography", "geology", "temperature", "lighting", "regolith"];

export const DIM_INFO: Record<Dim, { label: string; plain: string; source: string }> = {
  topography: { label: "Ground shape", plain: "Slopes and height range across 50 km, compared with the target at the same scale.", source: "AWS Terrain Tiles (SRTM) vs LRO LOLA / MGS MOLA" },
  geology: { label: "Rocks & craters", plain: "Volcanic ground, impact craters and bare rock, the raw material of Moon and Mars surfaces.", source: "Smithsonian GVP volcanoes, Earth Impact Database, MODIS land cover" },
  temperature: { label: "Cold & heat swing", plain: "How cold the nights get and how big the day to night change is.", source: "MODIS land surface temperature, NASA POWER air temperature" },
  lighting: { label: "Sunlight angle", plain: "How high the Sun climbs. Low Sun means long shadows, like the lunar poles.", source: "Our solar geometry (best month)" },
  regolith: { label: "Bare, dry ground", plain: "Little rain and no plants, so loose soil and rock are exposed.", source: "NASA POWER rainfall, MODIS vegetation (NDVI)" },
};

/** Rocks & craters proxy: depends on the job and the world. */
function geology(world: World, task: TaskId, volc: number, imp: number, bare: number, dry: number) {
  const hard = Math.max(volc, imp);
  switch (task) {
    case "caves":
      return 0.85 * volc + 0.15 * bare;
    case "impact":
      return 0.85 * imp + 0.15 * bare;
    case "astrobio":
      return 0.5 * dry + 0.3 * bare + 0.2 * hard;
    case "isru":
      return world === "moon" ? 0.6 * volc + 0.2 * imp + 0.2 * bare : 0.5 * volc + 0.2 * imp + 0.3 * bare;
    default:
      return world === "moon" ? 0.6 * hard + 0.4 * bare : 0.45 * hard + 0.3 * bare + 0.25 * dry;
  }
}

function temperature(world: World, task: TaskId, cold: number, swing: number, airdry: number, ice: number) {
  if (task === "ice" || task === "polar") return 0.6 * cold + 0.4 * ice;
  return world === "moon" ? 0.55 * cold + 0.45 * swing : 0.45 * cold + 0.3 * swing + 0.25 * airdry;
}

export function topoSimilarity(hist: ArrayLike<number>, relief: number, t: GridTarget) {
  let overlap = 0;
  for (let b = 0; b < 8; b++) overlap += Math.min(hist[b], t.terrain.hist[b]);
  const ratio = Math.max(relief, 1) / Math.max(t.terrain.relief, 1);
  const rel = Math.min(1, Math.max(0, 1 - Math.abs(Math.log10(ratio))));
  return 0.65 * overlap + 0.35 * rel;
}

export interface ScoreOptions {
  target: GridTarget;
  task: TaskId;
  weights?: Weights;
  /** 0 = only the mission formula, 1 = only the learned model. */
  modelMix?: number;
  /** Neural ground-shape similarity for this target (one byte per cell), if loaded. */
  shape?: Uint8Array | null;
  /** Share of the ground-shape score taken from the neural network (0 to 1). */
  shapeMix?: number;
}

export interface CellScore {
  total: number;
  mission: number;
  model: number;
  dims: Record<Dim, number>;
  /** Ground shape from the hand-made formula and from the neural network (null if not loaded). */
  formula: number;
  neural: number | null;
}

/** Full breakdown for one cell. */
export function scoreCell(g: Grid, k: number, o: ScoreOptions): CellScore {
  const w = o.weights ?? TASK_WEIGHTS[o.task];
  const world = o.target.body;
  const I = (n: Indicator) => g.ind(n, k);
  const formula = topoSimilarity(g.hist(k), g.value("f_relief", k) ?? 0, o.target);
  const sm = o.shape ? (o.shapeMix ?? 0.5) : 0;
  const neural = o.shape ? o.shape[k] / 254 : null;
  const dims: Record<Dim, number> = {
    topography: neural === null ? formula : (1 - sm) * formula + sm * neural,
    geology: geology(world, o.task, I("volcanic"), I("impact"), I("bare"), I("dry")),
    temperature: temperature(world, o.task, I("cold"), I("swing"), I("airdry"), I("ice")),
    lighting: o.target.light[g.row[k]] / 100,
    regolith: 0.6 * I("bare") + 0.4 * I("dry"),
  };
  let s = 0;
  let ws = 0;
  for (const d of DIMS) {
    s += dims[d] * w[d];
    ws += w[d];
  }
  const mission = ws ? s / ws : 0;
  const model = g.model(world, k);
  const m = o.modelMix ?? 0.3;
  return { total: (1 - m) * mission + m * model, mission, model, dims, formula, neural };
}

/** Scores for every land cell (fast typed-array loop). */
export function scoreAll(g: Grid, o: ScoreOptions): Float32Array {
  const w = o.weights ?? TASK_WEIGHTS[o.task];
  const world = o.target.body;
  const ws = DIMS.reduce((a, d) => a + w[d], 0) || 1;
  const m = o.modelMix ?? 0.3;
  const A = (n: string) => g.arr(n);
  const [volc, imp, bare, dry, cold, swing, airdry, ice] = (["volcanic", "impact", "bare", "dry", "cold", "swing", "airdry", "ice"] as const).map((n) => A(`i_${n}`));
  const H = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => A(`h${b}`));
  const relief = A("f_relief");
  const reliefNod = 65535;
  const model = A(`model_${world}`);
  const MK = 1 / g.scale(`model_${world}`);
  const th = o.target.terrain.hist;
  const tRel = Math.max(o.target.terrain.relief, 1);
  const light = o.target.light;
  const shape = o.shape ?? null;
  const sm = shape ? (o.shapeMix ?? 0.5) : 0;
  const out = new Float32Array(g.n);
  const K = 1 / 254;
  for (let k = 0; k < g.n; k++) {
    let ov = 0;
    for (let b = 0; b < 8; b++) ov += Math.min(H[b][k] * K, th[b]);
    const r = relief[k] === reliefNod ? 1 : Math.max(relief[k], 1);
    const rel = Math.min(1, Math.max(0, 1 - Math.abs(Math.log10(r / tRel))));
    const topo = shape ? (1 - sm) * (0.65 * ov + 0.35 * rel) + sm * shape[k] * K : 0.65 * ov + 0.35 * rel;
    const geo = geology(world, o.task, volc[k] * K, imp[k] * K, bare[k] * K, dry[k] * K);
    const tem = temperature(world, o.task, cold[k] * K, swing[k] * K, airdry[k] * K, ice[k] * K);
    const lit = light[g.row[k]] / 100;
    const reg = 0.6 * bare[k] * K + 0.4 * dry[k] * K;
    const mission = (topo * w.topography + geo * w.geology + tem * w.temperature + lit * w.lighting + reg * w.regolith) / ws;
    out[k] = (1 - m) * mission + m * model[k] * MK;
  }
  return out;
}

/* ------------------------------------------------------------------ ranking */

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Candidate {
  k: number;
  lat: number;
  lon: number;
  score: number;
  /** A known test site within 150 km, if any. */
  known: KnownSite | null;
  knownKm: number;
}

export interface RankOptions {
  count?: number;
  spacingKm?: number;
  onlyNew?: boolean;
  skipAntarctica?: boolean;
  /** Keep only cells in this country / region (name tables index), if set. */
  within?: { field: "n_country" | "n_region"; value: number } | null;
}

export function nearestKnown(g: Grid, lat: number, lon: number) {
  let best: KnownSite | null = null;
  let bd = Infinity;
  for (const s of g.meta.known) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return { site: best, km: bd };
}

/** Best distinct places: highest scores, at least `spacingKm` apart. */
export function rankPlaces(g: Grid, scores: Float32Array, o: RankOptions = {}): Candidate[] {
  const count = o.count ?? 12;
  const spacing = o.spacingKm ?? 400;
  const idx: number[] = [];
  // a cheap pre-filter: only the top ~4% can make the list
  const sample = Array.from(scores).filter((_, i) => i % 7 === 0).sort((a, b) => b - a);
  const cut = sample[Math.floor(sample.length * 0.04)] ?? 0;
  const within = o.within ? g.arr(o.within.field) : null;
  for (let k = 0; k < g.n; k++) {
    if (!within && scores[k] < cut) continue;
    if (within && within[k] !== o.within!.value) continue;
    if (o.skipAntarctica && g.lat(k) < -60) continue;
    idx.push(k);
  }
  idx.sort((a, b) => scores[b] - scores[a]);
  const out: Candidate[] = [];
  for (const k of idx) {
    const lat = g.lat(k);
    const lon = g.lon(k);
    if (out.some((c) => haversineKm(lat, lon, c.lat, c.lon) < spacing)) continue;
    const nk = nearestKnown(g, lat, lon);
    const known = nk.km < 150 ? nk.site : null;
    if (o.onlyNew && known) continue;
    out.push({ k, lat, lon, score: scores[k], known, knownKm: nk.km });
    if (out.length >= count) break;
  }
  return out;
}

/** Percentile (0 to 1) of a value among all land cells. */
export function percentileOf(scores: Float32Array, v: number) {
  let below = 0;
  for (let k = 0; k < scores.length; k++) if (scores[k] < v) below++;
  return below / scores.length;
}

/* ------------------------------------------------------------------ search */

export interface SearchHit {
  kind: "place" | "region" | "country" | "known";
  label: string;
  sub: string;
  lat?: number;
  lon?: number;
  field?: "n_country" | "n_region";
  value?: number;
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function searchGrid(g: Grid, q: string, limit = 8): SearchHit[] {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  const hits: (SearchHit & { rank: number })[] = [];
  const score = (name: string) => {
    const x = norm(name);
    if (x === n) return 0;
    if (x.startsWith(n)) return 1;
    if (x.includes(` ${n}`)) return 2;
    if (x.includes(n)) return 3;
    return -1;
  };
  g.meta.known.forEach((s) => {
    const r = score(s.name);
    if (r >= 0) hits.push({ kind: "known", label: s.name, sub: "Known test site", lat: s.lat, lon: s.lon, rank: r - 0.5 });
  });
  g.meta.names.country.forEach((c, i) => {
    const r = score(c);
    if (r >= 0) hits.push({ kind: "country", label: c, sub: "Country · best spot inside", field: "n_country", value: i, rank: r });
  });
  g.meta.names.region.forEach((c, i) => {
    const r = score(c);
    if (r >= 0) hits.push({ kind: "region", label: c, sub: "Region · best spot inside", field: "n_region", value: i, rank: r + 0.2 });
  });
  const ll = g.meta.names.place_ll;
  if (ll)
    g.meta.names.place.forEach((p, i) => {
      const r = score(p);
      if (r >= 0) hits.push({ kind: "place", label: p, sub: "City or town", lat: ll[i][0], lon: ll[i][1], rank: r + 0.4 });
    });
  return hits.sort((a, b) => a.rank - b.rank || a.label.length - b.label.length).slice(0, limit);
}

/* ------------------------------------------------------------------ colour */

/** Warm sunlight ramp used for every score map (transparent → ember → flare → bone). */
const STOPS: [number, [number, number, number]][] = [
  [0, [60, 26, 18]],
  [0.35, [150, 62, 34]],
  [0.65, [224, 138, 95]],
  [0.85, [242, 200, 121]],
  [1, [255, 246, 226]],
];

export function ramp(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const f = (x - a) / (b - a);
      return [0, 1, 2].map((j) => Math.round(ca[j] + (cb[j] - ca[j]) * f)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export const RAMP_CSS = `linear-gradient(90deg, ${STOPS.map(([p, c]) => `rgb(${c.join(",")}) ${p * 100}%`).join(", ")})`;

/** Low and high display limits so the map always shows contrast. */
export function displayRange(scores: Float32Array) {
  const s = Array.from(scores).filter((_, i) => i % 5 === 0).sort((a, b) => a - b);
  return { lo: s[Math.floor(s.length * 0.55)], hi: s[Math.floor(s.length * 0.997)] };
}

/** Paint scores into an equirectangular RGBA canvas (cols × rows). */
export function paintScores(g: Grid, scores: Float32Array, canvas: HTMLCanvasElement, range = displayRange(scores)) {
  const { rows, cols } = g.meta;
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(cols, rows);
  const span = Math.max(1e-6, range.hi - range.lo);
  for (let k = 0; k < g.n; k++) {
    const t = (scores[k] - range.lo) / span;
    if (t <= 0) continue;
    const [r, gg, b] = ramp(t);
    const p = (g.row[k] * cols + g.col[k]) * 4;
    img.data[p] = r;
    img.data[p + 1] = gg;
    img.data[p + 2] = b;
    img.data[p + 3] = Math.round(255 * Math.min(1, 0.25 + 0.75 * t));
  }
  ctx.putImageData(img, 0, 0);
  return range;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------------ neural ground shape */

export interface ShapeEval {
  pairs: number;
  learned_median_top_pct: number;
  formula_median_top_pct: number;
  both_median_top_pct: number;
  learned_top20_pct: number;
  formula_top20_pct: number;
  epochs: number;
}

export interface ShapeData {
  ids: string[];
  n: number;
  data: Uint8Array;
  eval: ShapeEval;
  /** The similarity row for one target, or null if that target has none. */
  row: (targetId: string) => Uint8Array | null;
}

let shapeCache: Promise<ShapeData> | null = null;

/** Similarity of every land cell to every target, from our terrain encoder (loaded on demand). */
export function loadShape(): Promise<ShapeData> {
  if (!shapeCache) {
    shapeCache = (async () => {
      const meta = await (await fetch("/data/shape.json")).json();
      const data = new Uint8Array(await (await fetch("/data/shape.bin")).arrayBuffer());
      const ids: string[] = meta.targets;
      const n: number = meta.count;
      return { ids, n, data, eval: meta.eval, row: (id: string) => (ids.includes(id) ? data.subarray(ids.indexOf(id) * n, (ids.indexOf(id) + 1) * n) : null) };
    })();
    shapeCache.catch(() => {
      shapeCache = null;
    });
  }
  return shapeCache;
}

export function useShape(enabled: boolean) {
  const [shape, setShape] = useState<ShapeData | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadShape()
      .then((s) => alive && setShape(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? shape : null;
}
