/**
 * The browser pinpoint (src/lib/pinpoint.ts) and its Python twin (pipeline/s23_pinpoint.py, which
 * produced the published test) score the same 10 km windows on the same heights.
 */
import { describe, expect, it } from "vitest";
import { PIN, pinpointWindows } from "../../src/lib/pinpoint";
import { ROOT, readJson } from "./helpers";

interface Fixture {
  win: number;
  stride: number;
  half: number;
  max_water: number;
  sites: { id: string; n: number; step: number; target_hist: number[]; heights: number[][]; water: number[] | null; windows: number[][] }[];
}

const fx = readJson<Fixture>(`${ROOT}tests/fixtures/pinpoint.json`);

describe("pinpoint: TypeScript and Python agree", () => {
  it("use the same window settings", () => {
    expect(fx.win).toBe(PIN.win);
    expect(fx.stride).toBe(PIN.stride);
    expect(fx.half).toBe(PIN.half);
    expect(fx.max_water).toBe(PIN.maxWater);
    expect(fx.sites.some((s) => s.water?.some((w) => w === 1))).toBe(true); // the water rule is exercised
    expect(fx.sites.length).toBeGreaterThanOrEqual(2);
    for (const s of fx.sites) {
      expect(s.n).toBe(PIN.n);
      expect(s.step).toBeCloseTo(PIN.step, 9);
    }
  });

  for (const s of fx.sites)
    it(`score every window around ${s.id} the same way`, () => {
      const ws = pinpointWindows(Float64Array.from(s.heights.flat()), s.n, s.step, s.target_hist, { water: s.water });
      expect(ws.length).toBe(s.windows.length);
      ws.forEach((w, i) => {
        const [x, y, score, meanSlope, relief] = s.windows[i];
        expect(w.x).toBeCloseTo(x, 5);
        expect(w.y).toBeCloseTo(y, 5);
        expect(Math.abs(w.score - score)).toBeLessThan(1e-6);
        expect(Math.abs(w.meanSlope - meanSlope)).toBeLessThan(1e-4);
        expect(Math.abs(w.relief - relief)).toBeLessThan(1e-3);
      });
      // and both pick the same best window
      const best = (xs: number[]) => xs.indexOf(Math.max(...xs));
      expect(best(ws.map((w) => w.score))).toBe(best(s.windows.map((w) => w[2])));
    });

  it("finds a known best window on made-up ground", () => {
    // flat everywhere except a 12 km square of steady 7° slope in the north-east
    const n = PIN.n;
    const h = new Float64Array(n * n);
    const rise = Math.tan((7 * Math.PI) / 180) * PIN.step * 1000;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (j < 18 && i > 30) h[j * n + i] = (i - 30) * rise;
    const target = [0, 0, 0, 0, 1, 0, 0, 0]; // everything between 6° and 10°
    const ws = pinpointWindows(h, n, PIN.step, target);
    const top = ws.reduce((a, b) => (b.score > a.score ? b : a));
    expect(top.score).toBeGreaterThan(0.9);
    expect(top.x).toBeGreaterThan(0);
    expect(top.y).toBeGreaterThan(0);
  });
});
