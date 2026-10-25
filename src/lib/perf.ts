/**
 * Timings of the operations that decide how responsive the Atlas feels. Each call to timed()
 * keeps its duration (milliseconds, performance.now(), main thread, so it includes nothing but
 * the work itself: no network) in a small ring per operation. The benchmarks in tests/perf read
 * them from window.__atlasPerf; in DevTools they also show as User Timing measures.
 *
 *   grid-download   fetch grid.json + grid.bin (network, cache-dependent)
 *   grid-parse      typed-array views and the land index for 80,206 cells
 *   score-all       one score for every land cell (scoreAll)
 *   search          score + needs screening + ranking for the mission builder (runSearch)
 */
const KEEP = 400;
const rings: Record<string, number[]> = {};

declare global {
  interface Window {
    __atlasPerf?: Record<string, number[]>;
  }
}

export function record(name: string, ms: number) {
  const r = (rings[name] ??= []);
  r.push(ms);
  if (r.length > KEEP) r.shift();
  if (typeof window !== "undefined") window.__atlasPerf = rings;
}

export function timed<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    const t1 = performance.now();
    record(name, t1 - t0);
    if (name !== "score-all") {
      try {
        performance.measure(`atlas:${name}`, { start: t0, end: t1 });
      } catch {
        /* User Timing L3 missing: the ring still has it */
      }
    }
  }
}

export async function timedAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const t1 = performance.now();
    record(name, t1 - t0);
    try {
      performance.measure(`atlas:${name}`, { start: t0, end: t1 });
    } catch {
      /* ignore */
    }
  }
}
