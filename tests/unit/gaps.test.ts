/** Where an analogy breaks down is written from the place's own numbers, and field tests fit its ground. */
import { describe, expect, it } from "vitest";
import { fieldTestsFor, lightGap, modelLine, placeGaps, townLine } from "../../src/lib/gaps";
import { readJson, ROOT } from "./helpers";

const base = {
  body: "moon" as const,
  targetName: "Shackleton crater rim",
  targetLat: -89.67,
  snowice: 0,
  ndvi: 0.05,
  bare: 0.9,
  nightMin: -30,
  rockEarth: "Basalt and dark lavas",
  rockTarget: "Anorthosite highlands",
  rockWord: "close",
  targetTempAvg: -206,
  mineralMatch: null,
  factors: [
    { label: "Ground shape", value: 0.9 },
    { label: "Rocks & craters", value: 0.8 },
    { label: "Cold & light", value: 0.6 },
    { label: "Bare, dry ground", value: 0.4 },
  ],
};

describe("place gaps", () => {
  it("names snow cover, a different rock, the cold and the weak factors", () => {
    const g = placeGaps({ ...base, snowice: 1, rockWord: "different" });
    expect(g.place.join(" ")).toMatch(/100% of this place is under snow and ice/);
    expect(g.place.join(" ")).toMatch(/basalt and dark lavas.*anorthosite highlands/);
    expect(g.place.join(" ")).toMatch(/-30 °C.*-206 °C/);
    expect(g.place.join(" ")).toMatch(/Weak match on bare, dry ground/);
  });
  it("only recommends the factors the place really copies", () => {
    expect(placeGaps(base).useFor).toEqual(["ground shape", "rocks & craters"]);
  });
  it("never says two-week nights for a polar target", () => {
    expect(lightGap("moon", -89.67, "Shackleton crater rim")).not.toMatch(/two weeks/);
    expect(lightGap("moon", 14.1, "Marius Hills pit")).toMatch(/two weeks/);
  });
});

describe("field tests and wording", () => {
  const tests = ["Set up a habitat for two weeks and live on limited power and water", "Test dust seals on doors and suits"];
  it("swaps dust tests for snow and ice ones on ice-covered ground", () => {
    expect(fieldTestsFor(tests, 0.95)[1]).toMatch(/snow/);
    expect(fieldTestsFor(tests, 0.1)).toEqual(tests);
  });
  it("does not say more than 100% of land", () => {
    expect(modelLine(0.9996, "moon")).not.toMatch(/100%/);
    expect(modelLine(0.73, "mars")).toBe("Looks more Mars-like than 73% of land");
  });
  it("lists research stations, not islands, as Antarctic towns", () => {
    expect(townLine(-76, "Peter I Island", 1087)).toMatch(/research stations/);
    expect(townLine(23.8, "Dhaka", 4)).toBe("Dhaka, 4 km");
  });
});

describe("caves layer data", () => {
  const caves = readJson<{ mars: unknown[][]; moon: unknown[][]; types: Record<string, string> }>(`${ROOT}public/data/caves.json`);
  it("has every Mars cave candidate and lunar pit, with known types", () => {
    expect(caves.mars.length).toBe(1062);
    expect(caves.moon.length).toBe(278);
    for (const c of caves.mars) {
      expect(Math.abs(c[0] as number)).toBeLessThanOrEqual(90);
      expect(Math.abs(c[1] as number)).toBeLessThanOrEqual(180);
    }
    expect(caves.types.sky).toMatch(/lava tube/);
  });
});
