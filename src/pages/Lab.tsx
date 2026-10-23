import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { ArrowDown, ArrowRight, Columns2, Cpu, Hand, Info, Leaf, Link2, Link2Off, Pause, Play, Plane, RotateCcw, ShieldCheck, SplitSquareHorizontal, Sparkles, Sun, X } from "lucide-react";
import { Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { Astronaut, reactionFor, type Action, type Mood } from "../components/ui/Astronaut";
import { BodyMap, type BodyMapHandle, type MapView } from "../components/map/BodyMap";
import { SwipeStage } from "../components/map/Swipe";
import type { Overlay } from "../components/three/TerrainTwins";
import { EARTH_SITES, TARGETS, TARGET_BY_ID, TASKS, type EarthSite, type TaskId } from "../data/sites";
import { earthSite } from "../lib/places";
import { logBadge } from "../lib/fieldlog";
import { scoreCell, useGrid, type Grid } from "../lib/grid";
import { LAYERS_BY_BODY } from "../data/layers";
import { formatCoord, zoomForMercator } from "../lib/geo";
import {
  centreProfile,
  DEM,
  illumination,
  IMAGERY,
  earthVisible,
  nativeKm,
  sampleImagery,
  sampleTerrain,
  SLOPE_BINS,
  terrainStats,
  topographySimilarity,
  type Illumination,
  type TerrainGrid,
  type TerrainStats,
} from "../lib/terrain";
import { lightTwin, SUN_BINS } from "../lib/sun";
import { analogFit, band, demoValues, greatCircleKm, HOME_BASES, PARAMS, STEWARDSHIP, TASK_WEIGHTS, tripCo2Tonnes, type ParamResult, type Weights } from "../lib/scoring";

const TerrainTwins = lazy(() => import("../components/three/TerrainTwins"));

const FOOTPRINTS = [40, 80, 160];

/** Curated starting points, one click sets Earth site, target and task. */
const QUICK_PAIRS: { earth: string; target: string; task: TaskId; label: string }[] = [
  { earth: "dry-valleys", target: "shackleton", task: "polar", label: "Dry Valleys → Shackleton" },
  { earth: "atacama", target: "gale", task: "traverse", label: "Atacama → Gale crater" },
  { earth: "lava-beds", target: "marius-pit", task: "caves", label: "Lava Beds → Marius pit" },
  { earth: "mauna-kea", target: "mons-mouton", task: "isru", label: "Mauna Kea → Mons Mouton" },
  { earth: "svalbard", target: "arcadia", task: "ice", label: "Svalbard → Arcadia" },
];

const DOCK = [
  { id: "compare", label: "Compare" },
  { id: "evidence", label: "Ground" },
  { id: "geology", label: "Rocks" },
  { id: "light", label: "Light" },
  { id: "footprint", label: "Travel" },
  { id: "gaps", label: "Limits" },
];
const EASE = [0.22, 1, 0.36, 1] as const;
type World = "earth" | "moon" | "mars";

/* =============================================================== data hooks */

interface TwinState {
  earth: TerrainGrid | null;
  target: TerrainGrid | null;
  statsE: TerrainStats | null;
  statsT: TerrainStats | null;
  progress: number;
  error: string | null;
}

function useTerrainTwins(lat: number, lon: number, targetId: string, footprintKm: number) {
  const [s, setS] = useState<TwinState>({ earth: null, target: null, statsE: null, statsT: null, progress: 0, error: null });
  useEffect(() => {
    let alive = true;
    const e = { lat, lon };
    const t = TARGET_BY_ID[targetId];
    const spacing = Math.max(nativeKm(DEM[t.body], DEM[t.body].maxZoom, 0), footprintKm / 128);
    const prog = { a: 0, b: 0 };
    const tick = () => alive && setS((p) => ({ ...p, progress: (prog.a + prog.b) / 2 }));
    setS((p) => ({ ...p, earth: null, target: null, statsE: null, statsT: null, progress: 0.02, error: null }));
    Promise.all([
      sampleTerrain({ body: "earth", lat: e.lat, lon: e.lon, footprintKm, spacingKm: spacing, onProgress: (d, n) => ((prog.a = d / n), tick()) }),
      sampleTerrain({ body: t.body, lat: t.lat, lon: t.lon, footprintKm, spacingKm: spacing, onProgress: (d, n) => ((prog.b = d / n), tick()) }),
    ])
      .then(([ge, gt]) => alive && setS({ earth: ge, target: gt, statsE: terrainStats(ge), statsT: terrainStats(gt), progress: 1, error: null }))
      .catch(() => alive && setS((p) => ({ ...p, error: "Elevation tiles could not be loaded." })));
    return () => {
      alive = false;
    };
  }, [lat, lon, targetId, footprintKm]);
  return s;
}

interface Plates {
  ev: HTMLCanvasElement | null;
  es: HTMLCanvasElement | null;
  tv: HTMLCanvasElement | null;
  ts: HTMLCanvasElement | null;
}

function useImagery(lat: number, lon: number, targetId: string, footprintKm: number) {
  const [p, setP] = useState<Plates>({ ev: null, es: null, tv: null, ts: null });
  useEffect(() => {
    let alive = true;
    const e = { lat, lon };
    const t = TARGET_BY_ID[targetId];
    setP({ ev: null, es: null, tv: null, ts: null });
    const put = (k: keyof Plates) => (c: HTMLCanvasElement) => alive && setP((s) => ({ ...s, [k]: c }));
    sampleImagery(earthVisible(e.lat), e.lat, e.lon, footprintKm, 512).then(put("ev")).catch(() => {});
    sampleImagery(IMAGERY[t.body].visible, t.lat, t.lon, footprintKm, 512).then(put("tv")).catch(() => {});
    sampleImagery(IMAGERY.earth.second, e.lat, e.lon, footprintKm, 384).then(put("es")).catch(() => {});
    sampleImagery(IMAGERY[t.body].second, t.lat, t.lon, footprintKm, 384).then(put("ts")).catch(() => {});
    return () => {
      alive = false;
    };
  }, [lat, lon, targetId, footprintKm]);
  return p;
}

function useIllumination(grid: TerrainGrid | null, sunElev: number) {
  const [ill, setIll] = useState<Illumination | null>(null);
  useEffect(() => {
    if (!grid) return;
    setIll(null);
    const id = setTimeout(() => setIll(illumination(grid, sunElev)), 40);
    return () => clearTimeout(id);
  }, [grid, sunElev]);
  return ill;
}

/* ===================================================================== page */

export default function Lab() {
  const [params, setParams] = useSearchParams();
  const [earthId, setEarthId] = useState(() => (earthSite(params.get("earth") ?? "") ? params.get("earth")! : "dry-valleys"));
  const [targetId, setTargetId] = useState(() => (TARGET_BY_ID[params.get("target") ?? ""] ? params.get("target")! : "shackleton"));
  const [task, setTask] = useState<TaskId>(() => (TASKS.some((t) => t.id === params.get("task")) ? (params.get("task") as TaskId) : "polar"));
  const [footprint, setFootprint] = useState(80);
  const [weights, setWeights] = useState<Weights>(TASK_WEIGHTS[task]);

  const target = TARGET_BY_ID[targetId];
  const { grid } = useGrid();
  const base = earthSite(earthId)!;
  const cell = useMemo(() => (grid ? grid.cellAt(base.lat, base.lon, 3) : -1), [grid, base.lat, base.lon]);
  const label = useMemo(() => {
    if (!grid || cell < 0 || !earthId.startsWith("@")) return null;
    const n = grid.name(cell);
    return { name: n.title, country: n.subtitle || n.country };
  }, [grid, cell, earthId]);
  const earth = useMemo(() => earthSite(earthId, label)!, [earthId, label]);

  useEffect(() => {
    setParams({ earth: earthId, target: targetId, task }, { replace: true, preventScrollReset: true });
  }, [earthId, targetId, task, setParams]);
  useEffect(() => setWeights(TASK_WEIGHTS[task]), [task]);
  // Deep links such as /lab#geology scroll to that section once the page has laid out.
  // Read the hash before the search params are rewritten (which drops it).
  const [initialHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const id = initialHash;
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => logBadge("compare"), []);
  const twins = useTerrainTwins(earth.lat, earth.lon, targetId, footprint);
  const plates = useImagery(earth.lat, earth.lon, targetId, footprint);
  const light = useMemo(() => lightTwin(earth.lat, target.body, target.lat), [earth.lat, target.body, target.lat]);
  const defaultSun = Math.max(0.5, Math.round(light.target.medianElev * 10) / 10);
  const [sunElev, setSunElev] = useState(defaultSun);
  useEffect(() => setSunElev(defaultSun), [defaultSun]);
  const illE = useIllumination(twins.earth, sunElev);
  const illT = useIllumination(twins.target, sunElev);

  const topo = twins.statsE && twins.statsT ? topographySimilarity(twins.statsE, twins.statsT) : null;
  const demo = demoValues(earth, target);
  const gt = grid?.targets[targetId];
  const cs = grid && gt && cell >= 0 ? scoreCell(grid, cell, { target: gt, task, weights, modelMix: 0 }) : null;
  const results: ParamResult[] = [
    { id: "topography", value: topo ?? cs?.dims.topography ?? demo.topography, kind: topo !== null || cs ? "computed" : "demo", note: "" },
    { id: "geology", value: cs?.dims.geology ?? demo.geology, kind: cs ? "computed" : "demo", note: "" },
    { id: "temperature", value: cs?.dims.temperature ?? demo.temperature, kind: cs ? "computed" : "demo", note: "" },
    { id: "lighting", value: light.score, kind: "computed", note: "" },
    { id: "regolith", value: cs?.dims.regolith ?? demo.regolith, kind: cs ? "computed" : "demo", note: "" },
    { id: "radiation", value: null, kind: "gap", note: "" },
  ];
  const fit = analogFit(results, weights);
  const loading = !twins.statsE;
  const learned = grid && cell >= 0 ? grid.model(target.body, cell) : null;
  const pairedTargets = useMemo(() => [...earth.pairs.map((p) => TARGET_BY_ID[p]), ...TARGETS.filter((t) => !earth.pairs.includes(t.id))], [earth]);
  const earthName = earth.name.split(",")[0];

  return (
    <div className="bg-void">
      <Nav />
      <CompareStage
        earthId={earthId}
        earth={earth}
        targetId={targetId}
        setEarthId={setEarthId}
        setTargetId={setTargetId}
        task={task}
        setTask={setTask}
        pairedTargets={pairedTargets}
        onQuick={(q) => {
          setEarthId(q.earth);
          setTargetId(q.target);
          setTask(q.task);
        }}
        score={loading ? null : fit.score}
        panel={<EvidencePanel results={results} fit={fit} weights={weights} setWeights={setWeights} task={task} loading={loading} light={light} earthName={earthName} learned={learned} world={target.body} gridReady={!!cs} grid={grid} cell={cell} />}
      />

      <div className="mx-auto max-w-[1400px] space-y-32 px-4 py-28 sm:px-6">
        <section id="evidence" className="scroll-mt-32">
          <SectionHead
            n="01"
            kicker="Ground shape"
            title={
              <>
                Real terrain, <Em>cut to the same size.</Em>
              </>
            }
            text={`Both blocks show the same ${footprint} × ${footprint} km of real ground, at the same scale, with real satellite images on top. The gold line marks the slice shown below.`}
            kind="computed"
            astra={{ mood: "focused", action: "scan", say: "Drag to turn the view. Try “Light & shadow”, then “Turn the Sun”." }}
            aside={
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Footprint</span>
                <Seg value={String(footprint)} onChange={(v) => setFootprint(+v)} options={FOOTPRINTS.map((f) => ({ id: String(f), label: `${f} km` }))} />
              </div>
            }
          />
          <TerrainCard twins={twins} plates={plates} illE={illE} illT={illT} footprint={footprint} sunElev={sunElev} setSunElev={setSunElev} defaultSun={defaultSun} earthName={earthName} targetName={target.name} targetBody={target.body} earthImg={earthVisible(earth.lat).name} />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <ProfileCard earth={twins.earth} target={twins.target} footprint={footprint} targetBody={target.body} />
            <SlopeCard statsE={twins.statsE} statsT={twins.statsT} topo={topo} targetBody={target.body} />
          </div>
        </section>

        <section id="geology" className="scroll-mt-32">
          <SectionHead
            n="02"
            astra={{ mood: "happy", action: "sample", say: "Same size, north up, compare texture and colour." }}
            kicker="Rocks and surface"
            title={
              <>
                Same scale, <Em>real surfaces.</Em>
              </>
            }
            text="Real satellite images of the same size, north up. Compare texture, colour and shapes. The rocks score uses volcano and crater records and MODIS bare-ground maps. Mineral maps from NASA EMIT come next."
            kind={cs ? "computed" : "demo"}
            aside={<span className="font-mono text-[13px] text-chrome">rocks {results[1].value?.toFixed(2) ?? "n/a"}</span>}
          />
          <GeologyPlates plates={plates} footprint={footprint} earthName={earthName} targetName={target.name} targetBody={target.body} earthLat={earth.lat} />
        </section>

        <section id="light" className="scroll-mt-32">
          <SectionHead
            n="03"
            astra={{ mood: "wow", action: "flag", say: `Best season at ${earthName}: ${light.best.join(" · ") || "n/a"}.` }}
            kicker="Sunlight and shadow"
            title={
              <>
                Same Sun, <Em>two worlds.</Em>
              </>
            }
            text="Sun maths finds when Earth's sunlight acts like the target's. The shadow map then finds ground that never gets light at that Sun angle."
            kind="computed"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <LightTwinCard light={light} targetBody={target.body} targetName={target.name} earthName={earthName} />
            <ShadowCard grids={[twins.earth, twins.target]} ills={[illE, illT]} sunElev={sunElev} names={[earthName, target.name]} targetBody={target.body} />
          </div>
        </section>

        <section id="footprint" className="scroll-mt-32">
          <SectionHead
            n="04"
            astra={{ mood: "happy", action: "walk", say: "Closer site, fewer flights, same science." }}
            kicker="Closer and greener"
            title={
              <>
                The nearest credible site <Em>is the greenest one.</Em>
              </>
            }
            text="How far your team must travel, a rough CO₂ number, the closest good sites for this task, and the rules for visiting the site."
          />
          <Sustainability task={task} targetId={targetId} earth={earth} onPick={setEarthId} />
        </section>

        <section id="gaps" className="scroll-mt-32">
          <SectionHead
            n="05"
            astra={{ mood: "sad", action: "slump", say: "Earth can't fake gravity, vacuum or radiation." }}
            kicker="What Earth can't copy"
            title={
              <>
                The gaps stay <Em>next to every score.</Em>
              </>
            }
          />
          <RealityGaps world={target.body} />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Insight earthName={earthName} targetName={target.name} topo={topo} statsE={twins.statsE} statsT={twins.statsT} light={light} illE={illE} illT={illT} fit={fit.score} measured={!!cs} />
            <ModelRoadmap />
          </div>
        </section>
      </div>
      <SectionDock />
      <Footer />
    </div>
  );
}

/* ================================================================ guidance */

/** Floating section dock, appears once you leave the compare stage. */
function SectionDock() {
  const [active, setActive] = useState("compare");
  const [show, setShow] = useState(false);
  useEffect(() => {
    const els = DOCK.map((d) => document.getElementById(d.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.nav
          aria-label="Lab sections"
          initial={{ opacity: 0, y: 24, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 24, x: "-50%" }}
          transition={{ duration: 0.45, ease: EASE }}
          className="fixed bottom-5 left-1/2 z-50 hidden gap-0.5 rounded-full border border-line-2 bg-panel/90 p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:flex"
        >
          {DOCK.map((d, i) => (
            <a key={d.id} href={`#${d.id}`} className={clsx("relative rounded-full px-3.5 py-1.5 text-[12px] transition-colors", active === d.id ? "text-void" : "text-chrome hover:text-platinum")}>
              {active === d.id && <motion.span layoutId="dock-pill" className="absolute inset-0 rounded-full bg-platinum" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">
                <span className="mr-1 font-mono text-[10px] opacity-60">{String(i).padStart(2, "0")}</span>
                {d.label}
              </span>
            </a>
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

const STAGE_TIPS = [
  "Pick a quick pair above, or choose ① Earth, ② target and ③ task.",
  "Any place on Earth works: use Find new sites, then press Compare in 3D.",
  "Zoom one map and the other follows at the same scale.",
  "Switch to Swipe and drag the divider to compare surfaces.",
  "Scroll down for real 3D ground, rocks, sunlight and travel footprint.",
];

/** Astra's coach tips on the compare stage; dismissible and remembered per browser. */
function StageCoach() {
  const [i, setI] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("sa-coach") === "done";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (hidden) return;
    const t = setInterval(() => setI((n) => (n + 1) % STAGE_TIPS.length), 6500);
    return () => clearInterval(t);
  }, [hidden]);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem("sa-coach", "done");
    } catch {
      /* private mode, tips just come back next visit */
    }
  };
  return (
    <div className="absolute bottom-16 left-4 z-[650] hidden items-end gap-2 md:flex">
      <Astronaut size={70} mood="happy" action="wave" />
      <div className="panel mb-6 max-w-[290px] rounded-2xl rounded-bl-sm p-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }} className="text-[12.5px] leading-snug text-platinum">
            {STAGE_TIPS[i]}
          </motion.p>
        </AnimatePresence>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1">
            {STAGE_TIPS.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`Tip ${k + 1}`} className={clsx("h-1 rounded-full transition-all", k === i ? "w-4 bg-flare" : "w-1.5 bg-line-2")} />
            ))}
          </div>
          <button onClick={close} className="flex items-center gap-1 text-[11px] text-dim hover:text-platinum">
            Got it <X size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Drag to orbit" hint that fades after a few seconds. */
function OrbitHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full border border-line-2 bg-void/80 px-4 py-2 text-[12px] text-platinum backdrop-blur">
            <motion.span animate={{ x: [-6, 6, -6] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
              <Hand size={14} />
            </motion.span>
            Drag to orbit · scroll to zoom
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ shared bits */

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-serif font-normal text-chrome italic">{children}</span>;
}

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

function SectionHead({
  n,
  kicker,
  title,
  text,
  kind,
  aside,
  astra,
}: {
  n: string;
  kicker: string;
  title: React.ReactNode;
  text?: string;
  kind?: "computed" | "demo";
  aside?: React.ReactNode;
  astra?: { mood: Mood; action: Action; say: string };
}) {
  return (
    <Reveal className="mb-10 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-[11px] text-flare">{n}</span>
          <motion.span className="h-px w-10 origin-left bg-line-2" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
          <span className="font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">{kicker}</span>
          {kind && <KindBadge kind={kind} />}
        </div>
        <h2 className="mt-6 max-w-[900px] text-[clamp(30px,3.8vw,56px)] leading-[1.03] font-medium tracking-[-0.038em]">{title}</h2>
        {text && <p className="mt-4 max-w-[680px] text-[15px] leading-relaxed text-chrome">{text}</p>}
      </div>
      <div className="flex items-end gap-6">
        {astra && (
          <div className="hidden md:block">
            <Astronaut size={84} mood={astra.mood} action={astra.action} say={astra.say} sayAlign="left" />
          </div>
        )}
        {aside}
      </div>
    </Reveal>
  );
}

function KindBadge({ kind }: { kind: "computed" | "demo" | "gap" }) {
  const map = {
    computed: "border-strong/40 bg-strong/10 text-strong",
    demo: "border-dashed border-line-2 text-chrome",
    gap: "border-weak/40 bg-weak/10 text-weak",
  };
  const label = { computed: "Computed", demo: "Demo", gap: "Earth can't copy" };
  return <span className={clsx("rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-wider uppercase", map[kind])}>{label[kind]}</span>;
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: React.ReactNode }[] }) {
  const group = options.map((o) => o.id).join("");
  return (
    <div className="relative flex w-fit gap-0.5 rounded-full border border-line bg-ink p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id} className={clsx("relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-colors", value === o.id ? "text-void" : "text-chrome hover:text-platinum")}>
          {value === o.id && <motion.span layoutId={`seg-${group}`} className="absolute inset-0 rounded-full bg-platinum" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
          <span className="relative flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return <span className="grid size-5 shrink-0 place-items-center rounded-full bg-platinum font-mono text-[10px] font-medium text-void">{n}</span>;
}

function PairSelect({ world, value, onChange, options, step, hint }: { world: World; value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; step: number; hint: string }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-line-2 bg-ink py-1 pr-1 pl-1.5 transition-colors hover:border-chrome/50" title={`Step ${step}: ${hint}`}>
      <StepDot n={step} />
      <WorldDot world={world} />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[230px] cursor-pointer rounded-full bg-transparent py-1.5 pr-2 text-[13px] text-platinum outline-none">
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-panel">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CountUp({ value, digits = 2 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = value.toFixed(digits);
      return;
    }
    const c = animate(prev.current, value, { duration: 1, ease: EASE, onUpdate: (v) => (el.textContent = v.toFixed(digits)) });
    prev.current = value;
    return () => c.stop();
  }, [value, digits, reduce]);
  return (
    <span ref={ref} className="tabular">
      {value.toFixed(digits)}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("surface rounded-2xl", className)}>{children}</div>;
}

function Loader({ label, progress }: { label: string; progress?: number }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center">
        <Astronaut size={86} mood="focused" action="scan" />
        <div className="mt-4 font-mono text-[11px] tracking-widest text-chrome uppercase">{label}</div>
        {progress !== undefined && (
          <div className="mt-3 h-px w-56 bg-line">
            <motion.div className="h-px bg-flare" animate={{ width: `${Math.max(4, progress * 100)}%` }} transition={{ ease: EASE, duration: 0.4 }} />
          </div>
        )}
      </div>
    </div>
  );
}

const TONE = { strong: "var(--color-strong)", partial: "var(--color-partial)", weak: "var(--color-weak)" };
const C = (w: World) => `var(--color-${w})`;

/* ============================================================ compare stage */

function CompareStage({
  earthId,
  earth,
  targetId,
  setEarthId,
  setTargetId,
  task,
  setTask,
  pairedTargets,
  panel,
  onQuick,
  score,
}: {
  score: number | null;
  earthId: string;
  earth: EarthSite;
  targetId: string;
  setEarthId: (v: string) => void;
  setTargetId: (v: string) => void;
  task: TaskId;
  setTask: (t: TaskId) => void;
  pairedTargets: typeof TARGETS;
  panel: React.ReactNode;
  onQuick: (q: (typeof QUICK_PAIRS)[number]) => void;
}) {
  const target = TARGET_BY_ID[targetId];
  const polar = target.body === "moon" && target.lat < -80;
  const [mode, setMode] = useState<"split" | "swipe">("split");
  const [locked, setLocked] = useState(true);
  const [swipe, setSwipe] = useState(0.5);
  const [earthLayer, setEarthLayer] = useState(Math.abs(earth.lat) > 60 ? "earth-bluemarble" : "earth-s2");
  useEffect(() => {
    setEarthLayer(Math.abs(earth.lat) > 60 ? "earth-bluemarble" : "earth-s2");
  }, [earthId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [targetLayer, setTargetLayer] = useState(polar ? "moon-south-pole" : target.body === "moon" ? "moon-wac" : "mars-viking");
  useEffect(() => {
    setTargetLayer(polar ? "moon-south-pole" : target.body === "moon" ? "moon-wac" : "mars-viking");
  }, [targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const eRef = useRef<BodyMapHandle>(null);
  const tRef = useRef<BodyMapHandle>(null);
  const [eView, setEView] = useState<MapView | null>(null);
  const [tView, setTView] = useState<MapView | null>(null);
  const onE = useCallback(
    (v: MapView) => {
      setEView(v);
      if (locked) tRef.current?.setMetresPerPixel(v.metresPerPixel);
    },
    [locked],
  );
  const onT = useCallback(
    (v: MapView) => {
      setTView(v);
      if (locked) eRef.current?.setMetresPerPixel(v.metresPerPixel);
    },
    [locked],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      // Open the target first, then let the Earth map follow its scale (no competing animations).
      // Polar targets open at a regional ~450 m/px so the craters read in context.
      tRef.current?.flyTo(target.lat, target.lon, polar ? 0 : 6, false);
      eRef.current?.flyTo(earth.lat, earth.lon, polar ? zoomForMercator(earth.lat, 450) : 9, false);
    }, 160);
    return () => clearTimeout(t);
  }, [earthId, targetId, targetLayer, earthLayer, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetLayers = LAYERS_BY_BODY[target.body].filter((l) => (polar ? true : l.projection !== "polar-south"));
  const earthLayers = LAYERS_BY_BODY.earth.filter((l) => !l.overlay);

  const earthMap = (
    <BodyMap
      ref={eRef}
      body="earth"
      layerId={earthLayer}
      markers={[{ id: earth.id, lat: earth.lat, lon: earth.lon, color: C("earth"), label: earth.name }]}
      activeId={earth.id}
      onViewChange={onE}
      initial={{ lat: earth.lat, lon: earth.lon, zoom: 9 }}
    />
  );
  const targetMap = (
    <BodyMap
      ref={tRef}
      body={target.body}
      layerId={targetLayer}
      markers={[{ id: target.id, lat: target.lat, lon: target.lon, color: "#ffffff", label: target.name }]}
      activeId={target.id}
      onViewChange={onT}
      initial={{ lat: target.lat, lon: target.lon, zoom: 6 }}
    />
  );

  return (
    <section id="compare" className="border-b border-line">
      <div className="z-40 border-b border-line bg-void/90 backdrop-blur-xl lg:sticky lg:top-16">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 sm:px-6">
          <PairSelect step={1} hint="Earth site" world="earth" value={earthId} onChange={setEarthId} options={[...(earthId.startsWith("@") ? [{ id: earthId, label: `Your place: ${earth.name}` }] : []), ...EARTH_SITES.map((s) => ({ id: s.id, label: s.name }))]} />
          <span className="font-serif text-lg text-dim italic">practises for</span>
          <PairSelect
            step={2}
            hint="Moon or Mars target"
            world={target.body}
            value={targetId}
            onChange={setTargetId}
            options={pairedTargets.map((t) => ({ id: t.id, label: `${earth.pairs.includes(t.id) ? "● " : ""}${t.name} · ${t.body === "moon" ? "Moon" : "Mars"}` }))}
          />
          <label className="flex items-center gap-2 rounded-full border border-line-2 bg-ink py-1 pr-1 pl-1.5" title="Step 3: what you want to practise. It sets the score weights.">
            <StepDot n={3} />
            <span className="font-mono text-[10px] tracking-widest text-dim uppercase">Task</span>
            <select value={task} onChange={(e) => setTask(e.target.value as TaskId)} className="cursor-pointer rounded-full bg-transparent py-1.5 pr-2 text-[13px] text-platinum outline-none">
              {TASKS.map((t) => (
                <option key={t.id} value={t.id} className="bg-panel">
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Seg
              value={mode}
              onChange={(v) => setMode(v as "split" | "swipe")}
              options={[
                {
                  id: "split",
                  label: (
                    <>
                      <Columns2 size={13} /> Side by side
                    </>
                  ),
                },
                {
                  id: "swipe",
                  label: (
                    <>
                      <SplitSquareHorizontal size={13} /> Swipe
                    </>
                  ),
                },
              ]}
            />
            <button
              onClick={() => setLocked((l) => !l)}
              aria-pressed={locked}
              className={clsx("flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] transition-colors", locked ? "border-flare/50 text-flare" : "border-line-2 text-chrome")}
            >
              {locked ? <Link2 size={13} /> : <Link2Off size={13} />} Matched scale
            </button>
          </div>
        </div>
        <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto border-t border-line px-4 py-2 sm:px-6">
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
            <Sparkles size={12} className="text-flare" /> Quick pairs
          </span>
          {QUICK_PAIRS.map((q) => {
            const on = q.earth === earthId && q.target === targetId;
            return (
              <button
                key={q.label}
                onClick={() => onQuick(q)}
                className={clsx("shrink-0 rounded-full border px-3 py-1 text-[12px] transition-colors", on ? "border-flare/60 bg-flare/10 text-flare" : "border-line-2 text-chrome hover:border-chrome hover:text-platinum")}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:h-[calc(100dvh-64px-104px)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative min-h-[520px]">
          {mode === "split" ? (
            <div className="relative grid h-full md:grid-cols-2">
              <MapPane pairKey={`${earthId}|${targetId}`} title={earth.name} world="earth" coord={formatCoord(earth.lat, earth.lon)} layer={earthLayer} onLayer={setEarthLayer} layers={earthLayers} view={eView}>
                {earthMap}
              </MapPane>
              <MapPane pairKey={`${earthId}|${targetId}`} title={target.name} world={target.body} coord={formatCoord(target.lat, target.lon)} layer={targetLayer} onLayer={setTargetLayer} layers={targetLayers} view={tView} border>
                {targetMap}
              </MapPane>
              <Seam score={score} world={target.body} />
            </div>
          ) : (
            <SwipeStage className="h-[70vh] lg:h-full" value={swipe} onChange={setSwipe} left={earthMap} right={targetMap} leftLabel={earth.name.split(",")[0]} rightLabel={target.name} rightWorld={target.body} />
          )}
          <StageCoach />
          <a href="#evidence" className="absolute bottom-5 left-1/2 z-[700] hidden -translate-x-1/2 items-center gap-2 rounded-full border border-line-2 bg-void/80 px-4 py-2 text-[12px] text-chrome backdrop-blur transition-colors hover:text-platinum lg:flex">
            Ground, rocks, light and travel <ArrowDown size={13} className="animate-bounce" />
          </a>
        </div>
        <aside className="scrollbar-thin border-line lg:overflow-y-auto lg:border-l">{panel}</aside>
      </div>
    </section>
  );
}

/** The glowing seam between the two worlds, with the live match score in the middle. */
function Seam({ score, world }: { score: number | null; world: World }) {
  const R = 30;
  const CIRC = 2 * Math.PI * R;
  return (
    <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[650] hidden w-0 md:block">
      <div className="absolute inset-y-0 -left-px w-[2px] bg-[linear-gradient(180deg,transparent,rgba(242,200,121,0.55)_30%,rgba(242,200,121,0.55)_70%,transparent)]" />
      <motion.div className="absolute -left-[3px] h-24 w-[8px] rounded-full bg-[radial-gradient(closest-side,rgba(255,236,200,0.9),transparent)] blur-[2px]" animate={{ top: ["-10%", "105%"] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }} />
      <a href="#evidence" className="pointer-events-auto absolute top-1/2 left-0 grid size-[84px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line-2 bg-void/80 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-transform hover:scale-105" aria-label="Match score, see the evidence">
        <svg viewBox="0 0 72 72" className="absolute inset-0 m-auto size-[72px] -rotate-90">
          <circle cx="36" cy="36" r={R} fill="none" style={{ stroke: "var(--color-line-2)" }} strokeWidth="3" />
          <motion.circle cx="36" cy="36" r={R} fill="none" style={{ stroke: `var(--color-${world})` }} strokeWidth="3" strokeLinecap="round" strokeDasharray={CIRC} initial={{ strokeDashoffset: CIRC }} animate={{ strokeDashoffset: score === null ? CIRC : CIRC * (1 - score) }} transition={{ duration: 1.2, ease: EASE }} />
        </svg>
        <span className="relative text-center leading-none">
          <span className="block font-mono text-[17px] text-platinum">{score === null ? "…" : <CountUp value={score} />}</span>
          <span className="mt-1 block text-[9px] tracking-[0.18em] text-dim uppercase">match</span>
        </span>
      </a>
    </div>
  );
}

/** Viewfinder corners that snap in whenever the pair changes. */
function Corners({ k }: { k: string }) {
  const c = "absolute size-5 border-platinum/50";
  return (
    <motion.div key={k} className="pointer-events-none absolute inset-3 z-[590]" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE }}>
      <span className={clsx(c, "top-12 left-0 border-t border-l")} />
      <span className={clsx(c, "top-12 right-0 border-t border-r")} />
      <span className={clsx(c, "bottom-8 left-0 border-b border-l")} />
      <span className={clsx(c, "right-0 bottom-8 border-r border-b")} />
    </motion.div>
  );
}

function MapPane({
  pairKey,
  title,
  world,
  coord,
  layer,
  onLayer,
  layers,
  view,
  children,
  border,
}: {
  title: string;
  world: World;
  coord: string;
  layer: string;
  onLayer: (id: string) => void;
  layers: { id: string; name: string; instrument: string; resolution: string }[];
  view: MapView | null;
  children: React.ReactNode;
  border?: boolean;
  pairKey?: string;
}) {
  const l = layers.find((x) => x.id === layer);
  return (
    <div className={clsx("relative h-[46vh] min-h-[320px] md:h-full", border && "border-t border-line md:border-t-0 md:border-l")}>
      {children}
      {pairKey && <Corners k={pairKey} />}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-start justify-between gap-2 p-3">
        <div className="panel pointer-events-auto rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <WorldDot world={world} /> {title}
          </div>
          <div className="font-mono text-[10px] text-dim tabular">{coord}</div>
        </div>
        <select value={layer} onChange={(e) => onLayer(e.target.value)} className="panel pointer-events-auto max-w-[200px] cursor-pointer rounded-full px-3 py-1.5 text-[12px] text-platinum outline-none" aria-label={`${title} layer`}>
          {layers.map((x) => (
            <option key={x.id} value={x.id} className="bg-panel">
              {x.name}
            </option>
          ))}
        </select>
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 z-[600] rounded-md bg-void/75 px-2 py-1 font-mono text-[10px] text-dim backdrop-blur">
        {l?.instrument.split("(")[0].trim()} · {l?.resolution}
        {view && ` · ${view.metresPerPixel >= 1000 ? (view.metresPerPixel / 1000).toFixed(2) + " km" : view.metresPerPixel.toFixed(0) + " m"}/px`}
      </div>
    </div>
  );
}

/* ============================================================ evidence panel */

function EvidencePanel({
  results,
  fit,
  weights,
  setWeights,
  task,
  loading,
  light,
  earthName,
  learned,
  world,
  gridReady,
  grid,
  cell,
}: {
  learned: number | null;
  world: "moon" | "mars";
  gridReady: boolean;
  grid: Grid | null;
  cell: number;
  results: ParamResult[];
  fit: { score: number; computedShare: number };
  weights: Weights;
  setWeights: (w: Weights) => void;
  task: TaskId;
  loading: boolean;
  light: ReturnType<typeof lightTwin>;
  earthName: string;
}) {
  const b = band(fit.score);
  const react = reactionFor(loading ? null : fit.score, loading);
  const C = 2 * Math.PI * 54;
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6">
      <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Match score · {TASKS.find((t) => t.id === task)!.short}</div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="relative size-[124px] shrink-0">
          <svg viewBox="0 0 128 128" className="size-full -rotate-90">
            <circle cx="64" cy="64" r="54" fill="none" style={{ stroke: "var(--color-line)" }} strokeWidth="6" />
            <motion.circle cx="64" cy="64" r="54" fill="none" style={{ stroke: TONE[b.tone] }} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: loading ? C : C * (1 - fit.score) }} transition={{ duration: 1.2, ease: EASE }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-mono text-[28px] leading-none font-light">{loading ? "··" : <CountUp value={fit.score} />}</div>
              <div className="mt-1 text-[11px]" style={{ color: loading ? "var(--color-dim)" : TONE[b.tone] }}>
                {loading ? "measuring" : b.label}
              </div>
            </div>
          </div>
        </div>
        <Astronaut size={96} mood={react.mood} action={react.action} />
      </div>
      <p className="mt-4 min-h-[40px] text-[14px] leading-snug text-platinum">{react.say}</p>
      <p className="mt-1 text-[12px] text-dim">
        {gridReady ? "Every number below is measured from NASA and open data." : "Loading the NASA data for rocks, cold and bare ground…"}
      </p>

      <ul className="mt-6 border-t border-line">
        {results.map((p) => {
          const meta = PARAMS.find((x) => x.id === p.id)!;
          const w = p.kind === "gap" ? null : weights[p.id as keyof Weights];
          return (
            <li key={p.id} className="border-b border-line py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] text-platinum">
                  {meta.label} <KindBadge kind={p.kind} />
                </span>
                <span className="font-mono text-[13px] text-platinum tabular">{p.value === null ? "n/a" : p.value.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
                {p.value !== null && <motion.div className={clsx("h-full rounded-full", p.kind === "computed" ? "bg-platinum" : "bg-chrome/45")} initial={{ width: 0 }} animate={{ width: `${p.value * 100}%` }} transition={{ duration: 1, ease: EASE }} />}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-dim">
                <span>{p.kind === "gap" ? "Shown, never scored" : meta.what}</span>
                {w !== null && <span className="font-mono">w {Math.round(w * 100)}%</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] text-dim">
        <Info size={11} />
        <span className="flex items-center gap-1.5">
          <KindBadge kind="computed" /> measured live
        </span>
        <span className="flex items-center gap-1.5">
          <KindBadge kind="demo" /> placeholder while loading
        </span>
        <span className="flex items-center gap-1.5">
          <KindBadge kind="gap" /> never scored
        </span>
      </div>
      <button onClick={() => setOpen((o) => !o)} className="link-wipe mt-4 text-[12px] text-chrome">
        {open ? "Hide" : "Change"} what matters most
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
            <label key={k} className="flex items-center gap-3 text-[12px]">
              <span className="w-24 text-chrome">{PARAMS.find((x) => x.id === k)!.label}</span>
              <input type="range" min={0} max={1} step={0.05} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: +e.target.value })} className="flex-1 accent-[#edeae4]" />
              <span className="w-9 text-right font-mono text-dim">{Math.round(weights[k] * 100)}</span>
            </label>
          ))}
          <button onClick={() => setWeights(TASK_WEIGHTS[task])} className="text-[11px] text-dim hover:text-chrome">
            Reset to preset
          </button>
        </div>
      )}
      {learned !== null && (
        <div className="mt-5 rounded-xl border border-earth/30 bg-earth/[0.06] p-4">
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
            <span className="flex items-center gap-2">
              <Cpu size={12} className="text-earth" /> Learned model
            </span>
            <span className="font-mono text-[13px] tracking-normal text-earth">{learned.toFixed(2)}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-chrome">
            Looks more {world === "moon" ? "Moon" : "Mars"}-like than {Math.round(learned * 100)}% of all land, judged by a model trained on 38 known test sites.
          </p>
        </div>
      )}
      {grid && cell >= 0 && <ClimateLine grid={grid} cell={cell} />}
      <div className="mt-3 rounded-xl border border-line bg-ink p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
          <Sun size={12} className="text-flare" /> Best months to go
        </div>
        <div className="mt-1 text-[15px] text-platinum">
          {earthName}: <span className="text-flare">{light.best.join(" · ") || "n/a"}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-dim">
        <Cpu size={12} /> Worked out in your browser from NASA data.
      </div>
    </div>
  );
}

/* ============================================================== topography */

function TerrainCard({
  twins,
  plates,
  illE,
  illT,
  footprint,
  sunElev,
  setSunElev,
  defaultSun,
  earthName,
  targetName,
  targetBody,
  earthImg,
}: {
  twins: TwinState;
  plates: Plates;
  illE: Illumination | null;
  illT: Illumination | null;
  footprint: number;
  sunElev: number;
  setSunElev: (v: number) => void;
  defaultSun: number;
  earthName: string;
  targetName: string;
  targetBody: "moon" | "mars";
  earthImg: string;
}) {
  const [overlay, setOverlay] = useState<Overlay>("imagery");
  const [sunAz, setSunAz] = useState(135);
  const [playing, setPlaying] = useState(false);
  const [exag, setExag] = useState(3);
  return (
    <Reveal>
      <div data-theme="dark" className="relative overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="relative h-[520px] md:h-[640px]">
          {twins.earth && twins.target ? (
            <Suspense fallback={<Loader label="Preparing 3D terrain" />}>
              <TerrainTwins
                earth={twins.earth}
                target={twins.target}
                drapeEarth={plates.ev}
                drapeTarget={plates.tv}
                litEarth={illE?.lit ?? null}
                litTarget={illT?.lit ?? null}
                footprintKm={footprint}
                sunElev={overlay === "imagery" ? Math.max(sunElev, 25) : sunElev}
                sunAz={sunAz}
                playing={playing}
                exaggeration={exag}
                overlay={overlay}
              />
              <OrbitHint />
            </Suspense>
          ) : (
            <Loader label={twins.error ?? `Streaming elevation · ${Math.round(twins.progress * 100)}%`} progress={twins.progress} />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5">
            <SlabLabel world="earth" name={earthName} grid={twins.earth} img={earthImg} />
            <SlabLabel world={targetBody} name={targetName} grid={twins.target} img={IMAGERY[targetBody].visible.name} right />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-void/85 p-3 backdrop-blur-xl">
            <Seg
              value={overlay}
              onChange={(v) => setOverlay(v as Overlay)}
              options={[
                { id: "imagery", label: "Real imagery" },
                { id: "light", label: "Light & shadow" },
                { id: "relief", label: "Elevation" },
              ]}
            />
            <button onClick={() => setPlaying((p) => !p)} title="Sweep the Sun around the horizon, as at the lunar poles" className="flex items-center gap-1.5 rounded-full border border-flare/50 px-3 py-1.5 text-[12px] text-flare transition-colors hover:bg-flare/10">
              {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Pause Sun" : "Turn the Sun"}
            </button>
            <label className="flex items-center gap-2 text-[11px] text-chrome">
              <span className="font-mono">AZ</span>
              <input type="range" min={0} max={359} value={sunAz} onChange={(e) => setSunAz(+e.target.value)} className="w-20 accent-[#f2c879]" aria-label="Sun azimuth" />
            </label>
            {overlay !== "imagery" && (
              <label className="flex items-center gap-2 text-[11px] text-chrome">
                <Sun size={13} className="text-flare" />
                <input type="range" min={0.5} max={60} step={0.5} value={sunElev} onChange={(e) => setSunElev(+e.target.value)} className="w-20 accent-[#f2c879]" aria-label="Sun elevation" />
                <span className="w-10 font-mono text-platinum tabular">{sunElev.toFixed(1)}°</span>
                {sunElev !== defaultSun && (
                  <button onClick={() => setSunElev(defaultSun)} className="text-dim hover:text-chrome" title="Reset to the target's median Sun">
                    <RotateCcw size={12} />
                  </button>
                )}
              </label>
            )}
            <Seg value={String(exag)} onChange={(v) => setExag(+v)} options={[1, 3, 6].map((x) => ({ id: String(x), label: `${x}×` }))} />
            <span className="ml-auto hidden font-mono text-[10px] text-dim md:block">drag to orbit · scroll to zoom</span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function SlabLabel({ world, name, grid, img, right }: { world: World; name: string; grid: TerrainGrid | null; img: string; right?: boolean }) {
  return (
    <div className={clsx("max-w-[46%]", right && "text-right")}>
      <div className={clsx("flex items-center gap-2 text-[15px] font-medium [text-shadow:0_1px_8px_#000]", right && "justify-end")}>
        <WorldDot world={world} /> {name}
      </div>
      {grid && (
        <div className="mt-1 hidden font-mono text-[10px] leading-relaxed text-chrome [text-shadow:0_1px_6px_#000] sm:block">
          {grid.source.name.split(" (")[0]} · {grid.spacingKm.toFixed(2)} km/cell
          <br />
          {img}
        </div>
      )}
    </div>
  );
}

function ProfileCard({ earth, target, footprint, targetBody }: { earth: TerrainGrid | null; target: TerrainGrid | null; footprint: number; targetBody: "moon" | "mars" }) {
  const W = 800;
  const H = 240;
  const data = useMemo(() => {
    if (!earth || !target) return null;
    const a = centreProfile(earth);
    const b = centreProfile(target);
    const lim = Math.max(...a.map((p) => Math.abs(p.m)), ...b.map((p) => Math.abs(p.m)), 50) * 1.1;
    const y = (m: number) => H / 2 - (m / lim) * (H / 2 - 12);
    const path = (pts: { km: number; m: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${((p.km / footprint) * W).toFixed(1)},${y(p.m).toFixed(1)}`).join(" ");
    const area = (pts: { km: number; m: number }[]) => `${path(pts)} L${W},${H} L0,${H} Z`;
    return { a: path(a), b: path(b), aa: area(a), ba: area(b), lim };
  }, [earth, target, footprint]);
  return (
    <Reveal>
      <Card className="h-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Cross-section · W → E through the site</div>
            <h3 className="mt-1 text-[19px] font-medium tracking-tight">The slice, in real metres</h3>
          </div>
          <KindBadge kind="computed" />
        </div>
        {data ? (
          <svg viewBox={`0 0 ${W} ${H + 24}`} className="mt-6 w-full overflow-visible">
            <defs>
              <linearGradient id="pf-e" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: C("earth"), stopOpacity: 0.22 }} />
                <stop offset="1" style={{ stopColor: C("earth"), stopOpacity: 0 }} />
              </linearGradient>
              <linearGradient id="pf-t" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: C(targetBody), stopOpacity: 0.22 }} />
                <stop offset="1" style={{ stopColor: C(targetBody), stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} style={{ stroke: "var(--color-line)" }} strokeDasharray={f === 0.5 ? "0" : "3 6"} />
            ))}
            <motion.path d={data.aa} fill="url(#pf-e)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.6 }} />
            <motion.path d={data.ba} fill="url(#pf-t)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.8 }} />
            <motion.path d={data.a} fill="none" style={{ stroke: C("earth") }} strokeWidth={2} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
            <motion.path d={data.b} fill="none" style={{ stroke: C(targetBody) }} strokeWidth={2} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE, delay: 0.15 }} />
            <text x={0} y={H + 20} style={{ fill: "var(--color-dim)" }} fontSize="12" fontFamily="Geist Mono">
              0 km
            </text>
            <text x={W} y={H + 20} style={{ fill: "var(--color-dim)" }} fontSize="12" fontFamily="Geist Mono" textAnchor="end">
              {footprint} km
            </text>
            <text x={4} y={14} style={{ fill: "var(--color-dim)" }} fontSize="12" fontFamily="Geist Mono">
              +{Math.round(data.lim)} m
            </text>
            <text x={4} y={H - 4} style={{ fill: "var(--color-dim)" }} fontSize="12" fontFamily="Geist Mono">
              −{Math.round(data.lim)} m
            </text>
          </svg>
        ) : (
          <div className="grid h-56 place-items-center text-[12px] text-dim">Waiting for elevation…</div>
        )}
        <div className="mt-3 flex flex-wrap gap-5 text-[12px] text-chrome">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-5" style={{ background: C("earth") }} /> Earth
          </span>
          <span className="flex items-center gap-2 capitalize">
            <span className="h-0.5 w-5" style={{ background: C(targetBody) }} /> {targetBody}
          </span>
          <span className="ml-auto text-dim">height above each slice's average · same scale</span>
        </div>
      </Card>
    </Reveal>
  );
}

function Bars({ a, b, labels, colorB, height = "h-32" }: { a: number[]; b: number[]; labels: string[]; colorB: string; height?: string }) {
  const max = Math.max(...a, ...b, 0.01);
  return (
    <div>
      <div className={clsx("flex items-end gap-2", height)}>
        {a.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end gap-[3px]">
            <motion.div className="flex-1 rounded-t-[2px] bg-earth/80" initial={{ height: 0 }} whileInView={{ height: `${(v / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.04 }} />
            <motion.div className="flex-1 rounded-t-[2px]" style={{ background: colorB }} initial={{ height: 0 }} whileInView={{ height: `${(b[i] / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.04 + 0.06 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2">
        {labels.map((l) => (
          <div key={l} className="flex-1 text-center font-mono text-[9.5px] text-dim">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlopeCard({ statsE, statsT, topo, targetBody }: { statsE: TerrainStats | null; statsT: TerrainStats | null; topo: number | null; targetBody: "moon" | "mars" }) {
  const labels = SLOPE_BINS.slice(0, -1).map((v, i) => (i === SLOPE_BINS.length - 2 ? `${v}°+` : `${v}°`));
  const rows: [string, (s: TerrainStats) => string][] = [
    ["Mean slope", (s) => `${s.meanSlope.toFixed(1)}°`],
    ["90th-pct slope", (s) => `${s.p90Slope.toFixed(1)}°`],
    ["Relief", (s) => `${(s.relief / 1000).toFixed(2)} km`],
    ["Roughness", (s) => `${s.roughness.toFixed(0)} m`],
  ];
  return (
    <Reveal delay={0.08}>
      <Card className="h-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Slope distribution</div>
            <h3 className="mt-1 text-[19px] font-medium tracking-tight">Topography score {topo !== null ? <span className="font-mono text-flare">{topo.toFixed(2)}</span> : "…"}</h3>
          </div>
          <KindBadge kind="computed" />
        </div>
        {statsE && statsT ? (
          <>
            <div className="mt-6">
              <Bars a={statsE.slopeHist} b={statsT.slopeHist} labels={labels} colorB={C(targetBody)} />
            </div>
            <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-6 text-[12.5px]">
              {rows.map(([k, f]) => (
                <div key={k} className="contents">
                  <span className="border-t border-line py-2 text-chrome">{k}</span>
                  <span className="border-t border-line py-2 text-right font-mono text-platinum tabular">{f(statsE)}</span>
                  <span className="border-t border-line py-2 text-right font-mono text-platinum tabular">{f(statsT)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid h-56 place-items-center text-[12px] text-dim">Waiting for elevation…</div>
        )}
      </Card>
    </Reveal>
  );
}

/* ================================================================= geology */

function Plate({ canvas, label, sub, footprint, world }: { canvas: HTMLCanvasElement | null; label: string; sub: string; footprint: number; world: World }) {
  const url = useMemo(() => (canvas ? canvas.toDataURL("image/jpeg", 0.88) : null), [canvas]);
  return (
    <figure className="group relative overflow-hidden rounded-xl border border-line bg-ink">
      <div className="relative aspect-square overflow-hidden">
        {url ? (
          <motion.img
            src={url}
            alt={`${label}, ${sub}`}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
            className="size-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid size-full place-items-center font-mono text-[10px] tracking-widest text-dim uppercase">loading imagery…</div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1">
          <div className="h-1 border-x border-b border-white/80" style={{ width: 64 }} />
          <span className="font-mono text-[10px] text-white/85 [text-shadow:0_1px_2px_#000]">{Math.round((footprint * 64) / 512)} km</span>
        </div>
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-void/70 px-2 py-0.5 text-[10px] tracking-wide text-platinum uppercase backdrop-blur">
          <WorldDot world={world} /> {world}
        </span>
        <span className="absolute top-3 right-3 font-mono text-[11px] text-white/80 [text-shadow:0_1px_2px_#000]">N ↑</span>
      </div>
      <figcaption className="flex items-baseline justify-between gap-3 px-4 py-3">
        <span className="text-[13px] text-platinum">{label}</span>
        <span className="truncate font-mono text-[10px] text-dim">{sub}</span>
      </figcaption>
    </figure>
  );
}

function GeologyPlates({ plates, footprint, earthName, targetName, targetBody, earthLat }: { plates: Plates; footprint: number; earthName: string; targetName: string; targetBody: "moon" | "mars"; earthLat: number }) {
  const rows = [
    { k: "Surface in visible light", e: earthVisible(earthLat), t: IMAGERY[targetBody].visible, ec: plates.ev, tc: plates.tv },
    { k: targetBody === "mars" ? "Relief vs. thermal infrared" : "Relief, Sun-independent", e: IMAGERY.earth.second, t: IMAGERY[targetBody].second, ec: plates.es, tc: plates.ts },
  ];
  return (
    <div className="space-y-12">
      {rows.map((r, i) => (
        <Reveal key={r.k} delay={i * 0.06}>
          <div className="grid items-start gap-4 lg:grid-cols-[240px_1fr_1fr]">
            <div className="lg:pt-2">
              <div className="font-mono text-[11px] text-flare">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-2 text-[18px] text-platinum">{r.k}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-dim">
                {i === 0
                  ? "Brightness, texture and old water channels. Earth is from Sentinel-2. Moon and Mars are maps made from orbit."
                  : targetBody === "mars"
                    ? "THEMIS heat images show warm bare rock and cool dust. Compare them with the shape of Earth's ground."
                    : "Shaded relief from laser and radar height data. The same shapes, without colour."}
              </p>
            </div>
            <Plate canvas={r.ec} label={earthName} sub={`${r.e.name} · ${r.e.res}`} footprint={footprint} world="earth" />
            <Plate canvas={r.tc} label={targetName} sub={`${r.t.name} · ${r.t.res}`} footprint={footprint} world={targetBody} />
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* =========================================================== light & shadow */

function LightTwinCard({ light, targetBody, targetName, earthName }: { light: ReturnType<typeof lightTwin>; targetBody: "moon" | "mars"; targetName: string; earthName: string }) {
  const labels = SUN_BINS.slice(0, -1).map((v) => `${v}°`);
  const top = Math.max(...light.months.map((m) => m.score), 0.01);
  return (
    <Reveal>
      <Card className="h-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Sunlight match · best months</div>
            <h3 className="mt-1 text-[19px] font-medium tracking-tight">
              Lighting <span className="font-mono text-flare">{light.score.toFixed(2)}</span> <span className="text-[13px] text-dim">best season · {light.annual.toFixed(2)} annual</span>
            </h3>
          </div>
          <KindBadge kind="computed" />
        </div>
        <div className="mt-6 grid grid-cols-12 gap-1.5">
          {light.months.map((m, i) => {
            const best = light.best.includes(m.month);
            return (
              <div key={m.month} className="text-center">
                <div className="flex h-28 items-end overflow-hidden rounded-[4px] bg-ink">
                  <motion.div className={clsx("w-full", best ? "bg-flare" : "bg-line-2")} initial={{ height: 0 }} whileInView={{ height: `${(m.score / top) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.035 }} />
                </div>
                <div className={clsx("mt-1.5 font-mono text-[10px]", best ? "text-flare" : "text-dim")}>{m.month}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-[14px] leading-relaxed text-chrome">
          Go to {earthName} in <span className="text-flare">{light.best.join(" · ") || "n/a"}</span>: that is when its Sun-angle pattern is closest to {targetName}.
        </p>
        <div className="mt-6">
          <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Daylight Sun elevation · whole year</div>
          <Bars a={light.earth.hist} b={light.target.hist} labels={labels} colorB={C(targetBody)} height="h-20" />
        </div>
      </Card>
    </Reveal>
  );
}

function litImage(grid: TerrainGrid | null, ill: Illumination | null) {
  if (!grid || !ill) return null;
  const n = grid.n;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const lo = [10, 18, 48];
  const mid = [16, 26, 58];
  const hi = [242, 200, 121];
  for (let k = 0; k < n * n; k++) {
    const f = ill.lit[k];
    const t = Math.pow(f, 0.7);
    const col = f === 0 ? lo : mid.map((v, i) => v + (hi[i] - v) * t);
    img.data.set([col[0], col[1], col[2], 255], k * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function ShadowCard({ grids, ills, sunElev, names, targetBody }: { grids: (TerrainGrid | null)[]; ills: (Illumination | null)[]; sunElev: number; names: string[]; targetBody: "moon" | "mars" }) {
  const a = useMemo(() => litImage(grids[0], ills[0]), [grids[0], ills[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => litImage(grids[1], ills[1]), [grids[1], ills[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const urls = [a, b];
  return (
    <Reveal delay={0.08}>
      <Card className="h-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Shadow map · Sun at {sunElev.toFixed(1)}°</div>
            <h3 className="mt-1 text-[19px] font-medium tracking-tight">Where the light never reaches</h3>
          </div>
          <KindBadge kind="computed" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <figure key={i}>
              <div className="aspect-square overflow-hidden rounded-xl border border-line bg-ink">
                {urls[i] ? (
                  <motion.img src={urls[i]!} alt={`Illumination map of ${names[i]}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center font-mono text-[10px] text-dim uppercase">computing…</div>
                )}
              </div>
              <figcaption className="mt-2 flex items-baseline justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-platinum">
                  <WorldDot world={i === 0 ? "earth" : targetBody} /> {names[i]}
                </span>
                <span className="font-mono text-chrome">{ills[i] ? `${(ills[i]!.persistentShadow * 100).toFixed(1)}% dark` : "…"}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 text-[11px] text-dim">
          <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#0a1230,#101a3a,#f2c879)" }} />
          never lit → lit from every direction
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-dim">We check 24 directions around every point. If hills block the low Sun from all of them, the point stays dark. Deep blue means always dark, where ice could last.</p>
      </Card>
    </Reveal>
  );
}

/* =========================================================== sustainability */

function Sustainability({ task, targetId, earth, onPick }: { task: TaskId; targetId: string; earth: EarthSite; onPick: (id: string) => void }) {
  const [home, setHome] = useState("dhaka");
  const base = HOME_BASES.find((h) => h.id === home)!;
  const target = TARGET_BY_ID[targetId];
  const km = greatCircleKm(base.lat, base.lon, earth.lat, earth.lon);
  const stew = STEWARDSHIP[earth.id];
  const ranked = useMemo(
    () =>
      EARTH_SITES.map((s) => {
        const d = demoValues(s, target);
        const l = lightTwin(s.lat, target.body, target.lat).score;
        const res: ParamResult[] = [
          { id: "topography", value: d.topography, kind: "demo", note: "" },
          { id: "geology", value: d.geology, kind: "demo", note: "" },
          { id: "temperature", value: d.temperature, kind: "demo", note: "" },
          { id: "lighting", value: l, kind: "computed", note: "" },
          { id: "regolith", value: d.regolith, kind: "demo", note: "" },
        ];
        return { s, score: analogFit(res, TASK_WEIGHTS[task]).score, km: greatCircleKm(base.lat, base.lon, s.lat, s.lon) };
      })
        .filter((x) => x.score >= 0.55)
        .sort((a, b) => a.km - b.km)
        .slice(0, 4),
    [target, task, base],
  );
  return (
    <Reveal>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="p-6">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-3 py-2.5 text-[12px]">
            <span className="text-dim">Team based in</span>
            <select value={home} onChange={(e) => setHome(e.target.value)} className="cursor-pointer bg-transparent text-right text-platinum outline-none">
              {HOME_BASES.map((h) => (
                <option key={h.id} value={h.id} className="bg-panel">
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-6 flex items-center gap-2 text-[12px] text-dim">
            <Plane size={13} /> To {earth.name.split(",")[0]}
          </div>
          <div className="mt-1 font-mono text-[34px] leading-none font-light text-platinum tabular">{Math.round(km).toLocaleString()} km</div>
          <div className="mt-5 flex items-center gap-2 text-[12px] text-dim">
            <Leaf size={13} className="text-strong" /> 4-person round trip
          </div>
          <div className="mt-1 font-mono text-[34px] leading-none font-light text-platinum tabular">≈ {tripCo2Tonnes(km, 4).toFixed(1)} t CO₂e</div>
          {stew && (
            <div className="mt-6 flex gap-3 rounded-xl border border-line bg-ink p-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-chrome" />
              <div>
                <div className="text-[12.5px] text-platinum">{stew.status}</div>
                <div className="text-[12px] leading-relaxed text-dim">{stew.note}</div>
              </div>
            </div>
          )}
          <p className="mt-4 text-[10.5px] leading-relaxed text-dim">Straight-line distance ×1.08 and 0.15 kg CO₂e per passenger-km. A rough estimate.</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {ranked.map(({ s, score, km }, i) => (
            <motion.button
              key={s.id}
              onClick={() => {
                onPick(s.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-line bg-panel text-left"
            >
              <div className="h-32 overflow-hidden">
                <img src={`/thumbs/${s.id}.webp`} alt="" loading="lazy" className="size-full object-cover opacity-90 transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105" />
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] text-platinum">{s.name}</span>
                  <span className="font-mono text-[13px] text-chrome">{score.toFixed(2)}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-dim">
                  {Math.round(km).toLocaleString()} km · ≈{tripCo2Tonnes(km, 4).toFixed(1)} t CO₂e
                </div>
              </div>
              {i === 0 && <span className="absolute top-3 left-3 rounded-full bg-strong/90 px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-void uppercase">closest credible</span>}
            </motion.button>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

/* ==================================================================== gaps */

const GAPS = {
  moon: [
    { k: "Gravity", v: "0.166 g", e: "Earth is always 1 g" },
    { k: "Atmosphere", v: "≈ none", e: "Hard vacuum; Earth 101 kPa" },
    { k: "Radiation", v: "≈ 1.4 mSv/day", e: "Chang'e 4 LND · Earth ≈ 0.007" },
    { k: "Solar day", v: "29.5 days", e: "Two-week nights" },
  ],
  mars: [
    { k: "Gravity", v: "0.38 g", e: "Earth is always 1 g" },
    { k: "Atmosphere", v: "≈ 0.6 kPa CO₂", e: "≈ 0.6% of Earth's pressure" },
    { k: "Radiation", v: "≈ 0.7 mSv/day", e: "Curiosity RAD · Earth ≈ 0.007" },
    { k: "Solar day", v: "24 h 39 m", e: "Close to Earth's" },
  ],
};

function RealityGaps({ world }: { world: "moon" | "mars" }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {GAPS[world].map((g, i) => (
        <motion.div key={g.k} className="bg-panel p-6" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.07 }}>
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">{g.k}</div>
          <div className="mt-3 text-[28px] font-light tracking-tight text-platinum">{g.v}</div>
          <div className="mt-1 text-[12.5px] text-chrome">{g.e}</div>
        </motion.div>
      ))}
    </div>
  );
}

function Insight({
  measured,
  earthName,
  targetName,
  topo,
  statsE,
  statsT,
  light,
  illE,
  illT,
  fit,
}: {
  earthName: string;
  targetName: string;
  topo: number | null;
  statsE: TerrainStats | null;
  statsT: TerrainStats | null;
  light: ReturnType<typeof lightTwin>;
  illE: Illumination | null;
  illT: Illumination | null;
  fit: number;
  measured: boolean;
}) {
  const lines: string[] = [];
  if (topo !== null && statsE && statsT) {
    const r = statsE.relief / Math.max(1, statsT.relief);
    lines.push(`Topography ${topo.toFixed(2)}: slope distributions ${topo >= 0.6 ? "overlap well" : "differ"} on the shared grid; ${earthName}'s relief is ${r >= 1 ? r.toFixed(1) + "×" : (1 / r).toFixed(1) + "× lower than"} ${targetName}'s.`);
  }
  lines.push(`Lighting ${light.score.toFixed(2)}: plan field work in ${light.best.join(", ") || "n/a"}, when ${earthName}'s Sun-angle pattern is closest.`);
  if (illE && illT)
    lines.push(
      `Under the same Sun, ${(illE.persistentShadow * 100).toFixed(1)}% of ${earthName} never sees light versus ${(illT.persistentShadow * 100).toFixed(1)}% of ${targetName}, ${illE.persistentShadow < illT.persistentShadow * 0.5 ? "shadow-trap rehearsal will be weaker than the real thing" : "a usable shadow rehearsal"}.`,
    );
  lines.push(
    measured
      ? `Overall ${fit.toFixed(2)}: rocks, cold and bare ground come from NASA POWER, MODIS and volcano and crater records for this exact 55 km area.`
      : `Overall ${fit.toFixed(2)} is provisional while the global data loads.`,
  );
  return (
    <Reveal>
      <Card className="h-full p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">In short</div>
        <h3 className="mt-1 text-[19px] font-medium tracking-tight">What the numbers say</h3>
        <ol className="mt-5 space-y-3">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-chrome">
              <span className="font-mono text-[11px] text-flare">{String(i + 1).padStart(2, "0")}</span>
              {l}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-[11px] text-dim">Written from the numbers above by a simple template. No AI text, no made-up facts.</p>
      </Card>
    </Reveal>
  );
}

function ModelRoadmap() {
  const steps = [
    { k: "Done", t: "Every place measured", d: "80,206 land areas scored from NASA POWER, MODIS, terrain tiles, volcanoes and craters.", on: true },
    { k: "Done", t: "Learned model, tested", d: "Trained on 38 known sites. Hidden sites come back in the top few percent of all land.", on: true },
    { k: "Next", t: "Terrain encoder", d: "A neural network that compares the shape of the ground directly, trained on GPUs." },
  ];
  return (
    <Reveal delay={0.08}>
      <Card className="h-full p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Progress</div>
        <h3 className="mt-1 text-[19px] font-medium tracking-tight">What is built, what is next</h3>
        <ol className="relative mt-5 space-y-5 border-l border-line pl-5">
          {steps.map((s) => (
            <li key={s.t} className="relative">
              <span className={clsx("absolute top-1.5 -left-[25px] size-2.5 rounded-full border", s.on ? "border-flare bg-flare" : "border-line-2 bg-void")} />
              <div className="font-mono text-[10px] tracking-widest text-dim uppercase">{s.k}</div>
              <div className="text-[14px] text-platinum">{s.t}</div>
              <div className="text-[12.5px] text-chrome">{s.d}</div>
            </li>
          ))}
        </ol>
        <Link to="/methods" className="link-wipe mt-5 inline-flex items-center gap-1.5 text-[13px] text-chrome">
          Read the method <ArrowRight size={13} />
        </Link>
      </Card>
    </Reveal>
  );
}

/* ============================================================ climate line */

function ClimateLine({ grid, cell }: { grid: Grid; cell: number }) {
  const v = (n: string) => grid.value(n, cell);
  const items: [string, number | null, string][] = [
    ["Coldest night", v("f_lst_night_min"), " °C"],
    ["Hottest day", v("f_lst_day_max"), " °C"],
    ["Rain a year", v("f_precip"), " mm"],
  ];
  return (
    <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
      {items.map(([k, x, u]) => (
        <div key={k} className="bg-ink p-3">
          <div className="text-[10.5px] text-dim">{k}</div>
          <div className="mt-0.5 font-mono text-[14px] text-platinum">{x === null ? "n/a" : `${Math.round(x)}${u}`}</div>
        </div>
      ))}
    </div>
  );
}
