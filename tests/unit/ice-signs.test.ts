/** LRO LEND and Mini-RF facts at the Moon targets (pipeline/s26): present, sane, and worded honestly. */
import { describe, expect, it } from "vitest";
import type { GridMeta } from "../../src/lib/grid";
import { LEND_VERDICT, cprCovered, cprValue, lendTone, lendValue, pctShort, signedPct } from "../../src/lib/iceSigns";
import { DATA, readJson } from "./helpers";

const meta = readJson<GridMeta>(`${DATA}grid.json`);
const moon = meta.targets.filter((t) => t.body === "moon");
const mars = meta.targets.filter((t) => t.body === "mars");

describe("LEND neutrons at the Moon targets", () => {
  it("reach all ten Moon targets and no Mars target", () => {
    expect(moon).toHaveLength(10);
    for (const t of moon) expect(t.resources?.lend_dip_pct, t.id).toBeTypeOf("number");
    for (const t of mars) expect(t.resources?.lend_dip_pct, t.id).toBeUndefined();
  });

  it("stay in physical ranges", () => {
    for (const t of moon) {
      const r = t.resources!;
      // epithermal neutron dips on the Moon are a few percent at most; the counting error is positive and small
      expect(Math.abs(r.lend_dip_pct!), t.id).toBeLessThan(15);
      expect(r.lend_dip_err_pct!, t.id).toBeGreaterThan(0);
      expect(r.lend_dip_err_pct!, t.id).toBeLessThan(5);
      // CSETN (four collimated sensors) counts about 5 per second
      expect(r.lend_rate_cps!, t.id).toBeGreaterThan(4);
      expect(r.lend_rate_cps!, t.id).toBeLessThan(6);
      expect(r.lend_ref_cps!, t.id).toBeGreaterThan(4);
      expect(r.lend_ref_cps!, t.id).toBeLessThan(6);
      expect(r.lend_cells!, t.id).toBeGreaterThan(0);
      // the dip is the rate against the reference
      expect(100 * (r.lend_rate_cps! / r.lend_ref_cps! - 1)).toBeCloseTo(r.lend_dip_pct!, 0);
      // map scale: 0.5° cells within 15 km near the pole, 1° cells within 30 km elsewhere
      expect(r.lend_radius_km).toBe(t.lat < -80 ? 15 : 30);
      expect(r.lend_source).toMatch(/LEND/);
    }
  });

  it("show fewer neutrons (more hydrogen) at the south pole than at the equatorial targets", () => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const pole = moon.filter((t) => t.lat < -80).map((t) => t.resources!.lend_dip_pct!);
    const rest = moon.filter((t) => t.lat > -60).map((t) => t.resources!.lend_dip_pct!);
    expect(pole).toHaveLength(7);
    expect(avg(pole)).toBeLessThan(avg(rest));
    for (const d of pole) expect(d).toBeLessThan(0);
  });

  it("never read an equatorial number as water", () => {
    for (const t of moon.filter((x) => Math.abs(x.lat) < 60)) expect(lendTone(t.resources!, t.lat)).toBe("rock");
    for (const t of moon.filter((x) => x.lat < -80)) expect(lendTone(t.resources!, t.lat)).not.toBe("rock");
    expect(lendTone({ lend_dip_pct: -3.0, lend_dip_err_pct: 0.5 }, -86)).toBe("clear");
    expect(lendTone({ lend_dip_pct: -1.2, lend_dip_err_pct: 0.5 }, -86)).toBe("slight");
    expect(lendTone({ lend_dip_pct: -0.4, lend_dip_err_pct: 0.5 }, -86)).toBe("none");
    expect(lendTone({ lend_dip_pct: -3.0, lend_dip_err_pct: 0.5 }, 26)).toBe("rock");
    expect(lendTone({}, -86)).toBeNull();
    for (const s of Object.values(LEND_VERDICT)) expect(s).not.toMatch(/—/);
  });
});

describe("Mini-RF radar at the Moon targets", () => {
  it("reach all ten Moon targets, with sane CPR values or an honest 'not covered'", () => {
    for (const t of moon) {
      const r = t.resources!;
      expect(r.cpr_coverage, t.id).toBeGreaterThanOrEqual(0);
      expect(r.cpr_coverage, t.id).toBeLessThanOrEqual(1);
      expect(r.cpr_radius_km, t.id).toBe(10);
      expect(r.minirf_source).toMatch(/Mini-RF/);
      if (cprCovered(r)) {
        // CPR is a ratio of echo powers: lunar medians sit well between 0.1 and 2
        expect(r.cpr_median!, t.id).toBeGreaterThan(0.1);
        expect(r.cpr_median!, t.id).toBeLessThan(2);
        expect(r.cpr_above1_share!, t.id).toBeGreaterThanOrEqual(0);
        expect(r.cpr_above1_share!, t.id).toBeLessThanOrEqual(1);
        expect(r.cpr_pixels!, t.id).toBeGreaterThan(50);
        expect(r.cpr_ref_median!, t.id).toBeGreaterThan(0.1);
        expect(r.cpr_ref_median!, t.id).toBeLessThan(2);
        expect(r.cpr_pixel_m).toBe(t.lat < -70 ? 118 : 237);
      } else {
        expect(cprValue(r)).toBe("not covered");
      }
    }
  });
});

describe("wording helpers", () => {
  it("format signed percentages with a true minus sign", () => {
    expect(signedPct(-3.84)).toBe("−3.8%");
    expect(signedPct(4.8)).toBe("+4.8%");
    expect(signedPct(-0.01)).toBe("0.0%");
    expect(lendValue({ source: "", lend_dip_pct: -3.8, lend_dip_err_pct: 0.7 })).toBe("−3.8% ± 0.7%");
    expect(pctShort(0.076)).toBe("8%");
    expect(pctShort(0.002)).toBe("0.2%");
    expect(pctShort(0)).toBe("0%");
  });
});
