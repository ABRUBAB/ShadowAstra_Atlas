/**
 * Percentile rank (0 to 1) of every value, ties in index order: exactly what sorting the indices
 * with a stable comparator gives (see tests/unit/rank.test.ts), but much faster. Each value's
 * 32-bit float pattern, turned so that unsigned order is number order, is packed with its index
 * into one integer (32 + 17 bits, exact in a double) and sorted natively, instead of calling a
 * JavaScript comparator about 1.3 million times for 80,206 places.
 */
export function percentileRank(a: ArrayLike<number>): Float32Array {
  const n = a.length;
  const out = new Float32Array(n);
  if (n < 2) return out;
  const f = Float32Array.from(a);
  const SHIFT = 2 ** 17;
  if (n >= SHIFT) {
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((x, y) => f[x] - f[y]);
    for (let r = 0; r < n; r++) out[idx[r]] = r / (n - 1);
    return out;
  }
  for (let i = 0; i < n; i++) if (f[i] === 0) f[i] = 0; // -0 and +0 tie, as they compare equal
  const bits = new Uint32Array(f.buffer);
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u = bits[i];
    const ord = u & 0x80000000 ? ~u >>> 0 : (u | 0x80000000) >>> 0;
    keys[i] = ord * SHIFT + i;
  }
  keys.sort();
  for (let r = 0; r < n; r++) out[keys[r] % SHIFT] = r / (n - 1);
  return out;
}
