/**
 * Field test: a simulated traverse over the 3D land slices on Compare (Lab).
 *
 * One straight route, the centre west-to-east row of the grid (the gold slice line and the profile
 * chart), crosses the Earth block and the target block at the same scale. At every grid step we read
 * the real height, the slope and whether that ground is in sunlight under each side's own Sun:
 *   Earth : the real Sun for the place's latitude, the chosen month and local Sun time (sun.ts);
 *   target: at the lunar poles a low grazing Sun at its median daylight height, circling with the
 *           time of day; elsewhere the Sun at the same season and the same time of its own day.
 * Slopes come from the elevation grid, whose step is the footprint / 128 or coarser, so they are
 * kilometre-scale averages: gentler than the ground a rover meets over a few metres.
 */
import type { TaskId } from "../data/sites";
import { SLOPE_BINS, type TerrainGrid } from "./terrain";
import { monthFraction, sunPosition, sunRegime, type SunPosition } from "./sun";
import { FIELD_TESTS } from "./mission";
import { earthLimits, fieldTestsFor, isPolar, lightGap } from "./gaps";

export type TeamMode = "rover" | "walk";
export type Side = "earth" | "target";

/** Slope limits offered to the visitor: steps of the slope chart's bins (SLOPE_BINS). */
export const SLOPE_LIMITS = SLOPE_BINS.filter((b) => b >= 10 && b <= 25);

/** Apollo Lunar Roving Vehicle top speed, about 13 km/h (8 mph), from NASA. */
export const ROVER_KMH = 13;
/** Naismith's rule for hill walkers: 5 km/h on the flat, plus one hour for every 600 m climbed. */
export const WALK_KMH = 5;
export const WALK_CLIMB_M_PER_H = 600;
/** A Sun under 10° counts as "near the horizon" (a step of the light twin's SUN_BINS). */
export const LOW_SUN = 10;

/* ----------------------------------------------------------------- the Sun */

/** The real Sun over an Earth place in the middle of a month (0 = January) at a local Sun time. */
export function earthSun(lat: number, month: number, hour: number): SunPosition {
  return sunPosition("earth", lat, monthFraction(month), hour);
}

export interface TargetSun extends SunPosition {
  /** True at the lunar poles, where we use a low grazing Sun that circles the horizon. */
  grazing: boolean;
}

/**
 * The target's own Sun. At the lunar poles: the target's median daylight Sun height (as the Light
 * section and the shadow map use), with the Sun's direction following the time of day. Elsewhere:
 * the same point in its year and the same time of its own day as the Earth side.
 */
export function targetSun(body: "moon" | "mars", lat: number, month: number, hour: number): TargetSun {
  if (body === "moon" && isPolar(lat)) {
    const elev = Math.max(0.5, Math.round(sunRegime(body, lat).medianElev * 10) / 10);
    return { elev, az: sunPosition(body, lat, 0, hour).az, grazing: true };
  }
  return { ...sunPosition(body, lat, monthFraction(month), hour), grazing: false };
}

/**
 * The hour (6 to 12, local Sun time) when Earth's Sun is up and closest in height to the target's,
 * used as the starting time so the first run shows the place at its best light match.
 */
export function closestHour(earthLat: number, body: "moon" | "mars", targetLat: number, month: number) {
  let best = 10;
  let gap = Infinity;
  for (let h = 6; h <= 12; h++) {
    const e = earthSun(earthLat, month, h).elev;
    const t = targetSun(body, targetLat, month, h).elev;
    if (e <= 0) continue;
    const d = Math.abs(e - Math.max(0, t));
    if (d < gap - 1e-9) {
      gap = d;
      best = h;
    }
  }
  return best;
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
/** Plain-English direction for an azimuth in degrees from north. */
export function compass(az: number) {
  return COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}

/* ------------------------------------------------------- slope and shadow */

/** Slope in degrees at a grid cell: central differences, as terrainStats uses (one-sided at the edges). */
export function slopeAt(g: TerrainGrid, i: number, j: number) {
  const { n, heights } = g;
  const i0 = Math.max(0, i - 1);
  const i1 = Math.min(n - 1, i + 1);
  const j0 = Math.max(0, j - 1);
  const j1 = Math.min(n - 1, j + 1);
  const m = g.spacingKm * 1000;
  const dzdx = (heights[j * n + i1] - heights[j * n + i0]) / ((i1 - i0) * m);
  const dzdy = (heights[j1 * n + i] - heights[j0 * n + i]) / ((j1 - j0) * m);
  return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
}

/**
 * 1 where the ground is in shadow (or the Sun is down), else 0, for one Sun direction. Each cell
 * looks toward the Sun across the grid; ground that rises above the Sun's angle blocks it. Only
 * ground inside the block can cast shadows.
 */
export function shadowMask(g: TerrainGrid, sun: SunPosition): Uint8Array {
  const { n, heights } = g;
  const out = new Uint8Array(n * n);
  if (sun.elev <= 0) return out.fill(1);
  const cell = g.spacingKm * 1000;
  const tan = Math.tan((sun.elev * Math.PI) / 180);
  const a = (sun.az * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a); // row 0 is north
  // ground never rises more than (max - min) above a cell, so the march can stop there
  const steps = Math.min(Math.ceil(n * 1.5), Math.ceil((g.max - g.min) / (tan * cell)) + 1);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const h0 = heights[j * n + i];
      for (let s = 1; s <= steps; s++) {
        const x = i + dx * s;
        const y = j + dy * s;
        if (x < 0 || y < 0 || x > n - 1 || y > n - 1) break;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(n - 1, x0 + 1);
        const y1 = Math.min(n - 1, y0 + 1);
        const fx = x - x0;
        const fy = y - y0;
        const h = (heights[y0 * n + x0] * (1 - fx) + heights[y0 * n + x1] * fx) * (1 - fy) + (heights[y1 * n + x0] * (1 - fx) + heights[y1 * n + x1] * fx) * fy;
        if (h - h0 > tan * s * cell) {
          out[j * n + i] = 1;
          break;
        }
      }
    }
  return out;
}

/* ------------------------------------------------------------------- route */

export interface RoutePoint {
  i: number;
  j: number;
  /** Distance from the start, km. */
  km: number;
  /** Metres, as in the elevation grid. */
  height: number;
  /** Degrees. */
  slope: number;
  shadow: boolean;
  over: boolean;
}

/** The route: the centre west-to-east row, one point per grid step (the gold slice line). */
export function routeCells(n: number): [number, number][] {
  const j = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => [i, j]);
}

export function sampleRoute(g: TerrainGrid, shade: Uint8Array, limit: number): RoutePoint[] {
  return routeCells(g.n).map(([i, j], k) => {
    const slope = slopeAt(g, i, j);
    return { i, j, km: k * g.spacingKm, height: g.heights[j * g.n + i], slope, shadow: shade[j * g.n + i] === 1, over: slope > limit };
  });
}

export interface RouteSummary {
  lengthKm: number;
  steepest: number;
  steepestKm: number;
  meanSlope: number;
  /** Share of route points steeper than the limit, 0 to 1. */
  overShare: number;
  overKm: number;
  /** Share of route points in shadow or night, 0 to 1. */
  shadowShare: number;
  /** Metres climbed and descended along the route. */
  climb: number;
  descent: number;
  minHeight: number;
  maxHeight: number;
}

export function summarize(points: RoutePoint[]): RouteSummary {
  const n = points.length;
  const lengthKm = n > 1 ? points[n - 1].km - points[0].km : 0;
  let steepest = 0;
  let steepestKm = 0;
  let sum = 0;
  let over = 0;
  let shadow = 0;
  let climb = 0;
  let descent = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  points.forEach((p, k) => {
    if (p.slope > steepest) {
      steepest = p.slope;
      steepestKm = p.km;
    }
    sum += p.slope;
    if (p.over) over++;
    if (p.shadow) shadow++;
    if (k > 0) {
      const d = p.height - points[k - 1].height;
      if (d > 0) climb += d;
      else descent -= d;
    }
    minHeight = Math.min(minHeight, p.height);
    maxHeight = Math.max(maxHeight, p.height);
  });
  const overShare = n ? over / n : 0;
  return { lengthKm, steepest, steepestKm, meanSlope: n ? sum / n : 0, overShare, overKm: overShare * lengthKm, shadowShare: n ? shadow / n : 0, climb, descent, minHeight, maxHeight };
}

/** Rough time in hours: the Apollo rover's top speed (so a lower bound), or Naismith's rule on foot. */
export function travelHours(s: RouteSummary, mode: TeamMode) {
  return mode === "rover" ? s.lengthKm / ROVER_KMH : s.lengthKm / WALK_KMH + s.climb / WALK_CLIMB_M_PER_H;
}

export function formatHours(h: number) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh ? `${hh} h ${String(mm).padStart(2, "0")} min` : `${mm} min`;
}

/* ------------------------------------------------------------------ events */

export type EventKind = "start" | "steep" | "shadow" | "night" | "done";

export interface FieldEvent {
  /** Route index where it happens. */
  at: number;
  kind: EventKind;
  side: Side | null;
  /** For "steep": the steepest slope in that stretch. */
  slope?: number;
}

const ORDER: Record<EventKind, number> = { start: 0, night: 1, shadow: 2, steep: 3, done: 4 };

/**
 * Key moments for Astra: the start, the first stretch over the slope limit on each side, the first
 * time each side enters shadow (or night for the whole run), and the end.
 */
export function fieldEvents(earth: RoutePoint[], target: RoutePoint[], night: { earth: boolean; target: boolean }): FieldEvent[] {
  const n = Math.min(earth.length, target.length);
  const ev: FieldEvent[] = [{ at: 0, kind: "start", side: null }];
  for (const [side, pts] of [
    ["earth", earth],
    ["target", target],
  ] as const) {
    const first = pts.findIndex((p) => p.over);
    if (first >= 0) {
      let top = 0;
      for (let k = first; k < pts.length && pts[k].over; k++) top = Math.max(top, pts[k].slope);
      ev.push({ at: first, kind: "steep", side, slope: top });
    }
    if (night[side]) ev.push({ at: 0, kind: "night", side });
    else {
      const sh = pts.findIndex((p) => p.shadow);
      if (sh >= 0) ev.push({ at: sh, kind: "shadow", side });
    }
  }
  ev.push({ at: Math.max(0, n - 1), kind: "done", side: null });
  return ev.sort((a, b) => a.at - b.at || ORDER[a.kind] - ORDER[b.kind]);
}

/**
 * Events close together are said together (so one line is not replaced before it can be read).
 * Groups start at their first event; the end always gets its own group.
 */
export function groupEvents(events: FieldEvent[], n: number, gap = 0.06): FieldEvent[][] {
  const groups: FieldEvent[][] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && e.kind !== "done" && last[0].kind !== "done" && e.at - last[0].at < Math.max(1, n * gap)) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/** Indexes the reduced-motion "Next stop" button visits: every event and every eighth of the route. */
export function stopIndexes(events: FieldEvent[], n: number) {
  const set = new Set<number>(events.map((e) => e.at));
  for (let k = 1; k <= 8; k++) set.add(Math.round((k * (n - 1)) / 8));
  return [...set].filter((k) => k > 0 && k <= n - 1).sort((a, b) => a - b);
}

/* ------------------------------------------------- what the run supports */

export type TestKind = "slopes" | "dark" | "shadow" | "longShadow" | "lowSun" | "route" | "other";
export type Verdict = "yes" | "partly" | "no" | "other";

/** How a drive or walk over the terrain can speak to each field test in FIELD_TESTS. */
export const TEST_KIND: Record<string, TestKind> = {
  "Practise night operations in deep cold": "dark",
  "Test hazard-detection cameras on real rocks and slopes": "slopes",
  "Drive a rover 10 km over the steepest ground you can find": "slopes",
  "Plan routes from orbital images, then check them on foot": "route",
  "Practise moving safely in darkness and rubble": "dark",
  "Map the crater rim, floor and ejecta from orbit and on foot": "route",
  "Work through long shadows with a low Sun": "longShadow",
  "Test solar power when the Sun stays near the horizon": "lowSun",
  "Practise finding cold, permanently shadowed ground": "shadow",
};

export interface TestCheck {
  test: string;
  kind: TestKind;
  verdict: Verdict;
  why: string;
}

export interface CheckInput {
  task: TaskId;
  earth: RouteSummary;
  target: RouteSummary;
  earthSun: SunPosition;
  targetSun: SunPosition;
  earthName: string;
  targetName: string;
  snowice?: number | null;
}

const deg = (v: number) => `${v.toFixed(1)}°`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function checkTests(c: CheckInput): TestCheck[] {
  const tests = FIELD_TESTS[c.task] ?? [];
  const shown = fieldTestsFor(tests, c.snowice ?? null);
  const up = c.earthSun.elev > 0;
  const e = c.earth;
  const t = c.target;
  return tests.map((test, k) => {
    const kind = TEST_KIND[test] ?? "other";
    let verdict: Verdict = "other";
    let why = "A drive over the ground cannot test this; it needs its own field test.";
    if (kind === "slopes") {
      verdict = e.steepest >= t.steepest ? "yes" : e.steepest >= t.steepest / 2 ? "partly" : "no";
      why =
        verdict === "yes"
          ? `The Earth route is at least as steep: ${deg(e.steepest)} at most, against ${deg(t.steepest)} at ${c.targetName}.`
          : `The Earth route is gentler: ${deg(e.steepest)} at most, against ${deg(t.steepest)} at ${c.targetName}.`;
    } else if (kind === "dark") {
      verdict = !up || e.shadowShare > 0 ? "yes" : "no";
      why = !up ? "The Sun is down, so the whole Earth route is dark." : e.shadowShare > 0 ? `${pct(e.shadowShare)} of the Earth route is in shadow.` : "The whole Earth route is in sunlight at this time. Try an earlier or later hour.";
    } else if (kind === "shadow") {
      verdict = !up ? "partly" : e.shadowShare > 0 ? "yes" : "no";
      why = !up
        ? "It is night, so the route is dark everywhere, not shadowed in places."
        : e.shadowShare > 0
          ? `${pct(e.shadowShare)} of the Earth route is in shadow (${pct(t.shadowShare)} at ${c.targetName}).`
          : "No shadow on the Earth route at this month and time. Try a lower Sun.";
    } else if (kind === "longShadow") {
      verdict = up && e.shadowShare > 0 ? (c.earthSun.elev < LOW_SUN ? "yes" : "partly") : "no";
      why = !up
        ? "The Sun is down at this time, so there are no shadows to work through."
        : e.shadowShare === 0
          ? `The Sun is ${deg(c.earthSun.elev)} up and the whole route is sunlit.`
          : c.earthSun.elev < LOW_SUN
            ? `The Sun is ${deg(c.earthSun.elev)} up and ${pct(e.shadowShare)} of the route is in shadow.`
            : `There is shadow, but the Sun is ${deg(c.earthSun.elev)} up, higher than ${LOW_SUN}°.`;
    } else if (kind === "lowSun") {
      verdict = !up ? "no" : c.earthSun.elev < LOW_SUN ? "yes" : c.earthSun.elev < 2 * LOW_SUN ? "partly" : "no";
      why = !up ? "The Sun is down at this time." : `The Sun is ${deg(c.earthSun.elev)} up here and ${deg(Math.max(0, c.targetSun.elev))} up at ${c.targetName}.`;
    } else if (kind === "route") {
      verdict = "partly";
      why = "This run did the orbit half: a route planned from orbital elevation data. Checking it on the ground is the field team's job.";
    }
    return { test: shown[k] ?? test, kind, verdict, why };
  });
}

/* ------------------------------------------------- where the analogy breaks */

export interface GapRunInput {
  body: "moon" | "mars";
  targetLat: number;
  targetName: string;
  earthName: string;
  earth: RouteSummary;
  target: RouteSummary;
  spacingKm: number;
}

export function runGaps(g: GapRunInput): string[] {
  const out = [earthLimits(g.body), lightGap(g.body, g.targetLat, g.targetName)];
  if (Math.abs(g.earth.shadowShare - g.target.shadowShare) >= 0.2)
    out.push(`On this run ${pct(g.target.shadowShare)} of the route at ${g.targetName} was in shadow, against ${pct(g.earth.shadowShare)} at ${g.earthName}.`);
  if (g.target.steepest - g.earth.steepest >= 3) out.push(`${g.targetName} is steeper on this route: ${deg(g.target.steepest)} against ${deg(g.earth.steepest)}.`);
  else if (g.earth.steepest - g.target.steepest >= 3) out.push(`${g.earthName} is steeper on this route: ${deg(g.earth.steepest)} against ${deg(g.target.steepest)}.`);
  out.push(`Slopes are measured between grid points ${g.spacingKm.toFixed(2)} km apart, so they are kilometre-scale averages. A rover meets steeper ground over a few metres.`);
  out.push("Only ground inside the block casts shadows here; hills outside it are not counted.");
  return out;
}
