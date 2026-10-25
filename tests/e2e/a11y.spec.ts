/**
 * Automated WCAG 2.2 A/AA checks (axe-core) on the key screens. Automated checks find only part of
 * the problems; keyboard and screen-reader checks are listed in docs/ENGINEERING.md.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** Contrast is only meaningful once fades have finished: wait until no finite animation is running. */
async function settled(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity).length), { timeout: 15_000 })
    .toBe(0);
}

const PAGES: [string, string, string][] = [
  ["home", "/", "h1"],
  ["find start", "/discover", "h1"],
  ["find results", "/discover?step=results&target=jezero&task=astrobio", "li button.surface"],
  ["place report", "/discover?step=results&target=gale&task=astrobio&at=38.25,87.25", "h2"],
  ["compare", "/lab?earth=atacama&target=gale", "h2"],
  ["how it works", "/methods", "h1"],
  ["learn", "/learn", "h1"],
  ["team", "/about", "h1"],
  ["printable report", "/report?target=gale&task=astrobio&at=38.25,87.25", "h1"],
];

for (const [name, path, ready] of PAGES) {
  test(`no serious accessibility problems: ${name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.locator(ready).first()).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1200);
    await settled(page);
    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".leaflet-control-attribution") // provider credits, styled by Leaflet
      .analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

const LIGHT: [string, string, string][] = [
  ["home (light)", "/?theme=light", "h1"],
  ["find results (light)", "/discover?step=results&target=jezero&task=astrobio&theme=light", "li button.surface"],
  ["place report (light)", "/discover?step=results&target=gale&task=astrobio&at=38.25,87.25&theme=light", "h2"],
  ["how it works (light)", "/methods?theme=light", "h1"],
  ["learn (light)", "/learn?theme=light", "h1"],
];

for (const [name, path, ready] of LIGHT) {
  test(`no serious accessibility problems: ${name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto(path);
    await expect(page.locator(ready).first()).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1200);
    await settled(page);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".leaflet-control-attribution").analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")} ${v.nodes[0]?.failureSummary?.split("\n")[1] ?? ""}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
