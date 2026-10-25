/** Mission links, the needs screen, the search and the ranking rules. */
import { describe, expect, it } from "vitest";
import { haversineKm, nearestKnown, rankPlaces, scoreAll } from "../../src/lib/grid";
import { DHAKA, defaultMission, homeKm, knownKm, runSearch, screen } from "../../src/lib/mission";
import { readMission, writeMission } from "../../src/lib/missionUrl";
import { TASK_WEIGHTS } from "../../src/lib/scoring";
import { loadGrid } from "./helpers";

const g = loadGrid();

describe("mission links", () => {
  it("survive a round trip", () => {
    const m = { ...defaultMission("gale", "traverse"), maxKm: 2000, townKm: 100, maxElev: 4000, month: 6, skipAntarctica: true, onlyNew: false, modelMix: 0.9, shape: "ai" as const, home: { name: "Lima", lat: -12.05, lon: -77.04 } };
    const back = readMission(new URLSearchParams(writeMission(m, "results", [21.25, 17.75])));
    expect(back.step).toBe("results");
    expect(back.at).toEqual([21.25, 17.75]);
    expect(back.m).toMatchObject({ target: "gale", task: "traverse", maxKm: 2000, townKm: 100, maxElev: 4000, month: 6, skipAntarctica: true, onlyNew: false, modelMix: 0.9, shape: "ai" });
    expect(back.m.home).toEqual({ name: "Lima", lat: -12.05, lon: -77.04 });
  });

  it("keep the defaults out of the address", () => {
    expect(writeMission(defaultMission("jezero", "astrobio"), "start", null)).toEqual({ step: "start", target: "jezero", task: "astrobio" });
  });

  it("fall back to safe defaults for anything broken or out of range", () => {
    const r = readMission(new URLSearchParams("step=hack&target=zzz&task=nope&km=-5&town=7&alt=abc&month=99&mix=0.42&shape=evil&hlat=200&hlon=5&at=999,10"));
    expect(r.m.target).toBe("jezero");
    expect(r.m.task).toBe("astrobio");
    expect([r.m.maxKm, r.m.townKm, r.m.maxElev, r.m.month]).toEqual([null, null, null, null]);
    expect(r.m.modelMix).toBe(0.6);
    expect(r.m.shape).toBe("formula");
    expect(r.m.home).toEqual(DHAKA);
    expect(r.at).toBeNull();
    expect(r.step).toBe("results");
    expect(readMission(new URLSearchParams("")).step).toBe("start");
    expect(readMission(new URLSearchParams("month=11.5")).m.month).toBeNull();
  });
});

describe("distances", () => {
  it("match known great-circle distances", () => {
    expect(haversineKm(23.81, 90.41, 51.51, -0.13)).toBeGreaterThan(7900); // Dhaka to London ~8,000 km
    expect(haversineKm(23.81, 90.41, 51.51, -0.13)).toBeLessThan(8100);
    expect(haversineKm(0, 179.9, 0, -179.9)).toBeLessThan(25); // across the date line
    expect(haversineKm(89.9, 0, 89.9, 180)).toBeLessThan(25); // across the pole
  });

  it("find a land cell for points on land and none deep in the ocean", () => {
    const k = g.cellAt(23.81, 90.41);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(haversineKm(23.81, 90.41, g.lat(k), g.lon(k))).toBeLessThan(60);
    expect(g.cellAt(-40, -130)).toBe(-1); // South Pacific
    expect(g.cellAt(95, 400)).toBeGreaterThanOrEqual(-1); // nonsense input must not throw
  });
});

describe("ranking", () => {
  const scores = scoreAll(g, { target: g.targets.jezero, task: "astrobio", weights: TASK_WEIGHTS.astrobio });

  it("keeps places at least the spacing apart, best first", () => {
    const top = rankPlaces(g, scores, { count: 12, spacingKm: 400 });
    expect(top).toHaveLength(12);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].score).toBeGreaterThanOrEqual(top[i].score);
    for (const a of top) for (const b of top) if (a !== b) expect(haversineKm(a.lat, a.lon, b.lat, b.lon)).toBeGreaterThanOrEqual(400);
  });

  it("leaves out known sites and Antarctica when asked", () => {
    const top = rankPlaces(g, scores, { count: 20, spacingKm: 300, onlyNew: true, skipAntarctica: true });
    for (const c of top) {
      expect(c.known).toBeNull();
      expect(nearestKnown(g, c.lat, c.lon).km).toBeGreaterThanOrEqual(150);
      expect(c.lat).toBeGreaterThanOrEqual(-60);
    }
  });

  it("searches with the team's limits and returns ten distinct named places", () => {
    const m = { ...defaultMission("jezero", "astrobio"), maxKm: 4000 };
    const r = runSearch(g, m, homeKm(g, m.home));
    expect(r.places.length).toBe(10);
    expect(new Set(r.places.map((c) => g.name(c.k).title)).size).toBe(10);
    for (const c of r.places) expect(haversineKm(DHAKA.lat, DHAKA.lon, c.lat, c.lon)).toBeLessThanOrEqual(4000);
    const s = screen(g, m, homeKm(g, m.home));
    expect(s.passCount).toBeLessThan(g.n);
    const known = knownKm(g);
    for (const c of r.places) expect(known[c.k]).toBeGreaterThanOrEqual(150);
  });
});

describe("knownKm shortcut", () => {
  it("gives exactly the same distances as measuring every place against every known site", () => {
    const fast = knownKm(g);
    const slow = new Float32Array(g.n).fill(Infinity);
    for (const s of g.meta.known)
      for (let k = 0; k < g.n; k++) {
        const d = haversineKm(g.lat(k), g.lon(k), s.lat, s.lon);
        if (d < slow[k]) slow[k] = d;
      }
    let diff = 0;
    for (let k = 0; k < g.n; k++) if (fast[k] !== slow[k]) diff++;
    expect(diff).toBe(0);
  });
});
