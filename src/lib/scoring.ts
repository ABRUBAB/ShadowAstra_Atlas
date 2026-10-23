/**
 * Analog Fit, the mission-conditioned score shown in the Analog Lab.
 *
 * Six parameters (Topography, Geology, Temperature, Lighting, Regolith, Radiation).
 *   computed → measured from data in the browser right now (terrain twins, light twin)
 *   demo     → placeholder from our literature review, replaced by the trained model
 *   gap      → Earth cannot reproduce it; shown, never scored
 * Weights depend on the mission task; the user can move them.
 */
import type { EarthSite, Fit, TargetSite, TaskId } from "../data/sites";

export type ParamId = "topography" | "geology" | "temperature" | "lighting" | "regolith" | "radiation";
export type ParamKind = "computed" | "demo" | "gap";

export const PARAMS: { id: ParamId; label: string; what: string }[] = [
  { id: "topography", label: "Ground shape", what: "Slopes and height range, compared at the same scale" },
  { id: "geology", label: "Rocks & craters", what: "Volcanic ground, impact craters and bare rock" },
  { id: "temperature", label: "Cold & heat", what: "How cold the nights get and the day to night swing" },
  { id: "lighting", label: "Sunlight angle", what: "How high the Sun climbs, and the shadows it casts" },
  { id: "regolith", label: "Bare, dry ground", what: "Little rain and no plants, so soil and rock show" },
  { id: "radiation", label: "Radiation", what: "Space radiation. Earth's air and magnetic field block it" },
];

export type Weights = Record<Exclude<ParamId, "radiation">, number>;

export const TASK_WEIGHTS: Record<TaskId, Weights> = {
  base: { topography: 0.25, geology: 0.1, temperature: 0.25, lighting: 0.2, regolith: 0.2 },
  traverse: { topography: 0.45, geology: 0.1, temperature: 0.1, lighting: 0.1, regolith: 0.25 },
  isru: { topography: 0.1, geology: 0.35, temperature: 0.05, lighting: 0.05, regolith: 0.45 },
  ice: { topography: 0.15, geology: 0.15, temperature: 0.4, lighting: 0.2, regolith: 0.1 },
  caves: { topography: 0.35, geology: 0.35, temperature: 0.1, lighting: 0.1, regolith: 0.1 },
  astrobio: { topography: 0.05, geology: 0.45, temperature: 0.25, lighting: 0.05, regolith: 0.2 },
  impact: { topography: 0.4, geology: 0.45, temperature: 0.05, lighting: 0.05, regolith: 0.05 },
  polar: { topography: 0.2, geology: 0.05, temperature: 0.3, lighting: 0.4, regolith: 0.05 },
  landing: { topography: 0.5, geology: 0.15, temperature: 0.05, lighting: 0.1, regolith: 0.2 },
};

const FIT_VALUE: Record<Fit, number | null> = { strong: 0.84, partial: 0.62, weak: 0.36, unknown: null };

/** Literature-informed placeholder values, discounted when the pair isn't a known pairing. */
export function demoValues(site: EarthSite, target: TargetSite) {
  const pairK = site.pairs.includes(target.id) ? 1 : 0.82;
  const worldK = site.worlds.includes(target.body) ? 1 : 0.72;
  const k = pairK * worldK;
  const v = (f: Fit) => {
    const x = FIT_VALUE[f];
    return x === null ? null : Math.round(x * k * 100) / 100;
  };
  const geo = v(site.fit.geology);
  const res = v(site.fit.resources);
  return {
    topography: v(site.fit.topography),
    geology: geo,
    temperature: v(site.fit.environment),
    regolith: geo !== null && res !== null ? Math.round(((geo * 2 + res) / 3) * 100) / 100 : geo ?? res,
  };
}

export interface ParamResult {
  id: ParamId;
  value: number | null;
  kind: ParamKind;
  note: string;
}

export function analogFit(params: ParamResult[], weights: Weights) {
  let s = 0;
  let w = 0;
  let wComputed = 0;
  for (const p of params) {
    if (p.kind === "gap" || p.value === null) continue;
    const wi = weights[p.id as keyof Weights] ?? 0;
    s += p.value * wi;
    w += wi;
    if (p.kind === "computed") wComputed += wi;
  }
  return { score: w ? s / w : 0, computedShare: w ? wComputed / w : 0 };
}

export function band(score: number) {
  if (score >= 0.75) return { label: "High match", tone: "strong" as const };
  if (score >= 0.5) return { label: "Medium", tone: "partial" as const };
  return { label: "Low", tone: "weak" as const };
}

/* ------------------------------------------------------------- sustainability */

export const HOME_BASES = [
  { id: "dhaka", name: "Dhaka, Bangladesh", lat: 23.81, lon: 90.41 },
  { id: "houston", name: "Houston (NASA JSC)", lat: 29.56, lon: -95.09 },
  { id: "pasadena", name: "Pasadena (NASA JPL)", lat: 34.2, lon: -118.17 },
  { id: "cologne", name: "Cologne (ESA EAC)", lat: 50.94, lon: 6.96 },
  { id: "bengaluru", name: "Bengaluru (ISRO)", lat: 12.97, lon: 77.59 },
  { id: "tsukuba", name: "Tsukuba (JAXA)", lat: 36.08, lon: 140.08 },
  { id: "nairobi", name: "Nairobi, Kenya", lat: -1.29, lon: 36.82 },
  { id: "saopaulo", name: "São Paulo, Brazil", lat: -23.55, lon: -46.63 },
];

export function greatCircleKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Indicative long-haul economy factor, kg CO₂e per passenger-km. */
export const FLIGHT_KG_PER_PKM = 0.15;

export function tripCo2Tonnes(km: number, people = 1) {
  return (2 * km * 1.08 * FLIGHT_KG_PER_PKM * people) / 1000; // ×1.08 routing detour
}

/** Access & stewardship notes shown next to every Earth site. */
export const STEWARDSHIP: Record<string, { status: string; note: string }> = {
  "death-valley": { status: "National Park", note: "Research permit; summer heat limits field season." },
  "dry-valleys": { status: "Antarctic Treaty ASMA", note: "Environmental protocol; strict waste and contamination rules." },
  haughton: { status: "Nunavut territory", note: "Inuit land-use agreements; short Arctic summer season." },
  atacama: { status: "Mixed public land", note: "Coordinate with Chilean agencies and local communities." },
  "mauna-kea": { status: "Culturally sacred", note: "Proceed only with Native Hawaiian consultation and consent." },
  "lava-beds": { status: "National Monument", note: "Cave permits; bat and cave-ecosystem protection." },
  lanzarote: { status: "UNESCO Geopark", note: "Protected volcanic landscape; guided access." },
  "rio-tinto": { status: "Mining heritage area", note: "Industrial contamination; access via local authorities." },
  svalbard: { status: "Svalbard Environmental Protection Act", note: "Wildlife safety and permits required." },
  mdrs: { status: "Private research station", note: "Booked crew rotations; BLM land around." },
  "meteor-crater": { status: "Privately owned", note: "Research by agreement with the owners." },
  "black-point": { status: "Public land (USFS/BLM)", note: "Low-impact access; previously used by NASA." },
  askja: { status: "Vatnajökull National Park", note: "Seasonal roads; fragile moss and soils." },
  pilbara: { status: "Traditional Owner land", note: "Aboriginal heritage approvals required." },
  ries: { status: "UNESCO Global Geopark", note: "Towns and farmland, outcrops by permission." },
  sudbury: { status: "Mixed / mining", note: "Active mines; landowner permissions." },
  dallol: { status: "Afar Region", note: "Extreme hazard; local guides and permits mandatory." },
};
