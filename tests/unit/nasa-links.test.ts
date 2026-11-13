/** Every place report links to the same spot in NASA's own tools. */
import { describe, expect, it } from "vitest";
import { earthdataUrl, targetDataLink, worldviewUrl } from "../../src/lib/nasaLinks";

describe("links to NASA's own tools", () => {
  it("opens Worldview on a box centred on the place, with true-colour imagery", () => {
    const u = new URL(worldviewUrl(-24.25, -69.25));
    const [w, s, e, n] = u.searchParams.get("v")!.split(",").map(Number);
    expect((s + n) / 2).toBeCloseTo(-24.25, 1);
    expect((w + e) / 2).toBeCloseTo(-69.25, 1);
    expect(u.searchParams.get("l")).toMatch(/MODIS_Terra_CorrectedReflectance_TrueColor/);
  });
  it("filters Earthdata Search to the 0.5° place, clamped at the poles and the date line", () => {
    const sb = new URL(earthdataUrl(-89.9, 179.9)).searchParams.get("sb")!.split(",").map(Number);
    expect(sb).toHaveLength(4);
    expect(sb[1]).toBeGreaterThanOrEqual(-90);
    expect(sb[2]).toBeLessThanOrEqual(180);
    expect(sb[3] - sb[1]).toBeLessThanOrEqual(0.5);
    const mid = new URL(earthdataUrl(23.75, 90.25)).searchParams.get("sb");
    expect(mid).toBe("90,23.5,90.5,24");
  });
  it("sends Moon and Mars targets to NASA's Planetary Data System", () => {
    expect(targetDataLink("moon").url).toMatch(/pds-geosciences\.wustl\.edu\/missions\/lro/);
    expect(targetDataLink("mars").url).toMatch(/ode\.rsl\.wustl\.edu\/mars/);
  });
});
