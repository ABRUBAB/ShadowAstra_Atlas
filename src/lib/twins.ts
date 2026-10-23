/**
 * Earth twins for any spot on the Moon or Mars.
 *
 * Kaggle K1 measured every 0.5° cell of the Moon (LOLA 118 m) and Mars (MOLA 463 m) with the
 * Earth method (pipeline/s15_planet_grids.py). The browser downloads only the 5° band you
 * click, then compares that spot's ground with all 80,206 places on Earth using the same
 * ground-shape formula as the rest of the site.
 */
import { rankPlaces, type Candidate, type Grid } from "./grid";

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
  if (alsoLike) for (let k = 0; k < g.n; k++) shape[k] = 0.5 * shape[k] + 0.5 * g.model(s.body, k);
  return rankPlaces(g, shape, { count, spacingKm: 400 });
}
