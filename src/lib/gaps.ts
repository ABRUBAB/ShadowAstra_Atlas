/**
 * Where an Earth place stops being like its Moon or Mars target, written from that place's own
 * numbers (not one sentence for every place), and field tests that fit the ground that is really
 * there (no dust tests on an ice sheet).
 */
import type { TaskId } from "../data/sites";

export interface GapInput {
  body: "moon" | "mars";
  targetName: string;
  targetLat: number;
  /** Share of the place under snow and ice, 0 to 1. */
  snowice: number | null;
  /** MODIS NDVI, 0 to 1. */
  ndvi: number | null;
  /** Share of bare ground, 0 to 1. */
  bare: number | null;
  /** Coldest night, °C (MODIS). */
  nightMin: number | null;
  rockEarth?: string | null;
  rockTarget?: string | null;
  rockWord: string;
  /** Average ground temperature at the target, °C (LRO Diviner), when measured. */
  targetTempAvg?: number;
  /** EMIT mineral match with the target, 0 to 1, when both sides have minerals. */
  mineralMatch?: number | null;
  factors: { label: string; value: number }[];
}

export interface Gaps {
  /** What Earth can never copy for this world. */
  limits: string;
  /** How the Sun and nights differ. */
  light: string;
  /** Mismatches measured at this place. */
  place: string[];
  /** The factors this place copies well. */
  useFor: string[];
}

export const isPolar = (lat: number) => Math.abs(lat) >= 80;

export function earthLimits(body: "moon" | "mars") {
  return body === "moon"
    ? "Gravity here is six times stronger, there is air, and Earth's magnetic field blocks the radiation that reaches the Moon's surface."
    : "Gravity here is 2.6 times stronger, the air is about 160 times thicker, and Earth's magnetic field blocks the radiation that reaches the surface of Mars.";
}

export function lightGap(body: "moon" | "mars", targetLat: number, targetName: string) {
  if (body === "moon" && isPolar(targetLat))
    return `At ${targetName} the Sun skims the horizon all year: high rims stay lit most of the time and some crater floors never see sunlight. On Earth's polar ground the Sun climbs higher in summer and stays down for weeks in winter.`;
  if (body === "moon") return "A lunar day and a lunar night each last about two weeks.";
  return "A day on Mars is about as long as on Earth, but the thin air lets the ground lose its heat fast after sunset.";
}

export function placeGaps(g: GapInput): Gaps {
  const place: string[] = [];
  if (g.snowice !== null && g.snowice >= 0.6)
    place.push(`${Math.round(g.snowice * 100)}% of this place is under snow and ice, so there is little loose rock or dust to drive on, dig or seal against.`);
  else if (g.ndvi !== null && g.ndvi >= 0.3) place.push(`Plants cover much of the ground; ${g.targetName} has none.`);
  else if (g.bare !== null && g.bare < 0.3) place.push(`Only ${Math.round(g.bare * 100)}% of the ground is bare; ${g.targetName} is bare everywhere.`);
  if (g.rockWord === "different" && g.rockEarth && g.rockTarget) place.push(`Its main rock (${g.rockEarth.toLowerCase()}) is not like the ${g.rockTarget.toLowerCase()} of ${g.targetName}.`);
  if (g.mineralMatch !== null && g.mineralMatch !== undefined && g.mineralMatch < 0.6) place.push(`Its minerals only partly match ${g.targetName}'s (match ${g.mineralMatch.toFixed(2)}, NASA EMIT).`);
  if (g.targetTempAvg !== undefined && g.nightMin !== null && g.nightMin - g.targetTempAvg > 40)
    place.push(`Its coldest night is ${Math.round(g.nightMin)} °C; the ground at ${g.targetName} averages ${Math.round(g.targetTempAvg)} °C.`);
  const weak = g.factors.filter((f) => f.value < 0.5).map((f) => f.label.toLowerCase());
  if (weak.length) place.push(`Weak match on ${weak.join(" and ")}.`);
  const sorted = [...g.factors].sort((a, b) => b.value - a.value);
  const strong = sorted.filter((f) => f.value >= 0.75);
  const useFor = (strong.length ? strong : sorted.slice(0, 2)).map((f) => f.label.toLowerCase());
  return { limits: earthLimits(g.body), light: lightGap(g.body, g.targetLat, g.targetName), place, useFor };
}

/** Field tests rewritten for snow- and ice-covered ground. */
const ON_ICE: Record<string, string> = {
  "Test dust seals on doors and suits": "Test seals and heaters on doors and suits in blowing snow and deep cold",
  "Measure how much dust a rocket plume would lift": "Measure how much snow and ice a rocket plume would lift",
  "Measure wheel slip on loose sand and gravel": "Measure wheel slip on snow and ice, then on the nearest moraine",
  "Dig and sieve the loose soil, measure grain sizes": "Sample moraines and rock outcrops: the ice sheet itself has no loose soil",
  "Test drills and scoops on bare rock": "Test drills on ice cores and on nearby rock outcrops",
  "Try heating soil samples to release water or oxygen": "Melt ice samples and test how to clean the water",
  "Test life-detection instruments on dry rocks and salts": "Test life-detection instruments on ice cores and the rock beneath",
};

export function fieldTestsFor(tests: string[], snowice: number | null, _task?: TaskId) {
  if (snowice === null || snowice < 0.6) return tests;
  return tests.map((t) => ON_ICE[t] ?? t);
}

/** The learned model as a sentence that never says "more than 100% of land". */
export function modelLine(model: number, body: string) {
  const pct = model * 100;
  const world = body === "moon" ? "Moon" : "Mars";
  return pct >= 99.5 ? `Among the most ${world}-like places on Earth (top ${Math.max(0.1, 100 - pct).toFixed(1)}% of land)` : `Looks more ${world}-like than ${Math.round(pct)}% of land`;
}

/** Antarctica has research stations, not towns; a far "town" there is usually an empty island. */
export function townLine(lat: number, place: string | null | undefined, km: number | null | undefined) {
  if (lat < -60) return "none: research stations only";
  return place ? `${place}, ${Math.round(km ?? 0)} km` : "none listed";
}
