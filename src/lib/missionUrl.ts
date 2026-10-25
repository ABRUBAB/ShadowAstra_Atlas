/**
 * The mission builder keeps the whole mission in the address, so any result can be shared:
 * ?step&target&task&km&town&alt&month&ant&new&mix&shape&home&hlat&hlon&at
 * Anything unknown or out of range falls back to the default instead of breaking the page.
 */
import { TARGET_BY_ID, TASKS, type TaskId } from "../data/sites";
import { MODEL_MIX } from "./grid";
import { ALTITUDES, DEFAULT_SHAPE, DHAKA, DISTANCES, TOWN_LIMITS, defaultMission, type Mission } from "./mission";

export const STEP_IDS = ["start", "destination", "job", "needs", "results"] as const;
export type StepId = (typeof STEP_IDS)[number];

/** How much the learned model counts: a few clear levels instead of a slider. */
export const MIX_LEVELS = [
  { v: 0.3, label: "A little" },
  { v: MODEL_MIX, label: "Balanced" },
  { v: 0.9, label: "A lot" },
];

const LIMITS = {
  km: DISTANCES.map((d) => d.km).filter((x): x is number => x !== null),
  town: TOWN_LIMITS.map((d) => d.km).filter((x): x is number => x !== null),
  alt: ALTITUDES.map((d) => d.m).filter((x): x is number => x !== null),
};

const validLat = (x: number) => Number.isFinite(x) && x >= -90 && x <= 90;
const validLon = (x: number) => Number.isFinite(x) && x >= -180 && x <= 180;

export function readMission(p: URLSearchParams): { m: Mission; step: StepId; at: [number, number] | null } {
  const target = TARGET_BY_ID[p.get("target") ?? ""] ? p.get("target")! : "jezero";
  const task = (TASKS.some((t) => t.id === p.get("task")) ? p.get("task") : TARGET_BY_ID[target].tasks[0]) as TaskId;
  const m = defaultMission(target, task);
  const num = (k: string) => (p.get(k) !== null && p.get(k) !== "" && Number.isFinite(+p.get(k)!) ? +p.get(k)! : null);
  const oneOf = (k: keyof typeof LIMITS) => {
    const v = num(k);
    return v !== null && LIMITS[k].includes(v) ? v : null;
  };
  m.maxKm = oneOf("km");
  m.townKm = oneOf("town");
  m.maxElev = oneOf("alt");
  const month = num("month");
  m.month = month !== null && Number.isInteger(month) && month >= 0 && month <= 11 ? month : null;
  m.skipAntarctica = p.get("ant") === "0";
  m.onlyNew = p.get("new") !== "0";
  const mix = num("mix");
  if (mix !== null && MIX_LEVELS.some((x) => x.v === mix)) m.modelMix = mix;
  const sh = p.get("shape");
  if (sh === "formula" || sh === "ai" || sh === "both") m.shape = sh;
  const hl = num("hlat");
  const ho = num("hlon");
  if (hl !== null && ho !== null && validLat(hl) && validLon(ho)) m.home = { name: (p.get("home") ?? "Home").slice(0, 60), lat: hl, lon: ho };
  const at = p.get("at")?.split(",").map(Number);
  const s = p.get("step") ?? "";
  const step: StepId = (STEP_IDS as readonly string[]).includes(s) ? (s as StepId) : p.get("target") ? "results" : "start";
  return { m, step, at: at && at.length === 2 && validLat(at[0]) && validLon(at[1]) ? [at[0], at[1]] : null };
}

export function writeMission(m: Mission, step: StepId, at: [number, number] | null): Record<string, string> {
  const p: Record<string, string> = { step, target: m.target, task: m.task };
  if (m.maxKm !== null) p.km = String(m.maxKm);
  if (m.townKm !== null) p.town = String(m.townKm);
  if (m.maxElev !== null) p.alt = String(m.maxElev);
  if (m.month !== null) p.month = String(m.month);
  if (m.skipAntarctica) p.ant = "0";
  if (!m.onlyNew) p.new = "0";
  if (m.shape !== DEFAULT_SHAPE) p.shape = m.shape;
  if (m.modelMix !== MODEL_MIX) p.mix = String(m.modelMix);
  if (m.home.name !== DHAKA.name) Object.assign(p, { home: m.home.name, hlat: m.home.lat.toFixed(2), hlon: m.home.lon.toFixed(2) });
  if (at) p.at = `${at[0].toFixed(2)},${at[1].toFixed(2)}`;
  return p;
}
