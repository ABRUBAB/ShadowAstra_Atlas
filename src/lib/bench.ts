/**
 * Browser benchmark hook, loaded only with ?bench=1 (see src/main.tsx and tests/perf/bench.mjs).
 * Runs the real code paths on the real data and returns raw durations in milliseconds
 * (performance.now(), main thread, nothing but the computation unless the name says so).
 */
import { MINERAL_FAMILIES, loadGrid, rankPlaces, scoreAll } from "./grid";
import { defaultMission, homeKm, runSearch } from "./mission";
import { aiTwins, findTwins, spotTerrain } from "./twins";
import { TASK_WEIGHTS } from "./scoring";
import { TARGETS, TASKS } from "../data/sites";

declare global {
  interface Window {
    __atlasBench?: { run: (n?: number) => Promise<Record<string, number[]>> };
  }
}

const now = () => performance.now();

async function run(n = 200): Promise<Record<string, number[]>> {
  const g = await loadGrid();
  const out: Record<string, number[]> = { "score-all": [], search: [], rank: [], "twins-formula": [], "twins-ai": [], "mineral-pct-first": [] };
  const combos = TARGETS.flatMap((t) => t.tasks.slice(0, 2).map((task) => ({ t: g.targets[t.id], task })));
  // warm the JIT so the numbers describe steady use, not the first call
  for (let i = 0; i < 10; i++) scoreAll(g, { target: combos[i % combos.length].t, task: combos[i % combos.length].task });
  for (let i = 0; i < n; i++) {
    const c = combos[i % combos.length];
    const t0 = now();
    scoreAll(g, { target: c.t, task: c.task, weights: TASK_WEIGHTS[c.task] });
    out["score-all"].push(now() - t0);
  }
  const scores = scoreAll(g, { target: g.targets.jezero, task: "astrobio" });
  for (let i = 0; i < n; i++) {
    const t0 = now();
    rankPlaces(g, scores, { count: 30, spacingKm: 300 });
    out.rank.push(now() - t0);
  }
  const m = defaultMission("jezero", "astrobio");
  const dist = homeKm(g, m.home);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const task = TASKS[i % TASKS.length].id;
    const t0 = now();
    runSearch(g, { ...m, task, weights: TASK_WEIGHTS[task] }, dist);
    out.search.push(now() - t0);
  }
  const spot = await spotTerrain("mars", 18.4, 77.6);
  for (let i = 0; i < Math.ceil(n / 4); i++) {
    const t0 = now();
    findTwins(g, spot, 8, true);
    out["twins-formula"].push(now() - t0);
  }
  await aiTwins(g, "mars", 18.4, 77.6, 8); // band download once
  for (let i = 0; i < Math.ceil(n / 4); i++) {
    const t0 = now();
    await aiTwins(g, "mars", 18.4 + (i % 5), 77.6, 8);
    out["twins-ai"].push(now() - t0);
  }
  const t0 = now();
  for (const f of MINERAL_FAMILIES) g.mineralPct(f);
  out["mineral-pct-first"].push(now() - t0);
  return out;
}

export function install() {
  window.__atlasBench = { run };
}
