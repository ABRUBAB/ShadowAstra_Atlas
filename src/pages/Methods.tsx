import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useInView, useScroll, useSpring, useTransform } from "motion/react";
import clsx from "clsx";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleDashed, Database, Flame, Mountain, Scale, ShieldCheck, Snowflake, Sun, Target } from "lucide-react";
import { DATASET_URL, Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { hasWebGL } from "../components/ui/Safe";
import { Astronaut } from "../components/ui/Astronaut";
import { Counter, EASE, Kicker, Magnetic, RevealWords } from "../components/ui/kit";
import { Ablation, JobSlope, MixCurve, RankStrip, type SlopeRow, type StripPoint } from "../components/methods/Charts";
import { NewEvidence } from "../components/methods/NewEvidence";
import { MODEL_MIX, rankPlaces, scoreAll, topoSimilarity, useGrid, type Grid } from "../lib/grid";
import { sunRegime } from "../lib/sun";
import { useValidation, type Validation } from "../lib/validation";
import { useEarthThumb } from "../lib/thumbs";
import { useSmoothScroll } from "../lib/useSmoothScroll";
import type { Weights } from "../lib/scoring";

const DotGlobe = lazy(() => import("../components/methods/DotGlobe"));

/* ================================================================== data helpers */

function rank(a: ArrayLike<number>): Float32Array {
  const n = a.length;
  const v = Float32Array.from(a);
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((x, y) => v[x] - v[y]);
  const out = new Float32Array(n);
  for (let r = 0; r < n; r++) out[idx[r]] = r / (n - 1);
  return out;
}

const ONLY = (d: keyof Weights): Weights => ({ topography: 0, geology: 0, temperature: 0, lighting: 0, regolith: 0, [d]: 1 });

interface Layers {
  cold: Float32Array;
  regolith: Float32Array;
  shape: Float32Array;
  mission: Float32Array;
  model: Float32Array;
  final: Float32Array;
  rings: { lat: number; lon: number; color: string }[];
}

function heroLayer(g: Grid): Float32Array {
  const both = new Float32Array(g.n);
  const mm = g.arr("model_moon");
  const mr = g.arr("model_mars");
  for (let k = 0; k < g.n; k++) both[k] = Math.max(mm[k], mr[k]);
  return rank(both);
}

function buildLayers(g: Grid): Layers {
  const t = g.targets.jezero;
  const mr = g.arr("model_mars");
  const final = scoreAll(g, { target: t, task: "astrobio", modelMix: MODEL_MIX });
  const rings = rankPlaces(g, final, { count: 10, spacingKm: 300, onlyNew: true }).map((c) => ({ lat: c.lat, lon: c.lon, color: "#fff2d4" }));
  return {
    cold: rank(g.arr("i_cold")),
    regolith: rank(scoreAll(g, { target: t, task: "astrobio", weights: ONLY("regolith"), modelMix: 0 })),
    shape: rank(scoreAll(g, { target: t, task: "astrobio", weights: ONLY("topography"), modelMix: 0 })),
    mission: rank(scoreAll(g, { target: t, task: "astrobio", modelMix: 0 })),
    model: rank(mr),
    final: rank(final),
    rings,
  };
}

/* ================================================================== page */

export default function Methods() {
  useSmoothScroll();
  const { grid, progress } = useGrid();
  const { v } = useValidation();
  const hero = useMemo(() => (grid ? heroLayer(grid) : null), [grid]);
  const [layers, setLayers] = useState<Layers | null>(null);
  useEffect(() => {
    if (!grid) return;
    const run = () => setLayers(buildLayers(grid));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 600);
    return () => clearTimeout(id);
  }, [grid]);
  useEffect(() => {
    document.title = "How it works · ShadowAstra Atlas";
  }, []);
  return (
    <div className="bg-void">
      <Nav overlay />
      <Hero grid={grid} values={hero} progress={progress} v={v} />
      <Factors grid={grid} />
      <Story grid={grid} layers={layers} />
      <Proof v={v} grid={grid} />
      <NewEvidence v={v} grid={grid} />
      <Sources />
      <Rules />
      <Closing />
      <Footer />
    </div>
  );
}

/* ================================================================== hero */

function Hero({ grid, values, progress, v }: { grid: Grid | null; values: Float32Array | null; progress: number; v: Validation | null }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const testSites = (v?.independent.sites.length ?? 28) + 38;
  return (
    <section ref={ref} data-theme="dark" className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-void text-platinum">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_72%_42%,rgba(242,200,121,0.10),transparent_65%),radial-gradient(40%_50%_at_10%_90%,rgba(143,180,234,0.08),transparent_70%)]" />
      <motion.div style={{ y, opacity: fade }} className="absolute inset-y-0 right-[-18vw] w-[100vw] sm:right-[-10vw] lg:right-[-6vw] lg:w-[64vw]">
        <Suspense fallback={null}>
          <DotGlobe grid={grid} values={values} tint="#f2c879" startLon={30} className="h-full w-full" size={2.3} stillNote={false} />
        </Suspense>
        <AnimatePresence>
          {!grid && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center">
              <div className="relative grid size-[min(56vw,520px)] place-items-center rounded-full border border-line bg-[radial-gradient(circle_at_35%_35%,rgba(242,200,121,0.08),transparent_60%)]">
                <div className="font-mono text-[12px] tracking-[0.2em] text-chrome uppercase">Measuring Earth · {Math.round(progress * 100)}%</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />
      {/* phones: the globe sits behind the text, so shade it where the words are */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,10,0.9)_0%,rgba(7,8,10,0.6)_65%,rgba(7,8,10,0.2)_100%)] sm:hidden" />

      <div className="pointer-events-none relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 pt-28 pb-10 sm:px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">
          <span className="h-px w-8 bg-chrome/50" /> How it works
        </motion.div>
        <h1 className="mt-7 max-w-[760px] text-[clamp(44px,7vw,108px)] leading-[0.95] font-medium tracking-[-0.05em]">
          <RevealWords text="Open data in." />
          <br />
          <span className="font-serif font-normal tracking-[-0.02em] text-flare italic">
            <RevealWords text="Honest answers out." delay={0.25} />
          </span>
        </h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.6 }} className="mt-7 max-w-[520px] text-[17px] leading-relaxed text-chrome">
          Every dot is one of the {grid ? grid.n.toLocaleString() : "80,206"} land areas we measured with NASA data. The brighter it glows, the more it is like the Moon or Mars.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.8 }} className="pointer-events-auto mt-9 flex w-fit flex-wrap gap-3">
          <Magnetic>
            <a href="#factors" className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium">
              See how <ArrowDown size={16} />
            </a>
          </Magnetic>
          <Link to="/discover" className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-void/40 px-6 py-3.5 text-[14px] text-platinum backdrop-blur hover:border-chrome">
            Try it on a mission <ArrowRight size={15} />
          </Link>
        </motion.div>
      </div>

      <motion.dl initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 1 }} className="relative mx-auto grid w-full max-w-[1400px] grid-cols-2 border-t border-line/70 md:grid-cols-4">
        {(
          [
            [grid?.n ?? 80206, "places measured"],
            [24, "measurements each"],
            [18, "Moon and Mars targets"],
            [testSites, "real sites to test against"],
          ] as const
        ).map(([n, l]) => (
          <div key={l} className="flex flex-col-reverse border-line/70 px-4 py-6 sm:px-6 [&:not(:last-child)]:border-r">
            <dt className="mt-2 text-[12.5px] text-dim">{l}</dt>
            <dd className="font-mono text-[clamp(28px,3.2vw,44px)] leading-none font-light">
              <Counter value={n} />
            </dd>
          </div>
        ))}
      </motion.dl>
      <div className="pointer-events-none absolute right-4 bottom-28 hidden xl:block">
        <div className="pointer-events-auto">
          <Astronaut size={92} mood="happy" action="point" say={hasWebGL() ? "Drag the globe. Every dot is real data." : "Every place below is real NASA data."} sayAlign="left" />
        </div>
      </div>
    </section>
  );
}

/* ================================================================== four factors */

function FactorCard({ i, icon: Icon, title, line, chips, formula, children }: { i: number; icon: typeof Sun; title: string; line: string; chips: string[]; formula: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }}
      className="surface lift group flex flex-col overflow-hidden rounded-3xl"
    >
      <div className="relative h-[190px] border-b border-line bg-ink/60">{children}</div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-line-2 text-flare">
            <Icon size={17} strokeWidth={1.6} />
          </span>
          <span className="font-mono text-[11px] text-dim">0{i + 1}</span>
        </div>
        <h3 className="mt-4 text-[21px] font-medium tracking-[-0.02em]">{title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-chrome">{line}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-line-2 px-2.5 py-0.5 text-[11px] text-chrome">
              {c}
            </span>
          ))}
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-left text-[12.5px] text-chrome hover:text-platinum">
          <ChevronDown size={14} className={clsx("transition-transform", open && "rotate-180")} /> {open ? "Hide the math" : "See the math"}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden">
              <div className="mt-3 rounded-xl border border-line bg-void px-3.5 py-3 font-mono text-[12px] leading-relaxed text-flare">{formula}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

function SlopeViz({ grid }: { grid: Grid | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-40px" });
  const data = useMemo(() => {
    if (!grid) return null;
    const t = grid.targets.jezero;
    const k = grid.cellAt(-24.08, -70.0);
    const h = grid.hist(k);
    return { earth: h, mars: t.terrain.hist, sim: topoSimilarity(h, grid.value("f_relief", k) ?? 1, t) };
  }, [grid]);
  return (
    <div ref={ref} className="absolute inset-0 flex flex-col justify-end px-6 pt-5 pb-4">
      <div className="flex items-center justify-between text-[11px] text-dim">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-chart-2)]" /> Atacama, Earth
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-chart-3)]" /> Jezero, Mars
        </span>
      </div>
      <div className="mt-3 flex h-[104px] items-end gap-2">
        {Array.from({ length: 8 }, (_, b) => (
          <div key={b} className="flex h-full flex-1 items-end gap-[2px]">
            {(["earth", "mars"] as const).map((w, j) => {
              const val = data ? data[w][b] : 0;
              return (
                <motion.span
                  key={w}
                  className="block flex-1 rounded-t-[4px]"
                  style={{ background: j ? "var(--color-chart-3)" : "var(--color-chart-2)" }}
                  initial={{ height: 0 }}
                  animate={{ height: seen && data ? `${Math.max(2, Math.sqrt(val) * 100)}%` : 0 }}
                  transition={{ duration: 1, ease: EASE, delay: b * 0.05 + j * 0.1 }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-dim">
        <span>flat</span>
        <span>{data ? `alike: ${data.sim.toFixed(2)} of 1` : ""}</span>
        <span>steep</span>
      </div>
    </div>
  );
}

function RocksViz() {
  const items = [
    { n: 1214, l: "volcanoes", c: "var(--color-chart-3)" },
    { n: 65, l: "impact craters", c: "var(--color-chart-1)" },
    { n: 16, l: "rock types", c: "var(--color-chart-2)" },
  ];
  return (
    <div className="absolute inset-0 grid grid-cols-3 items-center px-4">
      {items.map((it, i) => (
        <div key={it.l} className="text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 220, damping: 18, delay: i * 0.12 }} className="mx-auto grid size-[62px] place-items-center rounded-full border border-line-2" style={{ boxShadow: `inset 0 0 28px -8px ${it.c}` }}>
            <span className="font-mono text-[17px] text-platinum">
              <Counter value={it.n} />
            </span>
          </motion.div>
          <div className="mt-2 text-[11.5px] text-chrome">{it.l}</div>
        </div>
      ))}
    </div>
  );
}

function SunViz() {
  const moon = useMemo(() => sunRegime("moon", -89.67), []);
  const earth = useMemo(() => sunRegime("earth", 78.2), []);
  const arcs = [
    { label: `Svalbard, Earth: up to ${Math.round(earth.maxElev)}°`, e: earth.maxElev, c: "var(--color-chart-2)" },
    { label: `Shackleton, Moon: up to ${moon.maxElev.toFixed(1)}°`, e: moon.maxElev, c: "var(--color-chart-1)" },
  ];
  const W = 300;
  const base = 150;
  return (
    <div className="absolute inset-0 px-5 pt-4">
      <svg viewBox={`0 0 ${W} 170`} className="h-full w-full" role="img" aria-label="Highest Sun at a Moon pole and on Earth">
        <line x1={10} x2={W - 10} y1={base} y2={base} style={{ stroke: "var(--color-line-2)" }} />
        {arcs.map((a, i) => {
          const h = Math.max(6, Math.min(62, a.e * 1.6));
          const d = `M 22 ${base} Q ${W / 2} ${base - h * 2} ${W - 22} ${base}`;
          return (
            <g key={a.label}>
              <motion.path d={d} fill="none" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE, delay: i * 0.2 }} style={{ stroke: a.c, strokeWidth: 2, strokeLinecap: "round" }} />
              <circle r={5} style={{ fill: a.c, stroke: "var(--color-panel)", strokeWidth: 2 }}>
                <animateMotion dur={`${6 + i * 2}s`} repeatCount="indefinite" path={d} />
              </circle>
              <text x={W / 2} y={base - h - 8} textAnchor="middle" style={{ fill: "var(--color-chrome)", fontSize: 10.5 }}>
                {a.label}
              </text>
            </g>
          );
        })}
        <text x={14} y={base + 15} style={{ fill: "var(--color-dim)", fontSize: 10 }}>
          horizon
        </text>
      </svg>
    </div>
  );
}

function DryViz({ grid }: { grid: Grid | null }) {
  const rows = useMemo(() => {
    if (!grid) return null;
    const at = (la: number, lo: number) => grid.value("f_precip", grid.cellAt(la, lo)) ?? 0;
    return [
      { l: "Atacama, Chile", v: at(-24.08, -70.0) },
      { l: "Dry Valleys, Antarctica", v: at(-77.5, 161.8) },
      { l: "Dhaka, Bangladesh", v: at(23.81, 90.41) },
    ];
  }, [grid]);
  const max = Math.log10(4000);
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3.5 px-6">
      <div className="text-[11px] text-dim">Rain and snow per year</div>
      {(rows ?? [{ l: "Loading…", v: 0 }]).map((r, i) => (
        <div key={r.l}>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-chrome">{r.l}</span>
            <span className="font-mono text-platinum">{rows ? `${Math.round(r.v).toLocaleString()} mm` : ""}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <motion.div className="h-full rounded-full bg-[var(--color-chart-2)]" initial={{ width: 0 }} whileInView={{ width: rows ? `${Math.max(3, (Math.log10(Math.max(1, r.v)) / max) * 100)}%` : 0 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE, delay: i * 0.1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Factors({ grid }: { grid: Grid | null }) {
  return (
    <section id="factors" className="relative border-t border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Kicker n="01">Four questions</Kicker>
            <h2 className="mt-6 max-w-[860px] text-[clamp(32px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.04em]">
              The challenge names four things. <span className="font-serif font-normal text-chrome italic">We measure each one.</span>
            </h2>
          </div>
          <p className="max-w-[340px] text-[14px] leading-relaxed text-chrome">The same measurements, at the same 50 km scale, on Earth, the Moon and Mars. Every number below is real.</p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FactorCard i={0} icon={Mountain} title="Ground shape" line="Slopes and height range across 50 km." chips={["SRTM", "LRO LOLA 118 m", "MGS MOLA 463 m"]} formula={<>0.65 · overlap(slopes) + 0.35 · (1 − |log₁₀ height-range ratio|)</>}>
            <SlopeViz grid={grid} />
          </FactorCard>
          <FactorCard i={1} icon={Flame} title="Rocks & craters" line="Volcanic ground, impact craters, bare rock and the main rock type." chips={["Smithsonian GVP", "Earth Impact Database", "GLiM"]} formula={<>Lava tubes: 0.85 · volcano + 0.15 · bare<br />Craters: 0.85 · crater + 0.15 · bare<br />Other jobs mix volcano, crater, bare and dry</>}>
            <RocksViz />
          </FactorCard>
          <FactorCard i={2} icon={Sun} title="Cold & light" line="Night cold, the day and night swing, and how high the Sun climbs." chips={["MODIS LST", "NASA POWER", "Sun geometry"]} formula={<>Cold: 0.55 · cold + 0.45 · swing<br />Light: 1 − W₁(Sun heights) / 25°</>}>
            <SunViz />
          </FactorCard>
          <FactorCard i={3} icon={Snowflake} title="Ice & loose ground" line="Rain, plants, snow and ice: what the ground is and what you could dig." chips={["NASA POWER", "MODIS NDVI", "MODIS snow"]} formula={<>Loose ground: 0.6 · bare + 0.4 · dry<br />Ice jobs: 0.6 · cold + 0.4 · ice</>}>
            <DryViz grid={grid} />
          </FactorCard>
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-dashed border-line-2 px-5 py-4 text-[13px] text-chrome">
          <span className="text-platinum">Earth can't copy:</span>
          <span>gravity</span>
          <span className="text-dim">·</span>
          <span>vacuum</span>
          <span className="text-dim">·</span>
          <span>space radiation</span>
          <span className="ml-auto text-[12px] text-dim">Shown next to every score, never added in.</span>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== story (sticky globe) */

const STORY = [
  { id: "cold", t: "Measure every place", d: "Coldest night ground temperature, for all 80,206 land areas.", src: "NASA MODIS", tint: "#8fb4ea", lo: "warm", hi: "cold" },
  { id: "regolith", t: "Find bare, dry ground", d: "Little rain and few plants, so rock and soil show, like regolith.", src: "NASA POWER · MODIS", tint: "#e08a5f", lo: "green", hi: "bare" },
  { id: "shape", t: "Compare the ground", d: "Slopes and height range next to Jezero crater on Mars.", src: "SRTM · MGS MOLA", tint: "#edeae4", lo: "different", hi: "alike" },
  { id: "mission", t: "Weigh it for the job", d: "Looking for signs of life? Rocks and dryness count most.", src: "Five factors", tint: "#f2c879", lo: "poor", hi: "strong" },
  { id: "model", t: "Ask what experts chose", d: "A model learned from 38 places NASA, ESA and others use.", src: "3-model ensemble · 8 bags", tint: "#f2c879", lo: "unlike", hi: "alike" },
  { id: "final", t: "Shortlist new places", d: "60% model, 40% factors. 300 km apart. Known sites left out.", src: "Top 10 for Jezero", tint: "#f2c879", lo: "", hi: "" },
] as const;

function StoryStep({ i, active, onActive }: { i: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48% 0px -48% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  const s = STORY[i];
  return (
    <div ref={ref} className="flex min-h-[78vh] items-center py-10 lg:min-h-[86vh]">
      <motion.div animate={{ opacity: active ? 1 : 0.32, x: active ? 0 : -6 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-[420px] rounded-3xl border border-line bg-panel/70 p-6 backdrop-blur-md lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="font-mono text-[12px] text-flare">{String(i + 1).padStart(2, "0")}</div>
        <h3 className="mt-2 text-[clamp(26px,2.8vw,40px)] leading-[1.05] font-medium tracking-[-0.03em]">{s.t}</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-chrome">{s.d}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] text-dim">
          {s.lo && (
            <span className="inline-flex items-center gap-2">
              {s.lo}
              <span className="h-1.5 w-20 rounded-full" style={{ background: `linear-gradient(90deg, #2b2d34, ${s.tint})` }} />
              {s.hi}
            </span>
          )}
          <span className="rounded-full border border-line-2 px-2.5 py-0.5">{s.src}</span>
        </div>
      </motion.div>
    </div>
  );
}

function Story({ grid, layers }: { grid: Grid | null; layers: Layers | null }) {
  const [active, setActive] = useState(0);
  const s = STORY[active];
  const values = layers ? layers[s.id] : null;
  return (
    <section data-theme="dark" className="relative border-t border-line bg-void px-4 text-platinum sm:px-6">
      <div className="mx-auto max-w-[1400px] pt-28">
        <Kicker n="02">One mission, step by step</Kicker>
        <h2 className="mt-6 max-w-[880px] text-[clamp(32px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.04em]">
          Where on Earth is like Jezero crater? <span className="font-serif font-normal text-chrome italic">Watch the planet answer.</span>
        </h2>
      </div>
      <div className="relative mx-auto grid max-w-[1400px] lg:grid-cols-[0.8fr_1.2fr]">
        <div className="sticky top-16 z-0 order-1 h-[46vh] lg:order-2 lg:h-[calc(100dvh-64px)]">
          <Suspense fallback={null}>
            <DotGlobe grid={grid} values={values} tint={s.tint} startLon={60} tilt={0.42} spin={0.035} className="h-full w-full" size={2.4} rings={s.id === "final" ? layers?.rings : undefined} />
          </Suspense>
          <div className="pointer-events-none absolute right-2 bottom-4 left-2 flex justify-center lg:bottom-10">
            <AnimatePresence mode="wait">
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="rounded-full border border-line-2 bg-void/70 px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] text-chrome uppercase backdrop-blur">
                {String(active + 1).padStart(2, "0")} · {s.t}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="relative z-10 order-2 lg:order-1">
          {STORY.map((_, i) => (
            <StoryStep key={i} i={i} active={i === active} onActive={setActive} />
          ))}
          <div className="h-[20vh]" />
        </div>
      </div>
    </section>
  );
}

/* ================================================================== proof */

const WHY_LOW: Record<string, string> = {
  dachstein: "Chosen for ice caves under green alpine forest. Our 55 km cells see the forest, not the cave.",
  lofoten: "Chosen for its rock, which is like the Moon's highlands. The coast is wet and green, and rock types are not scored yet.",
  "pavilion-lake": "Chosen for living rock-like structures in a small lake inside a forest, far smaller than our cells.",
  kangerlussuaq: "An ice-margin town. The ice sheet next to it scores higher, so the site itself sits in the middle.",
  kobuk: "Cold sand dunes inside boreal forest. The dunes are small; the forest is not.",
  yellowstone: "Hot springs inside a forested plateau. The springs are tiny on a 55 km scale.",
  "rio-grande-gorge": "A narrow gorge cut into a wide grassy plateau.",
  barberton: "Very old rocks in a green, wet landscape.",
  uzon: "Hot springs in a cold, green caldera.",
  kaunertal: "A glacier in the green Alps.",
};

function StatTile({ value, label, sub, delay = 0 }: { value: ReactNode; label: string; sub?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay }} className="surface rounded-2xl p-6">
      <div className="text-[13px] text-chrome">{label}</div>
      <div className="mt-2 text-[clamp(36px,4vw,52px)] leading-none font-medium tracking-[-0.03em] text-platinum">{value}</div>
      {sub && <div className="mt-2 text-[12px] leading-snug text-dim">{sub}</div>}
    </motion.div>
  );
}

function FailCard({ s, i }: { s: Validation["independent"]["sites"][number]; i: number }) {
  const thumb = useEarthThumb(s.lat, s.lon, 320, 50);
  return (
    <motion.article initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }} className="surface overflow-hidden rounded-2xl">
      <div className="relative aspect-[16/9] bg-ink">
        {thumb && <img src={thumb} alt={`${s.name}, satellite view 50 km across`} className="h-full w-full object-cover" />}
        <span className="absolute top-3 left-3 rounded-full bg-void/80 px-2.5 py-1 font-mono text-[11px] text-platinum backdrop-blur">top {Math.round(s.blend)}%</span>
      </div>
      <div className="p-5">
        <div className="text-[15px] text-platinum">{s.name}</div>
        <div className="mt-0.5 text-[11.5px] text-dim">{s.source}</div>
        <p className="mt-3 text-[13px] leading-relaxed text-chrome">{WHY_LOW[s.id] ?? "Chosen for a feature much smaller than our 55 km cells."}</p>
      </div>
    </motion.article>
  );
}

function Proof({ v, grid }: { v: Validation | null; grid: Grid | null }) {
  const [world, setWorld] = useState<"all" | "moon" | "mars">("all");
  const sites = useMemo(() => (v ? v.independent.sites.filter((s) => world === "all" || s.world === world) : []), [v, world]);
  const points: StripPoint[] = sites.map((s) => ({ id: s.id, name: s.name, sub: s.source, values: { model: s.model, blend: s.blend, formula: s.formula, baseline: s.baseline } }));
  const sum = v ? v.independent[world] : null;
  const medians = sum
    ? {
        model: sum.model && { median: sum.model.median, ci: sum.model.ci },
        blend: sum.blend && { median: sum.blend.median, ci: sum.blend.ci },
        formula: sum.formula && { median: sum.formula.median, ci: sum.formula.ci },
        baseline: sum.baseline && { median: sum.baseline.median, ci: sum.baseline.ci },
      }
    : {};
  const slope: SlopeRow[] = useMemo(() => {
    if (!v) return [];
    const names = new Map<string, string>([
      ...v.independent.sites.map((s) => [s.id, s.name] as [string, string]),
      ...v.known.rows.map((r) => [`${r.id}:${r.world}`, `${r.name} (${r.world === "moon" ? "Moon" : "Mars"})`] as [string, string]),
    ]);
    return v.jobs.rows.map((r) => ({ id: r.id, name: names.get(r.id) ?? r.id, own: r.own, other: r.other }));
  }, [v]);
  const known60 = v?.mixing?.curve.find((c) => Math.abs(c.mix - MODEL_MIX) < 0.01);
  const robust = v ? [...v.robustness].map((r) => r.weights_top10).sort((a, b) => a - b)[Math.floor(v.robustness.length / 2)] : null;
  const fails = v ? [...v.independent.sites].sort((a, b) => b.blend - a.blend).slice(0, 3) : [];
  const abl = v
    ? (
        [
          ["topography", "Ground shape"],
          ["geology", "Rocks & craters"],
          ["temperature", "Cold & heat"],
          ["lighting", "Sunlight angle"],
          ["regolith", "Bare, dry ground"],
        ] as const
      ).map(([id, label]) => ({
        label,
        delta: Math.round((v.ablation[id].known_median - v.ablation.full.known_median) * 10) / 10,
        detail: `Known sites: typical rank top ${v.ablation.full.known_median}% with it, top ${v.ablation[id].known_median}% without. New test sites: ${v.ablation.full.independent_median}% vs ${v.ablation[id].independent_median}%.`,
      }))
    : [];
  return (
    <section className="relative border-t border-line bg-ink px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Kicker n="03">The proof</Kicker>
            <h2 className="mt-6 max-w-[900px] text-[clamp(32px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.04em]">
              We tested it on places <span className="font-serif font-normal text-flare italic">it never saw.</span>
            </h2>
          </div>
          <div className="hidden md:block">
            <Astronaut size={96} mood="focused" action="scan" say="Smaller is better: top 1% beats 99% of land." sayAlign="left" />
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <StatTile
            value={
              v?.independent.moon.blend ? (
                <>
                  top <Counter value={v.independent.moon.blend.median} decimals={1} />%
                </>
              ) : (
                "…"
              )
            }
            label="New Moon test sites"
            sub="Typical rank among all 80,206 land areas, as the site shows it. None were used for training."
          />
          <StatTile
            delay={0.08}
            value={
              known60 ? (
                <>
                  top <Counter value={known60.known_median} decimals={1} />%
                </>
              ) : (
                "…"
              )
            }
            label="Hidden known sites"
            sub="Each site and its neighbours within 300 km hidden, then the model retrained."
          />
          <StatTile
            delay={0.16}
            value={
              robust !== null ? (
                <>
                  <Counter value={Math.round(robust * 10)} /> of 10
                </>
              ) : (
                "…"
              )
            }
            label="Top places that stay when weights shift ±25%"
            sub="Typical over eight missions, 60 random shifts each."
          />
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12">
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">28 published sites, kept out of training</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">From the Austrian Space Forum, ISRO, Europlanet, NASA teams and Apollo training. Each dot is one site; the white line is the typical rank.</p>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              The learned model finds them best. The mission factors alone do about as well as a simple rule: their job is to explain <em>why</em> a place matches and to tune it to your target and job.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-line-2 p-1 text-[12px]">
              {(["all", "moon", "mars"] as const).map((w) => (
                <button key={w} onClick={() => setWorld(w)} aria-pressed={world === w} className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1 capitalize transition-colors", world === w ? "bg-platinum text-void" : "text-chrome hover:text-platinum")}>
                  {w !== "all" && <WorldDot world={w} />} {w === "all" ? "All 28" : w}
                </button>
              ))}
            </div>
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{v ? <RankStrip points={points} rows={["model", "blend", "formula", "baseline"]} medians={medians} /> : <ChartWait />}</div>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12">
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">How much should the model count?</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              We let the 38 known sites speak, then only checked the new ones. More model finds hidden sites better
              {v?.mixing ? `, and the known sites alone would pick ${Math.round(v.mixing.best_on_known * 100)}%` : ""}. But the model knows nothing about your target or job, and at that share your choices would hardly change the list, so we keep {Math.round(MODEL_MIX * 100)}%. You can change it in step 3 of Find new sites.
            </p>
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{v?.mixing ? <MixCurve curve={v.mixing.curve} shipped={MODEL_MIX} /> : <ChartWait />}</div>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12">
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">The job matters</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">Each line is a site, scored for the jobs it was really used for and for all the other jobs.</p>
            {v && (
              <div className="mt-6 flex items-end gap-6">
                <div>
                  <div className="text-[44px] leading-none font-medium tracking-[-0.03em] text-platinum">
                    <Counter value={v.jobs.better_share} decimals={0} suffix="%" />
                  </div>
                  <div className="mt-1 text-[12px] text-chrome">rank higher with their own job</div>
                </div>
                <div className="pb-1 font-mono text-[12px] text-dim">
                  {v.jobs.rows.length} sites
                  {v.jobs.sign_test_p !== null && <> · p {v.jobs.sign_test_p < 0.001 ? "< 0.001" : `= ${v.jobs.sign_test_p.toFixed(3)}`}</>}
                </div>
              </div>
            )}
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{v ? <JobSlope rows={slope} /> : <ChartWait />}</div>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12">
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">What each factor adds</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">Take one factor out and see how the known sites move. Many famous analog sites are volcanoes and craters in green land, so bare ground pulls them down. We keep it, because bare ground matters for driving and digging, and you can turn it off.</p>
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{v ? <Ablation rows={abl} /> : <ChartWait />}</div>
        </div>

        {v?.model_zoo && <ModelZoo zoo={v.model_zoo} />}

        <div className="mt-20">
          <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">Where it fails, and why</h3>
          <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-chrome">The three test sites it ranks lowest. Each was chosen for something small inside a green landscape.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">{fails.length ? fails.map((s, i) => <FailCard key={s.id} s={s} i={i} />) : [0, 1, 2].map((i) => <div key={i} className="surface h-[300px] rounded-2xl" />)}</div>
        </div>

        {grid && <ModelLooks grid={grid} />}
      </div>
    </section>
  );
}

/** Nine models under the same two tests (Kaggle K5). Best value per column marked. */
function ModelZoo({ zoo }: { zoo: NonNullable<Validation["model_zoo"]> }) {
  const bestH = Math.min(...zoo.rows.map((r) => r.hidden));
  const bestI = Math.min(...zoo.rows.map((r) => r.independent ?? 1e9));
  const max = 40;
  return (
    <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12">
      <div>
        <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">Nine models, one honest test</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-chrome">
          On Kaggle we trained gradient-boosted trees, a linear model, a positive-unlabelled neural network and a nearest-site baseline, tuned the best with Optuna on the known sites only, then checked the 28 new sites once. {Math.round(zoo.minutes / 60)} hours of computing.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-chrome">The ensemble wins both tests, so it is now the learned model on the site. The neural network did not work with only 38 examples, and we show that too.</p>
      </div>
      <div className="surface overflow-x-auto rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-chrome">
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--color-chart-1)]" /> Hidden known sites</span>
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--color-chart-2)]" /> 28 new sites</span>
          <span className="text-dim">typical rank, top % of land, shorter is better</span>
        </div>
        <table className="w-full min-w-[520px] text-left text-[12.5px]">
          <tbody>
            {zoo.rows.map((r, i) => (
              <tr key={r.id} className="border-t border-line">
                <td className={clsx("py-2 pr-3", r.id === zoo.chosen ? "text-platinum" : "text-chrome")}>
                  {r.name}
                  {r.id === zoo.chosen && <span className="ml-2 rounded-full border border-flare/40 px-1.5 py-0.5 text-[10px] text-flare">chosen</span>}
                </td>
                {(["hidden", "independent"] as const).map((key) => {
                  const val = r[key];
                  const best = key === "hidden" ? val === bestH : val === bestI;
                  return (
                    <td key={key} className="w-[38%] py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                          <motion.span className="block h-full rounded-r-[4px]" style={{ background: key === "hidden" ? "var(--color-chart-1)" : "var(--color-chart-2)" }} initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, ((val ?? 0) / max) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.04 }} />
                        </span>
                        <span className={clsx("w-14 text-right font-mono tabular-nums", best ? "text-platinum" : "text-dim")}>{val === null ? "n/a" : `${val.toFixed(1)}%`}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartWait() {
  return <div className="grid h-[260px] place-items-center text-[12px] text-dim">Loading the test results…</div>;
}

const FEATURE: Record<string, string> = {
  volcanic: "Volcanoes nearby",
  impact: "Impact craters",
  lst_night_min: "Night cold",
  lst_day_max: "Day heat",
  rough: "Rough ground",
  ndvi: "Few plants",
  barren: "Bare ground",
  slope90: "Steep slopes",
  lat_abs: "Distance from equator",
  relief: "Height range",
  elev: "Height",
  slope: "Average slope",
  precip: "Rain",
  rh: "Humidity",
  t_max: "Hot air",
  t_min: "Cold air",
  t_mean: "Average air",
  snowice: "Snow and ice",
  shrub: "Shrubland",
  forest: "Forest",
  sun: "Sunshine",
  lst_range: "Day to night swing",
  snow_months: "Snowy months",
  lith_volcanic: "Volcanic rock",
  lith_plutonic: "Granite-type rock",
  lith_sediment: "Sedimentary rock",
  lith_salt: "Salt rock",
  lith_meta: "Metamorphic rock",
  lith_ice: "Ice sheet",
};

function ModelLooks({ grid }: { grid: Grid }) {
  return (
    <div className="mt-20 grid gap-4 md:grid-cols-2">
      {(["moon", "mars"] as const).map((w, j) => {
        const ev = grid.meta.evaluation[w];
        return (
          <motion.div key={w} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: j * 0.08 }} className="surface rounded-2xl p-6">
            <div className="flex items-center gap-2 text-[14px] text-platinum">
              <WorldDot world={w} /> What the {w === "moon" ? "Moon" : "Mars"} model looks at most
            </div>
            <ul className="mt-4 space-y-2.5">
              {ev.importance.slice(0, 6).map(([f, x], i) => (
                <li key={f} className="grid grid-cols-[150px_1fr_44px] items-center gap-3 text-[12.5px]">
                  <span className="text-chrome">{FEATURE[f] ?? f}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-line">
                    <motion.span className="block h-full rounded-r-[4px]" style={{ background: "var(--color-chart-1)" }} initial={{ width: 0 }} whileInView={{ width: `${(x / ev.importance[0][1]) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE, delay: i * 0.06 }} />
                  </span>
                  <span className="text-right font-mono text-[11px] text-dim">{Math.round(x * 100)}%</span>
                </li>
              ))}
            </ul>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ================================================================== sources */

type Status = "live" | "planned";
interface Source {
  body: "earth" | "moon" | "mars";
  name: string;
  agency: string;
  use: string;
  res: string;
  status: Status;
  link: string;
}

const SOURCES: Source[] = [
  { body: "earth", name: "NASA POWER climatology", agency: "NASA LaRC (MERRA-2)", use: "Air temperature, coldest and hottest months, rain, humidity, sunshine", res: "0.5°", status: "live", link: "https://power.larc.nasa.gov/" },
  { body: "earth", name: "MODIS land surface temperature", agency: "NASA GIBS · Terra MODIS", use: "Coldest night and hottest day ground temperature, 2024", res: "~4 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "MODIS NDVI, snow and land cover", agency: "NASA GIBS · Terra MODIS", use: "Plants, snow months, bare ground, ice, cities and farms", res: "~1 to 5 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "SRTM-based Terrain Tiles", agency: "NASA SRTM · AWS Open Data", use: "Slopes, height range and roughness for every land area; 3D ground", res: "~30 m source", status: "live", link: "https://registry.opendata.aws/terrain-tiles/" },
  { body: "earth", name: "Holocene volcano list", agency: "Smithsonian GVP", use: "Distance to 1,214 volcanoes active in the last 12,000 years", res: "points", status: "live", link: "https://volcano.si.edu/" },
  { body: "earth", name: "Confirmed impact craters", agency: "Earth Impact Database (PASSC)", use: "65 craters with their sizes", res: "points", status: "live", link: "http://www.passc.net/EarthImpactDatabase/" },
  { body: "earth", name: "GLiM rock map", agency: "Hartmann & Moosdorf 2012", use: "Main rock type of every land area (shown and tested, not yet scored)", res: "0.5°", status: "live", link: "https://doi.org/10.1594/PANGAEA.788537" },
  { body: "earth", name: "Sentinel-2 cloudless 2020", agency: "ESA Copernicus · EOX", use: "True-colour imagery, 3D drape, the Earth or Mars game", res: "10 m", status: "live", link: "https://s2maps.eu" },
  { body: "earth", name: "Blue Marble, ASTER relief", agency: "NASA GIBS · NASA/METI", use: "Globe, polar imagery, shaded relief", res: "30 m to 1 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "Natural Earth", agency: "Public domain", use: "Country, region and town names for every place", res: "1:10 m", status: "live", link: "https://www.naturalearthdata.com/" },
  { body: "earth", name: "Official 2026 challenge datasets", agency: "NASA + partner agencies", use: "Released 28 October; we add them to the same pipeline", res: "various", status: "planned", link: "https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/" },
  { body: "earth", name: "EMIT surface minerals (L3 ASA v2)", agency: "NASA / JPL · LP DAAC", use: "Clays, sulfates, carbonates and iron oxides in dry, bare land; Mars mineral match", res: "0.5° from 60 m", status: "live", link: "https://doi.org/10.5067/EMIT/EMITL3ASA.002" },
  { body: "moon", name: "LRO LOLA global DEM (16-bit)", agency: "NASA · USGS Astrogeology", use: "Full-precision slopes and height range for Moon targets", res: "118 m", status: "live", link: "https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m" },
  { body: "moon", name: "LOLA tiles and polar hillshade", agency: "NASA Solar System Treks", use: "3D ground, shadow map, polar map", res: "118 to 237 m", status: "live", link: "https://trek.nasa.gov/moon/" },
  { body: "moon", name: "LROC WAC mosaic", agency: "NASA / ASU", use: "Visible imagery, 3D drape, game", res: "100 m", status: "live", link: "https://lroc.im-ldi.com/" },
  { body: "moon", name: "LROC lunar pits", agency: "NASA / ASU", use: "278 pits and skylights for cave missions", res: "points", status: "live", link: "https://lroc.im-ldi.com/" },
  { body: "moon", name: "LRO Diviner polar resources", agency: "NASA / UCLA · PDS", use: "Average and warmest ground temperature and stable ice near the south-pole targets", res: "0.5 km", status: "live", link: "https://pds-geosciences.wustl.edu/missions/lro/diviner.htm" },
  { body: "mars", name: "MGS MOLA global DEM (16-bit)", agency: "NASA · USGS Astrogeology", use: "Full-precision slopes and height range for Mars targets", res: "463 m", status: "live", link: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" },
  { body: "mars", name: "Viking MDIM 2.1", agency: "NASA / USGS", use: "Colour imagery, 3D drape, game", res: "232 m", status: "live", link: "https://astrogeology.usgs.gov/" },
  { body: "mars", name: "MGS TES mineral maps", agency: "NASA / ASU", use: "Olivine, pyroxene, hematite, clays, dust and thermal inertia", res: "~7 km", status: "live", link: "https://jmars.mars.asu.edu/" },
  { body: "mars", name: "Mars craters and geology", agency: "Robbins catalogue · USGS SIM 3292", use: "384,343 craters and 1,311 geologic units", res: "points · 1:20M", status: "live", link: "https://astrogeology.usgs.gov/" },
  { body: "mars", name: "Human landing Exploration Zones", agency: "NASA · USGS CTX mosaics", use: "39 candidate zones for the first crews", res: "zones", status: "live", link: "https://astrogeology.usgs.gov/" },
  { body: "mars", name: "Mars Odyssey GRS water", agency: "NASA / U. Arizona · PDS", use: "Water-equivalent hydrogen in the topsoil at each Mars target", res: "5°", status: "live", link: "https://pds-geosciences.wustl.edu/missions/odyssey/grs.htm" },
  { body: "mars", name: "MRO HiRISE DTMs", agency: "NASA / UArizona", use: "Wheel-scale slopes for landing sites", res: "1 m", status: "planned", link: "https://www.uahirise.org/dtm/" },
];

function Sources() {
  const [all, setAll] = useState(false);
  const cols = (["earth", "moon", "mars"] as const).map((b) => ({ b, list: SOURCES.filter((s) => s.body === b) }));
  return (
    <section className="border-t border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="05">Every dataset</Kicker>
        <h2 className="mt-6 max-w-[900px] text-[clamp(32px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.04em]">
          NASA first, <span className="font-serif font-normal text-chrome italic">checked against other agencies.</span>
        </h2>
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {cols.map(({ b, list }, ci) => (
            <motion.div key={b} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: ci * 0.08 }} className="surface rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[16px] text-platinum">
                  <WorldDot world={b} /> {b === "earth" ? "Earth" : b === "moon" ? "The Moon" : "Mars"}
                </span>
                <span className="font-mono text-[11px] text-dim">{list.filter((s) => s.status === "live").length} in use</span>
              </div>
              <ul className="mt-5 space-y-2">
                {list.map((s) => (
                  <li key={s.name}>
                    <a href={s.link} target="_blank" rel="noreferrer" className={clsx("group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors", s.status === "live" ? "border-line hover:border-line-2 hover:bg-platinum/[0.03]" : "border-dashed border-line-2/80")}>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-platinum group-hover:text-flare">{s.name}</span>
                        <span className="block truncate text-[11px] text-dim">{s.agency}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10.5px] text-chrome">{s.res}</span>
                        {s.status === "live" ? <Check size={13} className="text-strong" aria-label="In use" /> : <CircleDashed size={13} className="text-dim" aria-label="Next" />}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
        <button onClick={() => setAll((x) => !x)} className="mt-6 inline-flex items-center gap-2 text-[13px] text-chrome hover:text-platinum" aria-expanded={all}>
          <Database size={14} /> {all ? "Hide what each dataset is used for" : "What each dataset is used for"} <ChevronDown size={14} className={clsx("transition-transform", all && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {all && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="overflow-hidden">
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                {SOURCES.map((s) => (
                  <div key={s.name} className="grid gap-1 border-t border-line px-5 py-3 text-[13px] first:border-t-0 md:grid-cols-[90px_1.2fr_1.8fr_110px] md:gap-4">
                    <span className="flex items-center gap-2 text-chrome capitalize">
                      <WorldDot world={s.body} /> {s.body}
                    </span>
                    <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-platinum hover:text-flare">
                      {s.name} <ArrowUpRight size={12} className="opacity-50" />
                    </a>
                    <span className="text-chrome">{s.use}</span>
                    <span className="font-mono text-[12px] text-dim">{s.status === "live" ? "In use" : "Next"}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-6 text-[12px] text-dim">
          The Python pipeline in <span className="font-mono text-chrome">pipeline/</span> rebuilds every number from these public sources.
        </p>
      </div>
    </section>
  );
}

/* ================================================================== rules + closing */

const RULES = [
  { icon: ShieldCheck, t: "Every number comes from a dataset or our pipeline." },
  { icon: Target, t: "Known sites teach and test. They are never shown as new." },
  { icon: Scale, t: "Ground is compared at the same physical scale on every world." },
  { icon: Database, t: "Every layer names its instrument, detail and provider." },
  { icon: Sun, t: "Gravity, vacuum and radiation: Earth can't copy them, and we say so." },
  { icon: Mountain, t: "Field visits need permission, local partners and care for the land." },
];

function Rules() {
  return (
    <section className="border-t border-line bg-ink px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="06">Our rules</Kicker>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map((r, i) => (
            <motion.div key={r.t} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.05 }} className="group flex items-start gap-4 bg-panel p-6 transition-colors hover:bg-panel-2">
              <r.icon size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-dim transition-colors group-hover:text-flare" />
              <span className="text-[15px] leading-snug text-platinum">{r.t}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const glow = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), { stiffness: 80, damping: 20 });
  return (
    <section ref={ref} className="relative overflow-hidden px-4 py-32 sm:px-6">
      <motion.div style={{ opacity: glow }} className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_120%,rgba(242,200,121,0.16),transparent_70%)]" />
      <div className="relative mx-auto flex max-w-[1400px] flex-col items-center text-center">
        <Astronaut size={96} mood="happy" action="wave" />
        <h2 className="mt-6 text-[clamp(32px,4.6vw,68px)] leading-[1] font-medium tracking-[-0.04em]">
          See it run <span className="font-serif font-normal text-flare italic">on your mission.</span>
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Magnetic>
            <Link to="/discover" className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-medium">
              Find new sites <ArrowRight size={16} />
            </Link>
          </Magnetic>
          <Link to="/lab" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-4 text-[15px] text-platinum hover:border-chrome">
            Compare in 3D
          </Link>
          <a href={DATASET_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-4 text-[15px] text-platinum hover:border-chrome">
            <Database size={16} /> Download every score <ArrowUpRight size={15} />
          </a>
        </div>
        <p className="mt-5 max-w-[560px] text-[13px] leading-relaxed text-dim">
          All 80,206 places, every target score, the AI twins and every test are open on Hugging Face under CC BY 4.0, ready for anyone to check or reuse.
        </p>
      </div>
    </section>
  );
}
