/**
 * Lab benchmark of the production build. Not field data: one machine, synthetic runs.
 *
 *   npm run build && npx vite preview --port 4174 &   (or let the script use a running preview)
 *   node tests/perf/bench.mjs <label> [--quick]
 *
 * Writes docs/perf/bench-<label>.json. Methodology (also in docs/ENGINEERING.md):
 *  - page loads: a fresh browser context per sample (cold cache), production build served by
 *    vite preview on localhost, Chrome headless, SwiftShader WebGL. Profiles: "desktop"
 *    (no throttling) and "mobile" (4x CPU slowdown, 1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT).
 *    LCP/CLS from PerformanceObserver; TBT = sum of (long task - 50 ms) after FCP within 10 s.
 *  - operations: window.__atlasBench (src/lib/bench.ts), steady state after a JIT warm-up.
 *  - interactions: Event Timing entries (durationThreshold 16 ms) for real clicks; the value
 *    reported is the slowest-but-one, which is how INP treats fewer than 50 interactions.
 *  - memory: performance.memory after forced GC (--js-flags=--expose-gc), across in-app navigation.
 *  - graphics: SwiftShader (software WebGL, the worst case: no GPU) by default; `--gpu` uses this
 *    machine's real GPU through ANGLE/D3D11. The renderer string is saved with the results.
 *  - BENCH_BASE=http://localhost:4175 measures another build (for example an older commit); the
 *    operations section is skipped when that build has no ?bench hook.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BENCH_BASE ?? "http://localhost:4174";
const label = process.argv[2] ?? "run";
const quick = process.argv.includes("--quick");
const gpu = process.argv.includes("--gpu");
const GL = [...(gpu ? ["--enable-gpu", "--use-angle=d3d11"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]), "--ignore-gpu-blocklist", "--js-flags=--expose-gc"];

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const r1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);
const stats = (xs, withP99) => ({ n: xs.length, p50: r1(pct(xs, 50)), p95: r1(pct(xs, 95)), ...(withP99 && xs.length >= 100 ? { p99: r1(pct(xs, 99)) } : {}), max: r1(Math.max(...xs)) });

const INIT = () => {
  window.__lab = { lcp: 0, cls: 0, longtasks: [], fcp: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lab.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__lab.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lab.longtasks.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  try {
    sessionStorage.setItem("sa-splash", "seen");
    localStorage.setItem("sa-nudged", "1");
  } catch {}
};

async function pageLoad(browser, path, profile) {
  const ctx = await browser.newContext({ viewport: profile === "mobile" ? { width: 412, height: 915 } : { width: 1366, height: 820 }, isMobile: profile === "mobile", hasTouch: profile === "mobile" });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  if (profile === "mobile") {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await page.goto(BASE + path, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(profile === "mobile" ? 14000 : 8000);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const tbt = window.__lab.longtasks.filter(([s]) => s > fcp && s < 10000).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    const res = performance.getEntriesByType("resource");
    const kb = (f) => Math.round(res.filter(f).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) / 1024);
    const grid = performance.getEntriesByName("atlas:grid-parse")[0];
    return {
      ttfb: nav.responseStart - nav.startTime, fcp, lcp: window.__lab.lcp, cls: window.__lab.cls, tbt,
      js_kb: kb((r) => r.initiatorType === "script" || r.name.endsWith(".js")), css_kb: kb((r) => r.name.endsWith(".css")),
      data_kb: kb((r) => r.name.includes("/data/")), img_kb: kb((r) => r.initiatorType === "img" || /\.(webp|jpg|png)/.test(r.name)),
      grid_ready: grid ? grid.startTime + grid.duration : null,
    };
  });
  await ctx.close();
  return m;
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome", args: GL });
  const result = { label, date: new Date().toISOString(), base: BASE, chrome: browser.version(), renderer: null, loads: {}, ops: {}, interactions: {}, memory: {} };
  {
    const p = await browser.newPage();
    result.renderer = await p.evaluate(() => {
      const g = document.createElement("canvas").getContext("webgl2");
      const i = g?.getExtension("WEBGL_debug_renderer_info");
      return g ? String(g.getParameter(i ? i.UNMASKED_RENDERER_WEBGL : g.RENDERER)) : "no WebGL";
    });
    await p.close();
    console.log("renderer", result.renderer);
  }
  const N = quick ? 2 : 5;
  const routes = { home: "/", "find-results": "/discover?step=results&target=jezero&task=astrobio", methods: "/methods", maps: "/atlas", compare: "/lab?earth=atacama&target=gale" };
  for (const profile of ["desktop", "mobile"]) {
    for (const [name, path] of Object.entries(routes)) {
      if (profile === "mobile" && !["home", "find-results"].includes(name)) continue;
      const samples = [];
      for (let i = 0; i < N; i++) samples.push(await pageLoad(browser, path, profile));
      const keys = Object.keys(samples[0]);
      result.loads[`${profile}:${name}`] = Object.fromEntries(keys.map((k) => [k, { median: r1(pct(samples.map((s) => s[k]).filter((x) => x !== null), 50)), min: r1(Math.min(...samples.map((s) => s[k] ?? Infinity))), max: r1(Math.max(...samples.map((s) => s[k] ?? -Infinity))) }]));
      result.loads[`${profile}:${name}`].samples = N;
      console.log(profile, name, JSON.stringify(Object.fromEntries(keys.map((k) => [k, result.loads[`${profile}:${name}`][k].median]))));
    }
  }

  // operations in the page
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    await page.addInitScript(INIT);
    await page.goto(`${BASE}/?bench=1`, { waitUntil: "load" });
    const hook = await page.waitForFunction(() => !!window.__atlasBench, null, { timeout: 20000 }).then(() => true, () => false);
    if (hook) {
      const raw = await page.evaluate((n) => window.__atlasBench.run(n), quick ? 60 : 300);
      for (const [k, xs] of Object.entries(raw)) result.ops[k] = stats(xs, true);
      const parse = await page.evaluate(() => performance.getEntriesByName("atlas:grid-parse").map((e) => e.duration));
      result.ops["grid-parse"] = stats(parse, false);
    } else result.ops = { skipped: "this build has no ?bench hook" };
    console.log("ops", JSON.stringify(result.ops));
    await ctx.close();
  }

  // interactions: Event Timing for real clicks
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    await page.addInitScript(INIT);
    await page.addInitScript(() => {
      window.__ev = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push([e.name, e.duration]); }).observe({ type: "event", durationThreshold: 16, buffered: true });
    });
    await page.goto(`${BASE}/discover?step=needs&target=jezero&task=astrobio`, { waitUntil: "load" });
    await page.getByText("Places still possible", { exact: true }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(3000);
    const levels = page.locator("button", { hasText: /^(Ignore|A little|Matters|Most)$/ });
    const count = await levels.count();
    for (let i = 0; i < (quick ? 8 : 24); i++) {
      await levels.nth((i * 5) % count).click();
      await page.waitForTimeout(250);
    }
    for (const t of ["Only new places", "Skip Antarctica", "Only new places", "Skip Antarctica"]) {
      await page.getByText(t).first().click();
      await page.waitForTimeout(400);
    }
    const ev = await page.evaluate(() => window.__ev.map(([, d]) => d));
    const sorted = [...ev].sort((a, b) => b - a);
    result.interactions["needs-step"] = { n: ev.length, inp_estimate: r1(sorted.length > 1 ? sorted[1] : (sorted[0] ?? 0)), p50: r1(pct(ev, 50)), max: r1(sorted[0] ?? 0) };
    await page.goto(`${BASE}/atlas?body=mars&spot=18.40,77.60`, { waitUntil: "load" });
    await page.locator("aside ol li").first().waitFor({ timeout: 60000 });
    await page.evaluate(() => (window.__ev = []));
    for (let i = 0; i < (quick ? 4 : 12); i++) {
      await page.getByRole("button", { name: i % 2 ? /Ground only/ : /AI match/ }).click();
      await page.waitForTimeout(400);
    }
    const ev2 = await page.evaluate(() => window.__ev.map(([, d]) => d));
    const s2 = [...ev2].sort((a, b) => b - a);
    result.interactions["twin-mode"] = { n: ev2.length, inp_estimate: r1(s2.length > 1 ? s2[1] : (s2[0] ?? 0)), p50: r1(pct(ev2, 50)), max: r1(s2[0] ?? 0) };
    console.log("interactions", JSON.stringify(result.interactions));
    await ctx.close();
  }

  // memory across in-app navigation
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    await page.addInitScript(INIT);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const heap = async () => page.evaluate(async () => { window.gc?.(); await new Promise((r) => setTimeout(r, 300)); window.gc?.(); return Math.round(performance.memory.usedJSHeapSize / 1048576); });
    const series = [await heap()];
    const nav = ["Find new sites", "Maps", "Compare", "How it works", "Home"];
    for (let loop = 0; loop < (quick ? 2 : 6); loop++) {
      for (const n of nav) {
        await page.locator("header").getByRole("link", { name: n, exact: true }).first().click();
        await page.waitForTimeout(2500);
      }
      series.push(await heap());
    }
    result.memory = { unit: "MB used JS heap after GC, at Home, after each loop of 5 routes", series, growth_after_first_loop: series.length > 2 ? series[series.length - 1] - series[1] : null };
    console.log("memory", JSON.stringify(result.memory));
    await ctx.close();
  }

  await browser.close();
  mkdirSync("docs/perf", { recursive: true });
  writeFileSync(`docs/perf/bench-${label}.json`, JSON.stringify(result, null, 1));
  console.log(`wrote docs/perf/bench-${label}.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
