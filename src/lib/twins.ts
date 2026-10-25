/**
 * Earth twins for any spot on the Moon or Mars.
 *
 * Kaggle K1 measured every 0.5° cell of the Moon (LOLA 118 m) and Mars (MOLA 463 m) with the
 * Earth method (pipeline/s15_planet_grids.py). The browser downloads only the 5° band you
 * click, then compares that spot's ground with all 80,206 places on Earth using the same
 * ground-shape formula as the rest of the site.
 */
import { haversineKm, nearestKnown, rankPlaces, type Candidate, type Grid } from "./grid";

export interface SpotTerrain {
  body: "moon" | "mars";
  lat: number;
  lon: number;
  hist: number[];
  relief: number;
  slope: number;
}

const COLS = 720;
const ROWS = 10;
const N = COLS * ROWS;
const bands = new Map<string, Promise<ArrayBuffer>>();

function band(body: string, b: number) {
  const key = `${body}/${b}`;
  let p = bands.get(key);
  if (!p) {
    p = fetch(`/data/terrain/${body}/b${String(b).padStart(2, "0")}.bin`).then((r) => {
      if (!r.ok) throw new Error(`terrain band ${key}: ${r.status}`);
      return r.arrayBuffer();
    });
    p.catch(() => bands.delete(key));
    bands.set(key, p);
  }
  return p;
}

/** Ground statistics of the 0.5° cell around a spot. */
export async function spotTerrain(body: "moon" | "mars", lat: number, lon: number): Promise<SpotTerrain> {
  const row = Math.min(359, Math.max(0, Math.floor((90 - lat) / 0.5)));
  const col = ((Math.floor((lon + 180) / 0.5) % COLS) + COLS) % COLS;
  const buf = await band(body, Math.floor(row / ROWS));
  const i = (row % ROWS) * COLS + col;
  const u8 = new Uint8Array(buf);
  const hist = Array.from(u8.subarray(i * 8, i * 8 + 8), (x) => x / 254);
  const relief = new DataView(buf).getUint16(N * 8 + i * 2, true);
  const slope = u8[N * 10 + i] / 8;
  return { body, lat, lon, hist, relief, slope };
}

/** Ground-shape similarity of every Earth place to the spot (same formula as the site). */
export function twinScores(g: Grid, s: SpotTerrain): Float32Array {
  const H = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => g.arr(`h${b}`));
  const rel = g.arr("f_relief");
  const tRel = Math.max(s.relief, 1);
  const out = new Float32Array(g.n);
  const K = 1 / 254;
  for (let k = 0; k < g.n; k++) {
    let ov = 0;
    for (let b = 0; b < 8; b++) ov += Math.min(H[b][k] * K, s.hist[b]);
    const r = rel[k] === 65535 ? 1 : Math.max(rel[k], 1);
    out[k] = 0.65 * ov + 0.35 * Math.min(1, Math.max(0, 1 - Math.abs(Math.log10(r / tRel))));
  }
  return out;
}

/** Best Earth places: ground shape alone, or mixed half and half with how Moon- or Mars-like the place is (learned model). */
export function findTwins(g: Grid, s: SpotTerrain, count = 8, alsoLike = true): Candidate[] {
  const shape = twinScores(g, s);
  if (alsoLike) {
    // same as g.model(s.body, k), with the column looked up once instead of 80,206 times
    const model = g.arr(`model_${s.body}`);
    const scale = g.scale(`model_${s.body}`);
    for (let k = 0; k < g.n; k++) shape[k] = 0.5 * shape[k] + 0.5 * (model[k] / scale);
  }
  return rankPlaces(g, shape, { count, spacingKm: 400 });
}

/* ------------------------------------------------------------------ AI twins (Kaggle K3) */

const AI_COLS = 360;
const AI_ROWS = 10;
const AI_PER = 5;
const aiBands = new Map<string, Promise<Uint32Array>>();

function aiBand(body: string, b: number) {
  const key = `${body}/${b}`;
  let p = aiBands.get(key);
  if (!p) {
    p = fetch(`/data/terrain/${body}/t${String(b).padStart(2, "0")}.bin`).then(async (r) => {
      if (!r.ok) throw new Error(`AI twin band ${key}: ${r.status}`);
      return new Uint32Array(await r.arrayBuffer());
    });
    p.catch(() => aiBands.delete(key));
    aiBands.set(key, p);
  }
  return p;
}

/**
 * Earth twins from the K3 terrain transformer: the five closest Earth places for every 1° cell,
 * found by comparing learned descriptions of the ground. Votes over the tapped cell and its eight
 * neighbours (closer ranks and the centre count more), then keeps places at least 400 km apart.
 * `score` is the share of the best place's votes (agreement, not similarity).
 */
export async function aiTwins(g: Grid, body: "moon" | "mars", lat: number, lon: number, count = 8): Promise<Candidate[]> {
  const r0 = Math.min(179, Math.max(0, Math.floor(90 - lat)));
  const c0 = ((Math.floor(lon + 180) % AI_COLS) + AI_COLS) % AI_COLS;
  const votes = new Map<number, number>();
  for (let dr = -1; dr <= 1; dr++) {
    const r = r0 + dr;
    if (r < 0 || r > 179) continue;
    const band = await aiBand(body, Math.floor(r / AI_ROWS));
    for (let dc = -1; dc <= 1; dc++) {
      const c = (c0 + dc + AI_COLS) % AI_COLS;
      const at = ((r % AI_ROWS) * AI_COLS + c) * AI_PER;
      const w = dr === 0 && dc === 0 ? 2 : 1;
      for (let j = 0; j < AI_PER; j++) {
        const k = band[at + j];
        if (k < g.n) votes.set(k, (votes.get(k) ?? 0) + w * (AI_PER - j));
      }
    }
  }
  const order = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const top = order[0]?.[1] ?? 1;
  const out: Candidate[] = [];
  for (const [k, v] of order) {
    const la = g.lat(k);
    const lo = g.lon(k);
    if (out.some((c) => haversineKm(la, lo, c.lat, c.lon) < 400)) continue;
    const nk = nearestKnown(g, la, lo);
    out.push({ k, lat: la, lon: lo, score: v / top, known: nk.km < 150 ? nk.site : null, knownKm: nk.km });
    if (out.length >= count) break;
  }
  return out;
}
