/** The fast percentile rank gives exactly what the old stable comparator sort gave. */
import { describe, expect, it } from "vitest";
import { percentileRank } from "../../src/lib/rank";
import { loadGrid } from "./helpers";

function slow(a: ArrayLike<number>) {
  const n = a.length;
  const v = Float32Array.from(a);
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((x, y) => v[x] - v[y]);
  const out = new Float32Array(n);
  for (let r = 0; r < n; r++) out[idx[r]] = r / (n - 1);
  return out;
}

describe("percentileRank", () => {
  it("matches the comparator sort on random values with many ties, negatives and zeros", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const a = Array.from({ length: 5000 }, (_, i) => (i % 7 === 0 ? 0 : i % 5 === 0 ? -0 : Math.round((rnd() - 0.3) * 40) / 8));
    expect(Array.from(percentileRank(a))).toEqual(Array.from(slow(a)));
  });

  it("matches it on the real learned-model ranks of all 80,206 places", () => {
    const g = loadGrid();
    const m = g.arr("model_mars");
    expect(Array.from(percentileRank(m))).toEqual(Array.from(slow(m)));
  });
});
