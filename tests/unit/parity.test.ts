/**
 * The browser (src/lib/grid.ts) and the NumPy twin used for every published test
 * (pipeline/s14_validate.py) must give the same scores. tests/fixtures/parity.json holds what
 * Python computes (pipeline/s22_parity_fixture.py); here TypeScript recomputes it.
 */
import { describe, expect, it } from "vitest";
import { DIMS, MINERAL_FAMILIES, MODEL_MIX, USE_MINERALS, scoreAll, scoreCell } from "../../src/lib/grid";
import { TASK_WEIGHTS, type Weights } from "../../src/lib/scoring";
import type { TaskId } from "../../src/data/sites";
import { DATA, ROOT, loadGrid, readArrayBuffer, readJson } from "./helpers";

interface Fixture {
  mix: number;
  use_minerals: boolean;
  dims: string[];
  cells: number[];
  combos: { target: string; job: TaskId; shape: "formula" | "both" | "learned"; weights: Weights | null; values: Record<string, number[]> }[];
  mineral_pct: Record<string, Record<string, number | null>>;
  confidence: Record<"moon" | "mars", Record<string, string>>;
}

const fx = readJson<Fixture>(`${ROOT}tests/fixtures/parity.json`);
const g = loadGrid();
const shapeMeta = readJson<{ targets: string[]; count: number }>(`${DATA}shape.json`);
const shapeBin = new Uint8Array(readArrayBuffer(`${DATA}shape.bin`));
const shapeRow = (id: string) => shapeBin.subarray(shapeMeta.targets.indexOf(id) * shapeMeta.count, (shapeMeta.targets.indexOf(id) + 1) * shapeMeta.count);
const TOL = 2e-4;

describe("TypeScript and Python agree", () => {
  it("use the same settings", () => {
    expect(fx.mix).toBe(MODEL_MIX);
    expect(fx.use_minerals).toBe(USE_MINERALS);
    expect(fx.dims).toEqual(DIMS);
  });

  for (const c of fx.combos) {
    const label = `${c.target} · ${c.job} · ground shape ${c.shape}${c.weights ? " · custom weights" : ""}`;
    it(label, () => {
      const target = g.targets[c.target];
      const opts = {
        target,
        task: c.job,
        weights: c.weights ?? TASK_WEIGHTS[c.job],
        modelMix: MODEL_MIX,
        ...(c.shape === "formula" ? {} : { shape: shapeRow(c.target), shapeMix: c.shape === "learned" ? 1 : 0.5 }),
      };
      const all = scoreAll(g, opts);
      let worst = 0;
      for (const [cell, v] of Object.entries(c.values)) {
        const k = Number(cell);
        const one = scoreCell(g, k, opts);
        worst = Math.max(worst, Math.abs(all[k] - v[0]), Math.abs(one.total - v[0]), Math.abs(one.mission - v[1]));
        DIMS.forEach((d, i) => (worst = Math.max(worst, Math.abs(one.dims[d] - v[2 + i]))));
      }
      expect(worst).toBeLessThan(TOL);
    });
  }

  it("rank EMIT minerals the same way, ties included", () => {
    for (const f of MINERAL_FAMILIES) {
      const pct = g.mineralPct(f);
      for (const [cell, want] of Object.entries(fx.mineral_pct[f])) {
        const got = pct[Number(cell)];
        if (want === null) expect(Number.isNaN(got)).toBe(true);
        else expect(Math.abs(got - want)).toBeLessThan(1e-5);
      }
    }
  });

  it("give every place the same confidence level", () => {
    for (const w of ["moon", "mars"] as const)
      for (const [cell, level] of Object.entries(fx.confidence[w])) expect(g.confidence(Number(cell), w).level).toBe(level);
  });
});
