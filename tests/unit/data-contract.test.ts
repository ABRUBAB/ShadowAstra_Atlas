/** The data files the website ships must match what the code expects (pipeline/s06, s14, s15, s19). */
import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MINERAL_FAMILIES, checkGrid, type GridMeta } from "../../src/lib/grid";
import { TARGETS } from "../../src/data/sites";
import type { Validation } from "../../src/lib/validation";
import { DATA, loadGrid, readArrayBuffer, readJson } from "./helpers";

const meta = readJson<GridMeta>(`${DATA}grid.json`);
const buf = readArrayBuffer(`${DATA}grid.bin`);

describe("grid.json and grid.bin", () => {
  it("pass the browser's own contract check", () => {
    expect(() => checkGrid(meta, buf)).not.toThrow();
  });

  it("refuse a truncated or mismatched file", () => {
    expect(() => checkGrid(meta, buf.slice(0, buf.byteLength - 10))).toThrow();
    expect(() => checkGrid({ ...meta, layout: [...meta.layout, { name: "x", dtype: "uint16", offset: buf.byteLength, scale: 1, nodata: 0, kind: "value" }] }, buf)).toThrow();
  });

  it("hold one cell per set bit of the land mask", () => {
    const mask = new Uint8Array(buf, 0, meta.mask_bytes);
    let bits = 0;
    for (const b of mask) for (let i = 0; i < 8; i++) bits += (b >> i) & 1;
    expect(bits).toBe(meta.count);
    expect(meta.count).toBe(80206);
  });

  it("describe every target the site lists, with sane terrain", () => {
    expect(meta.targets.map((t) => t.id).sort()).toEqual(TARGETS.map((t) => t.id).sort());
    for (const t of meta.targets) {
      expect(t.terrain.hist).toHaveLength(8);
      expect(t.terrain.hist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
      expect(t.light).toHaveLength(meta.rows);
      expect(t.terrain.relief).toBeGreaterThan(0);
    }
  });

  it("keep model ranks, indicators and minerals in range", () => {
    const g = loadGrid();
    for (const k of [0, 1000, 40000, g.n - 1]) {
      for (const w of ["moon", "mars"] as const) {
        expect(g.model(w, k)).toBeGreaterThanOrEqual(0);
        expect(g.model(w, k)).toBeLessThanOrEqual(1.0001);
      }
      expect(g.lat(k)).toBeGreaterThanOrEqual(-90);
      expect(g.lat(k)).toBeLessThanOrEqual(90);
      const m = g.minerals(k);
      if (m) for (const f of MINERAL_FAMILIES) expect(m[f]).toBeGreaterThanOrEqual(0);
    }
    let seen = 0;
    for (let k = 0; k < g.n; k++) if (g.minerals(k)) seen++;
    expect(seen).toBeGreaterThan(15000);
    expect(seen).toBeLessThan(20000);
  });
});

describe("other data files", () => {
  it("shape.bin holds one rank per cell per target", () => {
    const s = readJson<{ targets: string[]; count: number }>(`${DATA}shape.json`);
    expect(s.count).toBe(meta.count);
    expect(statSync(`${DATA}shape.bin`).size).toBe(s.targets.length * s.count);
  });

  it("terrain bands have the documented sizes", () => {
    const man = readJson<{ bands: number; ai_twins: { bands: number; rows_per_band: number; cols: number; per_cell: number } }>(`${DATA}terrain/manifest.json`);
    for (const body of ["moon", "mars"]) {
      for (let b = 0; b < man.bands; b++) expect(statSync(`${DATA}terrain/${body}/b${String(b).padStart(2, "0")}.bin`).size).toBe(7200 * 8 + 7200 * 2 + 7200);
      const tw = man.ai_twins;
      for (let b = 0; b < tw.bands; b++) expect(statSync(`${DATA}terrain/${body}/t${String(b).padStart(2, "0")}.bin`).size).toBe(tw.rows_per_band * tw.cols * tw.per_cell * 4);
    }
  });

  it("validation.json carries every section the How it works page reads", () => {
    const v = readJson<Validation>(`${DATA}validation.json`);
    expect(v.cells).toBe(meta.count);
    expect(v.independent.sites).toHaveLength(28);
    for (const key of ["known", "jobs", "mixing", "robustness", "ablation", "model_zoo", "minerals", "terrain_ai"] as const) expect(v[key]).toBeTruthy();
    expect(v.mixing!.curve.some((c) => Math.abs(c.mix - 0.6) < 1e-9)).toBe(true);
    expect(v.minerals!.shipped).toBe(false);
  });
});
