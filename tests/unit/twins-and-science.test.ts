/**
 * Earth twins and scientific regression checks on real places. These numbers are allowed to
 * change only on purpose: after a data or model change, rerun the tests and update the bounds
 * together with docs/ENGINEERING.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { haversineKm, percentileOf, rankPlaces, scoreAll } from "../../src/lib/grid";
import { aiTwins, findTwins, spotTerrain } from "../../src/lib/twins";
import { TASK_WEIGHTS } from "../../src/lib/scoring";
import type { TaskId } from "../../src/data/sites";
import { ROOT, diskFetch, loadGrid } from "./helpers";

const g = loadGrid();

beforeAll(() => vi.stubGlobal("fetch", diskFetch));
afterAll(() => vi.unstubAllGlobals());

describe("Earth twins of a Moon or Mars spot", () => {
  it("reads Jezero's ground from the Mars band files", async () => {
    const t = await spotTerrain("mars", 18.4, 77.6);
    expect(t.hist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
    expect(t.relief).toBeGreaterThan(300);
    expect(t.relief).toBeLessThan(3000);
  });

  it("formula twins: eight places, 400 km apart", async () => {
    const t = await spotTerrain("mars", 18.4, 77.6);
    const tw = findTwins(g, t, 8, true);
    expect(tw).toHaveLength(8);
    for (const a of tw) for (const b of tw) if (a !== b) expect(haversineKm(a.lat, a.lon, b.lat, b.lon)).toBeGreaterThanOrEqual(400);
  });

  it("AI twins: eight places, best agreement first, valid cells", async () => {
    const tw = await aiTwins(g, "mars", 18.4, 77.6, 8);
    expect(tw).toHaveLength(8);
    expect(tw[0].score).toBe(1);
    for (let i = 1; i < tw.length; i++) expect(tw[i - 1].score).toBeGreaterThanOrEqual(tw[i].score);
    for (const c of tw) expect(c.k).toBeLessThan(g.n);
  });

  it("AI twins work at the poles and across the date line", async () => {
    for (const [lat, lon] of [[89.9, 0], [-89.9, 179.9], [0, -180], [0, 179.99]]) expect((await aiTwins(g, "moon", lat, lon, 5)).length).toBeGreaterThan(0);
  });
});

describe("scientific regression on known sites", () => {
  const S = (target: string, task: TaskId) => scoreAll(g, { target: g.targets[target], task, weights: TASK_WEIGHTS[task] });
  const topPct = (s: Float32Array, lat: number, lon: number) => 100 * (1 - percentileOf(s, s[g.cellAt(lat, lon)]));

  it("famous analogs rank near the top for the job they are used for", () => {
    // the learned model has seen these sites, so this checks the shipped score end to end, not generalisation
    expect(topPct(S("gale", "traverse"), -24.08, -70.0)).toBeLessThan(2); // Atacama for a Gale rover drive
    expect(topPct(S("shackleton", "polar"), -77.5, 161.8)).toBeLessThan(5); // Dry Valleys for low Sun and cold
    expect(topPct(S("marius-pit", "caves"), 41.71, -121.5)).toBeLessThan(5); // Lava Beds for lava tubes
  });

  it("a wet, green megacity does not", () => {
    expect(topPct(S("jezero", "astrobio"), 23.81, 90.41)).toBeGreaterThan(50); // Dhaka
  });

  it("the top ten for a Jezero life search stay stable", () => {
    const top = rankPlaces(g, S("jezero", "astrobio"), { count: 10, spacingKm: 300, onlyNew: true });
    const file = `${ROOT}tests/fixtures/regression.json`;
    // UPDATE_REGRESSION=1 npx vitest run  rewrites the snapshot after an intended data or model change
    if (process.env.UPDATE_REGRESSION === "1") writeFileSync(file, JSON.stringify({ note: "Top 10 new places for a Jezero life search (v0.6)", jezero_astrobio_top10: top.map((c) => [c.lat, c.lon]) }, null, 1));
    const snap = JSON.parse(readFileSync(file, "utf-8")) as { jezero_astrobio_top10: [number, number][] };
    const same = top.filter((c) => snap.jezero_astrobio_top10.some(([la, lo]) => haversineKm(la, lo, c.lat, c.lon) < 150)).length;
    expect(same).toBeGreaterThanOrEqual(8);
  });
});
