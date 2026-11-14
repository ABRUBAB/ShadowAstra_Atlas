/**
 * Plain-English wording for the two LRO instruments that look for ice directly (pipeline/s26):
 * LEND neutrons and Mini-RF radar. One place for the numbers' meaning and their caveats, so the
 * Compare page, the printable report and How it works say exactly the same thing.
 * These are measured facts about the Moon targets; they never change a score.
 */
import type { TargetResources } from "./grid";

/** clear / slight / none / more: a polar target's dip against its counting error; rock: near the equator. */
export type LendTone = "clear" | "slight" | "none" | "more" | "rock";

/** Signed percentage with a true minus sign, e.g. "−3.8%" or "+4.8%". */
export function signedPct(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits);
  const zero = s === (0).toFixed(digits);
  return `${v > 0 && !zero ? "+" : v < 0 && !zero ? "−" : ""}${s}%`;
}

/**
 * What a LEND number means. Near the equator (|lat| < 60°) rock type moves the count by a few percent
 * and hydrogen is too scarce for LEND, so those numbers are never read as water. Near the poles the dip
 * is compared with its own counting error (1 sigma): 3 sigma or more is clear, 2 to 3 is small.
 */
export function lendTone(r: Pick<TargetResources, "lend_dip_pct" | "lend_dip_err_pct">, lat: number): LendTone | null {
  if (r.lend_dip_pct === undefined || r.lend_dip_err_pct === undefined) return null;
  if (Math.abs(lat) < 60) return "rock";
  const z = r.lend_dip_pct / Math.max(r.lend_dip_err_pct, 0.05);
  return z <= -3 ? "clear" : z <= -2 ? "slight" : z >= 2 ? "more" : "none";
}

export const LEND_VERDICT: Record<LendTone, string> = {
  clear: "Clear dip: more hydrogen than typical highland ground",
  slight: "Small dip: maybe a little more hydrogen",
  none: "No clear difference from typical highland ground",
  more: "More neutrons than typical highland ground: no sign of extra hydrogen",
  rock: "Near the equator the kind of rock moves this count, so it says little about water",
};

/** The same verdicts, to continue a sentence (printable report). */
export const LEND_INLINE: Record<LendTone, string> = {
  clear: "a clear dip, so more hydrogen",
  slight: "a small dip, maybe a little more hydrogen",
  none: "no clear difference",
  more: "more neutrons, so no sign of extra hydrogen",
  rock: "but near the equator the kind of rock moves this count, so it says little about water",
};

/** "−3.8% ± 0.7%" */
export function lendValue(r: TargetResources): string | null {
  if (r.lend_dip_pct === undefined || r.lend_dip_err_pct === undefined) return null;
  return `${signedPct(r.lend_dip_pct)} ± ${r.lend_dip_err_pct.toFixed(1)}%`;
}

/** What the LEND number is compared with, in plain words. */
export const LEND_REF = "typical highland ground away from the poles";

export const LEND_PLAIN = "Hydrogen, for example in water ice, slows neutrons down, so ground with more hydrogen sends fewer of them up to the orbiter.";
export const LEND_CAVEAT =
  "LEND sees a blurry patch: its map cells are 15 km wide near the pole and 30 km elsewhere, and scientists still debate how sharp its view is, so the number describes the neighbourhood, not one landing spot.";

/** A temperature with a true minus sign, e.g. "−181 °C". */
export function tempC(v: number): string {
  const r = Math.round(v);
  return `${r < 0 ? "−" : ""}${Math.abs(r)} °C`;
}

/** What the Mini-RF context numbers describe: the south polar region, or the whole Moon (global mosaic). */
export function cprRefLabel(r: TargetResources): string {
  return r.cpr_ref_region?.startsWith("south polar") ? "the south polar region" : "the Moon as a whole";
}

/** True when Mini-RF has data for the target. */
export const cprCovered = (r: TargetResources) => r.cpr_median !== undefined && r.cpr_median !== null;

/** "0.52 median, 4% of the ground above 1" or "not covered". */
export function cprValue(r: TargetResources): string | null {
  if (r.cpr_median === undefined) return null;
  if (!cprCovered(r)) return "not covered";
  return `${r.cpr_median!.toFixed(2)} median, ${pctShort(r.cpr_above1_share ?? 0)} of the ground above 1`;
}

/** A share 0 to 1 as a short percentage: "6%", "0.4%", "0%". */
export function pctShort(x: number): string {
  const p = x * 100;
  return p === 0 ? "0%" : p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

export const CPR_PLAIN = "Radar roughness (CPR): smooth, dusty ground gives low values; rough, blocky rock and thick, clean ice can both give values above 1.";
export const CPR_CAVEAT = "So a high value inside a dark crater is a hint of ice, not proof: rough, rocky ground looks the same to the radar.";

/** Short source lines for credits. */
export const LEND_CREDIT = "LRO LEND collimated neutron map 2009 to 2011 (PDS)";
export const MINIRF_CREDIT = "LRO Mini-RF radar CPR mosaics (PDS)";
