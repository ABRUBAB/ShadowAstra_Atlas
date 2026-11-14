/** The Compare field test: Sun position, route sampling, slope and shadow statistics, Astra's moments and the log. */
import { describe, expect, it } from "vitest";
import { DEM, terrainStats, type TerrainGrid } from "../../src/lib/terrain";
import { earthDailyExtremes, monthFraction, sunPosition, sunRegime } from "../../src/lib/sun";
import { FIELD_TESTS } from "../../src/lib/mission";
import {
  checkTests,
  closestHour,
  compass,
  earthSun,
  fieldEvents,
  formatHours,
  groupEvents,
  ROVER_KMH,
  routeCells,
  runGaps,
  sampleRoute,
  shadowMask,
  SLOPE_LIMITS,
  slopeAt,
  stopIndexes,
  summarize,
  targetSun,
  TEST_KIND,
  travelHours,
  type RoutePoint,
} from "../../src/lib/fieldtest";

/** A synthetic n x n grid (row 0 = north) from a height function of column i and row j. */
function grid(n: number, spacingKm: number, h: (i: number, j: number) => number): TerrainGrid {
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) heights[j * n + i] = h(i, j);
  let min = Infinity;
  let max = -Infinity;
  heights.forEach((v) => {
    min = Math.min(min, v);
    max = Math.max(max, v);
  });
  return { body: "earth", n, spacingKm, heights, min, max, zoom: 9, nativeKm: spacingKm, source: DEM.earth, missing: 0 };
}

const tanD = (d: number) => Math.tan((d * Math.PI) / 180);

describe("Sun position", () => {
  it("rises in the east at the equator on the equinox and stands overhead at noon", () => {
    const f = 0; // northern spring equinox
    const dawn = sunPosition("earth", 0, f, 6);
    expect(dawn.elev).toBeCloseTo(0, 6);
    expect(dawn.az).toBeCloseTo(90, 6);
    expect(sunPosition("earth", 0, f, 12).elev).toBeCloseTo(90, 6);
    expect(sunPosition("earth", 0, f, 18).az).toBeCloseTo(270, 6);
  });
  it("matches the daily noon and midnight heights the light calendar already uses", () => {
    const lat = -77.5;
    const day = earthDailyExtremes(lat)[30]; // day 90
    const f = (day.day - 80) / 365;
    expect(sunPosition("earth", lat, f, 12).elev).toBeCloseTo(day.max, 6);
    expect(sunPosition("earth", lat, f, 0).elev).toBeCloseTo(day.min, 6);
  });
  it("puts the noon Sun in the north for the southern hemisphere and in the south for the northern", () => {
    expect(compass(sunPosition("earth", -40, monthFraction(0), 12).az)).toBe("north");
    expect(compass(sunPosition("earth", 40, monthFraction(6), 12).az)).toBe("south");
  });
  it("keeps the polar night: no Sun at the Dry Valleys in June", () => {
    for (let h = 0; h < 24; h++) expect(earthSun(-77.5, 5, h).elev).toBeLessThan(0);
  });
  it("gives the lunar poles a low grazing Sun at their median daylight height, and Mars a real night", () => {
    const s = targetSun("moon", -89.67, 2, 10);
    expect(s.grazing).toBe(true);
    expect(s.elev).toBeCloseTo(Math.max(0.5, Math.round(sunRegime("moon", -89.67).medianElev * 10) / 10), 6);
    expect(s.elev).toBeGreaterThan(0);
    expect(s.elev).toBeLessThan(5);
    const night = targetSun("mars", -5.4, 2, 0);
    expect(night.grazing).toBe(false);
    expect(night.elev).toBeLessThan(0);
  });
  it("starts at an hour when Earth's Sun is up", () => {
    const h = closestHour(-77.5, "moon", -89.67, 2);
    expect(h).toBeGreaterThanOrEqual(6);
    expect(h).toBeLessThanOrEqual(12);
    expect(earthSun(-77.5, 2, h).elev).toBeGreaterThan(0);
  });
});

describe("slopes", () => {
  it("offers the slope chart's own steps as limits", () => {
    expect(SLOPE_LIMITS).toEqual([10, 15, 25]);
  });
  it("reads a known ramp back as its angle, the same way terrainStats does", () => {
    const n = 24;
    const g = grid(n, 0.5, (i) => i * 500 * tanD(12));
    expect(slopeAt(g, 10, 10)).toBeCloseTo(12, 4);
    expect(slopeAt(g, 0, 10)).toBeCloseTo(12, 4); // one-sided at the edge
    expect(terrainStats(g).meanSlope).toBeCloseTo(12, 3);
  });
});

describe("shadows", () => {
  const n = 40;
  // flat plain with a 2 km wall along column 30 (east of the middle)
  const wall = grid(n, 1, (i) => (i === 30 ? 2000 : 0));
  it("lights a flat plain fully and darkens everything at night", () => {
    const flat = grid(n, 1, () => 0);
    expect(shadowMask(flat, { elev: 5, az: 90 }).every((v) => v === 0)).toBe(true);
    expect(shadowMask(flat, { elev: -3, az: 90 }).every((v) => v === 1)).toBe(true);
  });
  it("casts the wall's shadow away from a low eastern Sun, as far as its height allows", () => {
    const m = shadowMask(wall, { elev: 10, az: 90 });
    const row = 20;
    const reach = 2000 / tanD(10) / 1000; // km of shadow behind a 2 km wall
    expect(m[row * n + 29]).toBe(1); // right behind the wall
    expect(m[row * n + Math.floor(30 - reach) + 1]).toBe(1);
    expect(m[row * n + Math.floor(30 - reach) - 2]).toBe(0); // beyond the shadow's reach
    expect(m[row * n + 35]).toBe(0); // the sunny side
  });
  it("moves the shadow to the other side when the Sun is in the west", () => {
    const m = shadowMask(wall, { elev: 10, az: 270 });
    expect(m[20 * n + 31]).toBe(1);
    expect(m[20 * n + 25]).toBe(0);
  });
});

describe("route", () => {
  const n = 32;
  const g = grid(n, 0.625, (i) => (i < 16 ? 0 : (i - 16) * 625 * tanD(20)));
  const shade = new Uint8Array(n * n);
  for (let i = 0; i < 8; i++) shade[Math.floor(n / 2) * n + i] = 1;
  const route = sampleRoute(g, shade, 15);
  it("runs west to east along the centre row, one point per grid step", () => {
    expect(routeCells(n)).toHaveLength(n);
    expect(route.every((p) => p.j === 16)).toBe(true);
    expect(route.map((p) => p.i)).toEqual(Array.from({ length: n }, (_, i) => i));
    expect(route[n - 1].km).toBeCloseTo((n - 1) * 0.625, 9);
  });
  it("adds up the steepest slope, the share over the limit, the shadow and the climb", () => {
    const s = summarize(route);
    expect(s.lengthKm).toBeCloseTo(31 * 0.625, 9);
    expect(s.steepest).toBeCloseTo(20, 3);
    const over = route.filter((p) => p.slope > 15).length;
    expect(s.overShare).toBeCloseTo(over / n, 9);
    expect(over).toBe(15); // the ramp; its foot reads half the slope (central differences)
    expect(s.shadowShare).toBeCloseTo(8 / n, 9);
    expect(s.climb).toBeCloseTo(15 * 625 * tanD(20), 0);
    expect(s.descent).toBe(0);
  });
  it("gives a rough time from the rover's top speed or Naismith's rule", () => {
    const s = summarize(route);
    expect(travelHours(s, "rover")).toBeCloseTo(s.lengthKm / ROVER_KMH, 9);
    expect(travelHours(s, "walk")).toBeCloseTo(s.lengthKm / 5 + s.climb / 600, 9);
    expect(formatHours(1.5)).toBe("1 h 30 min");
    expect(formatHours(0.25)).toBe("15 min");
  });
});

describe("Astra's moments", () => {
  const pt = (k: number, slope: number, shadow: boolean): RoutePoint => ({ i: k, j: 0, km: k, height: 0, slope, shadow, over: slope > 15 });
  const earth = Array.from({ length: 100 }, (_, k) => pt(k, k >= 40 && k < 45 ? 18 + k - 40 : 3, k >= 70));
  const target = Array.from({ length: 100 }, (_, k) => pt(k, k >= 10 && k < 12 ? 30 : 5, false));
  it("marks the start, the first steep stretch on each side with its top slope, the first shadow and the end", () => {
    const ev = fieldEvents(earth, target, { earth: false, target: false });
    expect(ev.map((e) => `${e.kind}:${e.side ?? "-"}:${e.at}`)).toEqual(["start:-:0", "steep:target:10", "steep:earth:40", "shadow:earth:70", "done:-:99"]);
    expect(ev.find((e) => e.kind === "steep" && e.side === "earth")!.slope).toBe(22);
  });
  it("says night once instead of shadow when the Sun is down", () => {
    const dark = earth.map((p) => ({ ...p, shadow: true }));
    const ev = fieldEvents(dark, target, { earth: true, target: false });
    expect(ev.filter((e) => e.side === "earth").map((e) => e.kind)).toEqual(["night", "steep"]);
  });
  it("says close moments together, and gives the end its own line", () => {
    const groups = groupEvents(fieldEvents(earth, target, { earth: false, target: false }), 100);
    expect(groups.map((g) => g.map((e) => e.kind))).toEqual([["start"], ["steep"], ["steep"], ["shadow"], ["done"]]);
    const close = groupEvents(
      [
        { at: 0, kind: "start", side: null },
        { at: 2, kind: "steep", side: "earth" },
        { at: 99, kind: "done", side: null },
      ],
      100,
    );
    expect(close.map((g) => g.length)).toEqual([2, 1]);
  });
  it("steps through every moment and every eighth of the route when motion is paused", () => {
    const stops = stopIndexes(fieldEvents(earth, target, { earth: false, target: false }), 100);
    expect(stops[0]).toBeGreaterThan(0);
    expect(stops[stops.length - 1]).toBe(99);
    expect(stops).toEqual([...new Set(stops)].sort((a, b) => a - b));
    for (const k of [10, 40, 70]) expect(stops).toContain(k);
  });
});

describe("the log", () => {
  const base = { lengthKm: 80, steepestKm: 10, meanSlope: 3, overKm: 0, climb: 300, descent: 280, minHeight: 0, maxHeight: 400 };
  const earth = { ...base, steepest: 12, overShare: 0, shadowShare: 0.1 };
  const target = { ...base, steepest: 20, overShare: 0.1, shadowShare: 0.45 };
  it("only classifies field tests that really exist", () => {
    const all = new Set(Object.values(FIELD_TESTS).flat());
    for (const k of Object.keys(TEST_KIND)) expect(all.has(k), k).toBe(true);
  });
  it("checks the polar tests against the Earth Sun and the route's shadow", () => {
    const low = checkTests({ task: "polar", earth, target, earthSun: { elev: 6, az: 90 }, targetSun: { elev: 1.5, az: 90 }, earthName: "Dry Valleys", targetName: "Shackleton" });
    expect(low.map((c) => c.verdict)).toEqual(["yes", "yes", "yes"]);
    const high = checkTests({ task: "polar", earth: { ...earth, shadowShare: 0 }, target, earthSun: { elev: 35, az: 0 }, targetSun: { elev: 1.5, az: 0 }, earthName: "Dry Valleys", targetName: "Shackleton" });
    expect(high.map((c) => c.verdict)).toEqual(["no", "no", "no"]);
    expect(high[1].why).toMatch(/35\.0° up here and 1\.5° up at Shackleton/);
  });
  it("compares the steepest ground for driving tests and leaves the rest to other tests", () => {
    const c = checkTests({ task: "traverse", earth, target, earthSun: { elev: 30, az: 0 }, targetSun: { elev: 30, az: 0 }, earthName: "Atacama", targetName: "Gale" });
    expect(c.map((x) => x.verdict)).toEqual(["partly", "other", "partly"]);
    expect(c[0].why).toMatch(/gentler: 12\.0° at most, against 20\.0° at Gale/);
  });
  it("rewrites the tests for snow and ice like the place report does", () => {
    const c = checkTests({ task: "traverse", earth, target, earthSun: { elev: 30, az: 0 }, targetSun: { elev: 30, az: 0 }, earthName: "Svalbard", targetName: "Arcadia", snowice: 0.9 });
    expect(c[1].test).toMatch(/snow and ice/);
  });
  it("names gravity and light, the measured differences and the scale", () => {
    const g = runGaps({ body: "moon", targetLat: -89.67, targetName: "Shackleton", earthName: "Dry Valleys", earth, target, spacingKm: 0.625 });
    const text = g.join(" ");
    expect(text).toMatch(/six times stronger/);
    expect(text).toMatch(/skims the horizon/);
    expect(text).toMatch(/45% of the route at Shackleton was in shadow, against 10%/);
    expect(text).toMatch(/Shackleton is steeper on this route: 20\.0° against 12\.0°/);
    expect(text).toMatch(/0\.63 km apart/);
    expect(text).not.toMatch(/—/);
  });
});
