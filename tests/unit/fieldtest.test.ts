/** The Compare field test: Sun position, route sampling, slope and shadow statistics, Astra's moments and the log. */
import { describe, expect, it } from "vitest";
import { DEM, terrainStats, type TerrainGrid } from "../../src/lib/terrain";
import { earthDailyExtremes, lightTwin, monthFraction, sunPosition, sunRegime } from "../../src/lib/sun";
import { FIELD_TESTS } from "../../src/lib/mission";
import {
  allDayShadow,
  checkTests,
  compass,
  dayTop,
  earthDay,
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
  startHour,
  startMonth,
  stopIndexes,
  summarize,
  targetDay,
  targetSun,
  TEST_KIND,
  travelHours,
  type CheckInput,
  type RoutePoint,
  type RouteSummary,
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
  it("keeps the polar night and the midnight Sun at the Dry Valleys", () => {
    for (let h = 0; h < 24; h++) expect(earthSun(-77.5, 5, h).elev).toBeLessThan(0);
    expect(dayTop(earthDay(-77.5, 5))).toBeLessThan(0); // June: no sunrise
    expect(earthDay(-77.5, 11).every((s) => s.elev > 0)).toBe(true); // December: the Sun never sets
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
  it("circles the grazing Sun once through the target's day at one height", () => {
    const day = targetDay("moon", -89.67, 2);
    expect(day).toHaveLength(24);
    expect(new Set(day.map((d) => d.elev)).size).toBe(1);
    expect(new Set(day.map((d) => Math.round(d.az / 15))).size).toBe(24);
  });
  it("starts in the best-matching month in which the mid-month Sun really rises", () => {
    const m = startMonth(-77.5, lightTwin(-77.5, "moon", -89.67).months.map((x) => x.score));
    expect(dayTop(earthDay(-77.5, m))).toBeGreaterThanOrEqual(1);
    // June is polar night at the Dry Valleys, so a top score there is skipped for September's
    const scores = Array.from({ length: 12 }, () => 0.1);
    scores[5] = 0.99;
    scores[8] = 0.5;
    expect(startMonth(-77.5, scores)).toBe(8);
    expect(startMonth(20, scores)).toBe(5);
  });
  it("starts a polar run at an hour when Earth's Sun is up, and other runs at 10:00", () => {
    const h = startHour(-77.5, "moon", -89.67, 2);
    expect(h).toBeGreaterThanOrEqual(6);
    expect(h).toBeLessThanOrEqual(12);
    expect(earthSun(-77.5, 2, h).elev).toBeGreaterThan(0);
    expect(startHour(-24, "mars", -5.4, 2)).toBe(10);
    // a short polar day that has not begun by 10:00 starts at noon instead
    let found = 0;
    for (let lat = 66; lat <= 89; lat++)
      for (let m = 0; m < 12; m++)
        if (earthSun(lat, m, 10).elev <= 0 && dayTop(earthDay(lat, m)) >= 1) {
          found++;
          expect(startHour(lat, "mars", 18.4, m)).toBe(12);
          expect(earthSun(lat, m, 12).elev).toBeGreaterThan(0);
        }
    expect(found).toBeGreaterThan(0);
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
  it("finds ground that stays dark all day: a crater floor under a circling low Sun", () => {
    // a ring wall 2 km high, 4 to 7 km from the middle of a flat plain, 1 km grid
    const crater = grid(41, 1, (i, j) => {
      const d = Math.hypot(i - 20, j - 20);
      return d >= 4 && d <= 7 ? 2000 : 0;
    });
    const circling = Array.from({ length: 24 }, (_, h) => ({ elev: 5, az: h * 15 }));
    // the floor never sees the Sun; a point on the plain east of the crater does when the Sun is east
    expect(Array.from(allDayShadow(crater, [[20, 20], [38, 20]], circling))).toEqual([1, 0]);
    // with the Sun high the floor is lit at noon
    const high = Array.from({ length: 24 }, (_, h) => ({ elev: 60, az: h * 15 }));
    expect(Array.from(allDayShadow(crater, [[20, 20]], high))).toEqual([0]);
    // no sunrise: dark all day everywhere
    expect(Array.from(allDayShadow(crater, [[38, 20]], [{ elev: -4, az: 0 }]))).toEqual([1]);
  });
});

describe("route", () => {
  const n = 32;
  const g = grid(n, 0.625, (i) => (i < 16 ? 0 : (i - 16) * 625 * tanD(20)));
  const shade = new Uint8Array(n * n);
  for (let i = 0; i < 8; i++) shade[Math.floor(n / 2) * n + i] = 1;
  const allDay = new Uint8Array(n);
  allDay.fill(1, 0, 4);
  const route = sampleRoute(g, shade, 15, allDay);
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
    expect(s.overKm).toBeCloseTo((15 / n) * s.lengthKm, 9);
    expect(s.shadowShare).toBeCloseTo(8 / n, 9);
    expect(s.allDayShare).toBeCloseTo(4 / n, 9);
    expect(s.climb).toBeCloseTo(15 * 625 * tanD(20), 0);
    expect(s.descent).toBe(0);
    expect(s.meanSlope).toBeCloseTo(route.reduce((a, p) => a + p.slope, 0) / n, 9);
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
  const pt = (k: number, slope: number, shadow: boolean): RoutePoint => ({ i: k, j: 0, km: k, height: 0, slope, shadow, allDay: false, over: slope > 15 });
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
  const base: RouteSummary = { lengthKm: 80, steepest: 12, steepestKm: 10, meanSlope: 3, overShare: 0, overKm: 0, shadowShare: 0.1, allDayShare: 0.05, climb: 300, descent: 280, minHeight: 0, maxHeight: 400 };
  const earth = base;
  const target = { ...base, steepest: 20, overShare: 0.1, shadowShare: 0.45, allDayShare: 0.3 };
  const polar = (o: Partial<CheckInput>): CheckInput => ({
    task: "polar",
    earth,
    target,
    earthSun: { elev: 6, az: 90 },
    targetSun: { elev: 1.5, az: 90 },
    earthTop: 8,
    targetTop: 1.5,
    targetGrazing: true,
    month: 2,
    earthName: "Dry Valleys",
    targetName: "Shackleton",
    ...o,
  });
  it("only classifies field tests that really exist", () => {
    const all = new Set(Object.values(FIELD_TESTS).flat());
    for (const k of Object.keys(TEST_KIND)) expect(all.has(k), k).toBe(true);
  });
  it("supports the polar tests with a low Sun, shadow now and shadow all day", () => {
    const c = checkTests(polar({}));
    expect(c.map((x) => x.verdict)).toEqual(["yes", "yes", "yes"]);
    expect(c[1].why).toMatch(/In March the Sun climbs no higher than 8\.0° here; at Shackleton it stays near 1\.5°/);
    expect(c[2].why).toMatch(/5% of the Earth route stays in shadow all day in March \(30% at Shackleton/);
  });
  it("does not call one shadowed moment permanent shadow, or a high Sun a low one", () => {
    const c = checkTests(polar({ earth: { ...earth, allDayShare: 0 }, earthSun: { elev: 14, az: 90 }, earthTop: 16 }));
    expect(c.map((x) => x.verdict)).toEqual(["partly", "partly", "partly"]);
    const high = checkTests(polar({ earth: { ...earth, shadowShare: 0, allDayShare: 0 }, earthSun: { elev: 35, az: 0 }, earthTop: 35 }));
    expect(high.map((x) => x.verdict)).toEqual(["no", "no", "no"]);
  });
  it("tells polar night apart from shadowed ground", () => {
    const c = checkTests(polar({ earth: { ...earth, shadowShare: 1, allDayShare: 1 }, earthSun: { elev: -10, az: 0 }, earthTop: -2, month: 5 }));
    expect(c.map((x) => x.verdict)).toEqual(["no", "no", "partly"]);
    expect(c[2].why).toMatch(/does not rise here in June/);
  });
  it("counts darkness for night work only when the Sun is down", () => {
    const night = checkTests({ ...polar({}), task: "base", earthSun: { elev: -5, az: 0 } });
    expect(night.map((x) => x.verdict)).toEqual(["other", "other", "yes"]);
    const day = checkTests({ ...polar({}), task: "base", earthSun: { elev: 20, az: 0 } });
    expect(day[2].verdict).toBe("partly");
    const noon = checkTests({ ...polar({}), task: "base", earth: { ...earth, shadowShare: 0 }, earthSun: { elev: 40, az: 0 } });
    expect(noon[2].verdict).toBe("no");
  });
  it("compares the steepest ground for driving tests and leaves the rest to other tests", () => {
    const c = checkTests({ ...polar({}), task: "traverse", earthName: "Atacama", targetName: "Gale" });
    expect(c.map((x) => x.verdict)).toEqual(["partly", "other", "partly"]);
    expect(c[0].why).toMatch(/gentler: 12\.0° at most, against 20\.0° at Gale/);
    const steep = checkTests({ ...polar({}), task: "traverse", earth: { ...earth, steepest: 21 } });
    expect(steep[0].verdict).toBe("yes");
  });
  it("rewrites the tests for snow and ice like the place report does", () => {
    const c = checkTests({ ...polar({}), task: "traverse", earthName: "Svalbard", targetName: "Arcadia", snowice: 0.9 });
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
  });
  it("writes no em dashes", () => {
    const lines = [
      ...checkTests(polar({})),
      ...checkTests(polar({ earthTop: -1, earthSun: { elev: -3, az: 0 } })),
      ...checkTests({ ...polar({}), task: "base" }),
      ...checkTests({ ...polar({}), task: "traverse" }),
      ...checkTests({ ...polar({}), task: "caves" }),
      ...checkTests({ ...polar({}), task: "impact" }),
    ].flatMap((c) => [c.test, c.why]);
    lines.push(...runGaps({ body: "mars", targetLat: 18.4, targetName: "Jezero", earthName: "Atacama", earth, target, spacingKm: 1.25 }));
    for (const l of lines) expect(l).not.toMatch(/—/);
  });
});
