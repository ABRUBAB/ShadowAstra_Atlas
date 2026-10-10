import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { animate, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Cpu, Leaf, Link2, Link2Off, Pause, Play, Plane, RotateCcw, ShieldCheck, Sun } from "lucide-react";
import { Footer, Nav, WorldDot, WORLD_COLOR } from "../components/ui/Chrome";
import { Astronaut, reactionFor } from "../components/ui/Astronaut";
import { BodyMap, type BodyMapHandle, type MapView } from "../components/map/BodyMap";
import { SwipeStage } from "../components/map/Swipe";
import type { Overlay } from "../components/three/TerrainTwins";
import { EARTH_BY_ID, EARTH_SITES, TARGETS, TARGET_BY_ID, TASKS, type TaskId } from "../data/sites";
import { formatCoord } from "../lib/geo";
import { DEM, illumination, nativeKm, sampleTerrain, SLOPE_BINS, terrainStats, topographySimilarity, type Illumination, type TerrainGrid, type TerrainStats } from "../lib/terrain";
import { lightTwin, SUN_BINS } from "../lib/sun";
import {
  analogFit,
  band,
  demoValues,
  greatCircleKm,
  HOME_BASES,
  PARAMS,
  STEWARDSHIP,
  TASK_WEIGHTS,
  tripCo2Tonnes,
  type ParamResult,
  type Weights,
} from "../lib/scoring";

const TerrainTwins = lazy(() => import("../components/three/TerrainTwins"));

const FOOTPRINTS = [40, 80, 160];

/* ------------------------------------------------------------ data hooks */

interface TwinState {
  earth: TerrainGrid | null;
  target: TerrainGrid | null;
  statsE: TerrainStats | null;
  statsT: TerrainStats | null;
  progress: number;
  error: string | null;
}

function useTerrainTwins(earthId: string, targetId: string, footprintKm: number) {
  const [s, setS] = useState<TwinState>({ earth: null, target: null, statsE: null, statsT: null, progress: 0, error: null });
  useEffect(() => {
    let alive = true;
    const e = EARTH_BY_ID[earthId];
    const t = TARGET_BY_ID[targetId];
    // Shared scale: the coarser native spacing of the two, never finer than footprint/128.
    const spacing = Math.max(nativeKm(DEM[t.body], DEM[t.body].maxZoom, 0), footprintKm / 128);
    const prog = { a: 0, b: 0 };
    const tick = () => alive && setS((p) => ({ ...p, progress: (prog.a + prog.b) / 2 }));
    setS((p) => ({ ...p, progress: 0.02, error: null }));
    Promise.all([
      sampleTerrain({ body: "earth", lat: e.lat, lon: e.lon, footprintKm, spacingKm: spacing, onProgress: (d, n) => ((prog.a = d / n), tick()) }),
      sampleTerrain({ body: t.body, lat: t.lat, lon: t.lon, footprintKm, spacingKm: spacing, onProgress: (d, n) => ((prog.b = d / n), tick()) }),
    ])
      .then(([ge, gt]) => {
        if (!alive) return;
        setS({ earth: ge, target: gt, statsE: terrainStats(ge), statsT: terrainStats(gt), progress: 1, error: null });
      })
      .catch(() => alive && setS((p) => ({ ...p, error: "Terrain tiles could not be loaded. Check your connection." })));
    return () => {
      alive = false;
    };
  }, [earthId, targetId, footprintKm]);
  return s;
}

function useIllumination(grid: TerrainGrid | null, sunElev: number) {
  const [ill, setIll] = useState<Illumination | null>(null);
  useEffect(() => {
    if (!grid) return;
    setIll(null);
    const id = setTimeout(() => setIll(illumination(grid, sunElev)), 30);
    return () => clearTimeout(id);
  }, [grid, sunElev]);
  return ill;
}

/* ------------------------------------------------------------------ page */

export default function Lab() {
  const [params, setParams] = useSearchParams();
  const [earthId, setEarthId] = useState(() => (EARTH_BY_ID[params.get("earth") ?? ""] ? params.get("earth")! : "dry-valleys"));
  const [targetId, setTargetId] = useState(() => (TARGET_BY_ID[params.get("target") ?? ""] ? params.get("target")! : "shackleton"));
  const [task, setTask] = useState<TaskId>(() => (TASKS.some((t) => t.id === params.get("task")) ? (params.get("task") as TaskId) : "polar"));
  const [footprint, setFootprint] = useState(80);
  const [weights, setWeights] = useState<Weights>(TASK_WEIGHTS[task]);
  const [overlay, setOverlay] = useState<Overlay>("light");
  const [sunAz, setSunAz] = useState(135);
  const [playing, setPlaying] = useState(false);
  const [exag, setExag] = useState(3);
  const [home, setHome] = useState("dhaka");

  const earth = EARTH_BY_ID[earthId];
  const target = TARGET_BY_ID[targetId];

  useEffect(() => {
    setParams({ earth: earthId, target: targetId, task }, { replace: true });
  }, [earthId, targetId, task, setParams]);
  useEffect(() => setWeights(TASK_WEIGHTS[task]), [task]);

  const twins = useTerrainTwins(earthId, targetId, footprint);
  const light = useMemo(() => lightTwin(earth.lat, target.body, target.lat), [earth.lat, target.body, target.lat]);
  const defaultSun = Math.max(0.5, Math.round(light.target.medianElev * 10) / 10);
  const [sunElev, setSunElev] = useState(defaultSun);
  useEffect(() => {
    setSunElev(defaultSun);
    // Shadows tell the story under a grazing Sun; relief reads better under a high one.
    setOverlay(defaultSun < 10 ? "light" : "relief");
  }, [defaultSun]);
  const illE = useIllumination(twins.earth, sunElev);
  const illT = useIllumination(twins.target, sunElev);

  const topo = twins.statsE && twins.statsT ? topographySimilarity(twins.statsE, twins.statsT) : null;
  const demo = demoValues(earth, target);
  const paramResults: ParamResult[] = [
    { id: "topography", value: topo ?? demo.topography, kind: topo !== null ? "computed" : "demo", note: topo !== null ? "Slope histogram + relief, shared grid" : "Waiting for terrain" },
    { id: "geology", value: demo.geology, kind: "demo", note: "Literature placeholder" },
    { id: "temperature", value: demo.temperature, kind: "demo", note: "Literature placeholder" },
    { id: "lighting", value: light.score, kind: "computed", note: "Sun-elevation match in the best season" },
    { id: "regolith", value: demo.regolith, kind: "demo", note: "Literature placeholder" },
    { id: "radiation", value: null, kind: "gap", note: "Not reproducible on Earth" },
  ];
  const fit = analogFit(paramResults, weights);

  const pairedTargets = useMemo(() => [...earth.pairs.map((p) => TARGET_BY_ID[p]), ...TARGETS.filter((t) => !earth.pairs.includes(t.id))], [earth]);

  return (
    <div className="bg-void">
      <Nav />
      {/* -------------------------------------------------- control bar */}
      <div className="z-40 border-b border-line bg-void/90 backdrop-blur-xl lg:sticky lg:top-16">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2.5 px-4 py-3 sm:px-6">
          <PairSelect world="earth" value={earthId} onChange={setEarthId} options={EARTH_SITES.map((s) => ({ id: s.id, label: s.name }))} />
          <span className="font-serif text-lg text-dim italic">rehearses</span>
          <PairSelect
            world={target.body}
            value={targetId}
            onChange={setTargetId}
            options={pairedTargets.map((t) => ({ id: t.id, label: `${earth.pairs.includes(t.id) ? "● " : ""}${t.name} · ${t.body === "moon" ? "Moon" : "Mars"}` }))}
          />
          <div className="mx-1 hidden h-6 w-px bg-line lg:block" />
          <label className="flex items-center gap-2 rounded-full border border-line-2 bg-ink py-1 pr-1 pl-3">
            <span className="font-mono text-[10px] tracking-widest text-dim uppercase">Task</span>
            <select value={task} onChange={(e) => setTask(e.target.value as TaskId)} className="cursor-pointer rounded-full bg-transparent py-1.5 pr-2 text-[13px] text-platinum outline-none">
              {TASKS.map((t) => (
                <option key={t.id} value={t.id} className="bg-panel">
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1 rounded-full border border-line bg-ink p-1">
            {FOOTPRINTS.map((f) => (
              <button
                key={f}
                onClick={() => setFootprint(f)}
                className={clsx("rounded-full px-3 py-1 font-mono text-[11px] transition-colors", footprint === f ? "bg-platinum text-void" : "text-chrome hover:text-platinum")}
              >
                {f} km
              </button>
            ))}
          </div>
          <span className="ml-auto hidden items-center gap-2 rounded-full border border-dashed border-line-2 px-3 py-1.5 text-[11px] text-chrome xl:flex">
            <Cpu size={13} /> Prototype · 2 computed metrics + demo values · model training at the hackathon
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
          <div>
            <div className="font-mono text-[11px] tracking-[0.22em] text-dim uppercase">Analog Lab</div>
            <h1 className="mt-2 text-[clamp(28px,3.4vw,48px)] leading-[1.02] font-medium tracking-[-0.035em]">
              {earth.name.split(",")[0]} <span className="font-serif font-normal text-dim italic">as</span>{" "}
              <span style={{ color: WORLD_COLOR[target.body] }}>{target.name}</span>
            </h1>
            <p className="mt-2 text-[14px] text-chrome">{TASKS.find((t) => t.id === task)!.question}</p>
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-dim tabular">
            <div>
              <WorldDot world="earth" className="mr-2" />
              {formatCoord(earth.lat, earth.lon)} · {earth.country}
            </div>
            <div>
              <WorldDot world={target.body} className="mr-2" />
              {formatCoord(target.lat, target.lon)} · {target.region}
            </div>
          </div>
        </header>

        {/* -------------------------------------------- row A: twins + fit */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card className="relative overflow-hidden p-0">
            <div className="relative h-[460px] md:h-[560px]">
              {twins.earth && twins.target ? (
                <Suspense fallback={<Loader label="Preparing 3D terrain" />}>
                  <TerrainTwins
                    earth={twins.earth}
                    target={twins.target}
                    litEarth={illE?.lit ?? null}
                    litTarget={illT?.lit ?? null}
                    footprintKm={footprint}
                    sunElev={sunElev}
                    sunAz={sunAz}
                    playing={playing}
                    exaggeration={exag}
                    overlay={overlay}
                  />
                </Suspense>
              ) : (
                <Loader label={twins.error ?? `Streaming elevation tiles · ${Math.round(twins.progress * 100)}%`} progress={twins.progress} />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                <TwinLabel world="earth" name={earth.name.split(",")[0]} grid={twins.earth} />
                <div className="hidden text-center md:block">
                  <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Terrain twins</div>
                  <div className="mt-1 text-[12px] text-chrome">
                    {footprint} × {footprint} km · same scale · {exag}× vertical
                  </div>
                </div>
                <TwinLabel world={target.body} name={target.name} grid={twins.target} right />
              </div>
              <div className="pointer-events-none absolute right-5 bottom-[72px] z-10 hidden sm:block">
                <Astronaut size={96} {...reactionFor(twins.statsE ? fit.score : null, !twins.statsE)} sayAlign="left" />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-void/85 p-3 backdrop-blur-xl">
                <Seg
                  value={overlay}
                  onChange={(v) => setOverlay(v as Overlay)}
                  options={[
                    { id: "light", label: "Light & shadow" },
                    { id: "relief", label: "Relief" },
                  ]}
                />
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="flex items-center gap-1.5 rounded-full border border-flare/50 px-3 py-1.5 text-[12px] text-flare transition-colors hover:bg-flare/10"
                >
                  {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Pause Sun" : "Turn the Sun"}
                </button>
                <label className="flex items-center gap-2 text-[11px] text-chrome">
                  <span className="font-mono">AZ</span>
                  <input type="range" min={0} max={359} value={sunAz} onChange={(e) => setSunAz(+e.target.value)} className="w-24 accent-[#f2c879]" aria-label="Sun azimuth" />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-chrome">
                  <Sun size={13} className="text-flare" />
                  <input
                    type="range"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={sunElev}
                    onChange={(e) => setSunElev(+e.target.value)}
                    className="w-24 accent-[#f2c879]"
                    aria-label="Sun elevation"
                  />
                  <span className="w-11 font-mono text-platinum tabular">{sunElev.toFixed(1)}°</span>
                </label>
                {sunElev !== defaultSun && (
                  <button onClick={() => setSunElev(defaultSun)} className="text-[11px] text-dim hover:text-chrome" title="Reset to the target's median Sun">
                    <RotateCcw size={12} />
                  </button>
                )}
                <Seg value={String(exag)} onChange={(v) => setExag(+v)} options={[1, 3, 6].map((x) => ({ id: String(x), label: `${x}×` }))} />
                {overlay === "light" && (
                  <div className="ml-auto flex items-center gap-2 text-[10px] text-dim">
                    <span className="h-2 w-16 rounded-full" style={{ background: "linear-gradient(90deg,#0a1230,#101a3a,#f2c879)" }} />
                    never lit → always lit
                  </div>
                )}
              </div>
            </div>
          </Card>

          <FitCard params={paramResults} fit={fit} weights={weights} setWeights={setWeights} task={task} loading={!twins.statsE} />
        </div>

        {/* ------------------------------------- row B: metrics + light twin */}
        <div className="grid gap-4 lg:grid-cols-2">
          <TerrainMetrics statsE={twins.statsE} statsT={twins.statsT} illE={illE} illT={illT} sunElev={sunElev} target={target.body} topo={topo} />
          <LightTwinCard light={light} targetBody={target.body} targetName={target.name} earthName={earth.name.split(",")[0]} />
        </div>

        {/* ---------------------------------- row C: imagery + sustainability */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <ImageryCard earthId={earthId} targetId={targetId} />
          <Sustainability home={home} setHome={setHome} task={task} targetId={targetId} earthId={earthId} onPick={setEarthId} />
        </div>

        {/* ---------------------------------------- row D: gaps + insight */}
        <RealityGaps world={target.body} />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Insight earthName={earth.name.split(",")[0]} targetName={target.name} topo={topo} statsE={twins.statsE} statsT={twins.statsT} light={light} illE={illE} illT={illT} fit={fit.score} />
          <ModelRoadmap />
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------ components */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-2xl border border-line bg-panel p-5", className)}>{children}</section>;
}

function CardHead({ k, title, kind, children }: { k: string; title: string; kind?: "computed" | "demo"; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">{k}</div>
        <h2 className="mt-1 text-[19px] font-medium tracking-tight">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {kind && <KindBadge kind={kind} />}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: "computed" | "demo" | "gap" }) {
  const map = {
    computed: "border-strong/40 bg-strong/10 text-strong",
    demo: "border-dashed border-line-2 text-chrome",
    gap: "border-weak/40 bg-weak/10 text-weak",
  };
  const label = { computed: "Computed", demo: "Demo", gap: "Reality gap" };
  return <span className={clsx("rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-wider uppercase", map[kind])}>{label[kind]}</span>;
}

function Loader({ label, progress }: { label: string; progress?: number }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="w-64 text-center">
        <div className="font-mono text-[11px] tracking-widest text-chrome uppercase">{label}</div>
        {progress !== undefined && (
          <div className="mt-3 h-px w-full bg-line">
            <motion.div className="h-px bg-flare" animate={{ width: `${Math.max(4, progress * 100)}%` }} transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }} />
          </div>
        )}
      </div>
    </div>
  );
}

function TwinLabel({ world, name, grid, right }: { world: "earth" | "moon" | "mars"; name: string; grid: TerrainGrid | null; right?: boolean }) {
  return (
    <div className={clsx("panel rounded-xl px-3 py-2", right && "text-right")}>
      <div className={clsx("flex items-center gap-2 text-[13px] font-medium", right && "justify-end")}>
        <WorldDot world={world} /> {name}
      </div>
      {grid && (
        <div className="mt-0.5 hidden font-mono text-[10px] text-dim sm:block">
          {grid.source.name.split(" (")[0]} · {grid.spacingKm.toFixed(2)} km/cell
        </div>
      )}
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div className="relative flex gap-0.5 rounded-full border border-line bg-ink p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={clsx("relative rounded-full px-3 py-1 text-[12px] transition-colors", value === o.id ? "text-void" : "text-chrome hover:text-platinum")}>
          {value === o.id && <motion.span layoutId={`seg-${options.map((x) => x.id).join("")}`} className="absolute inset-0 rounded-full bg-platinum" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function PairSelect({ world, value, onChange, options }: { world: "earth" | "moon" | "mars"; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-line-2 bg-ink py-1 pr-1 pl-3">
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
    const c = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = v.toFixed(digits)),
    });
    prev.current = value;
    return () => c.stop();
  }, [value, digits, reduce]);
  return <span ref={ref} className="tabular">{value.toFixed(digits)}</span>;
}

const TONE = { strong: "#7cc8a0", partial: "#e3b35e", weak: "#e47a63" };

function FitCard({
  params,
  fit,
  weights,
  setWeights,
  task,
  loading,
}: {
  params: ParamResult[];
  fit: { score: number; computedShare: number };
  weights: Weights;
  setWeights: (w: Weights) => void;
  task: TaskId;
  loading: boolean;
}) {
  const b = band(fit.score);
  void loading;
  const C = 2 * Math.PI * 54;
  const [open, setOpen] = useState(false);
  return (
    <Card className="relative">
      <CardHead k="Analog fit · mission-weighted" title={TASKS.find((t) => t.id === task)!.label} />
      <div className="flex items-center gap-6">
        <div className="relative size-[132px] shrink-0">
          <svg viewBox="0 0 128 128" className="size-full -rotate-90">
            <circle cx="64" cy="64" r="54" fill="none" stroke="#212226" strokeWidth="7" />
            <circle cx="64" cy="64" r="54" fill="none" stroke="#2f3035" strokeWidth="7" strokeDasharray={`${C * fit.computedShare} ${C}`} opacity={0.9} transform="scale(1)" />
            <motion.circle
              cx="64"
              cy="64"
              r="54"
              fill="none"
              stroke={TONE[b.tone]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              animate={{ strokeDashoffset: C * (1 - fit.score) }}
              initial={{ strokeDashoffset: C }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-mono text-[30px] leading-none font-light">
                <CountUp value={fit.score} />
              </div>
              <div className="mt-1 text-[11px]" style={{ color: TONE[b.tone] }}>
                {b.label}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2 text-[12px] text-chrome">
          <p>
            <span className="text-platinum">{Math.round(fit.computedShare * 100)}%</span> of this score is computed from NASA data in your browser; the rest
            is demo until our model is trained.
          </p>
          <div className="flex gap-3 font-mono text-[10px] text-dim">
            <span>
              <span className="text-strong">●</span> ≥0.75 high
            </span>
            <span>
              <span className="text-partial">●</span> 0.50–0.74
            </span>
            <span>
              <span className="text-weak">●</span> &lt;0.50
            </span>
          </div>
        </div>
      </div>

      <ul className="mt-6 border-t border-line">
        {params.map((p) => {
          const meta = PARAMS.find((x) => x.id === p.id)!;
          const w = p.kind === "gap" ? null : weights[p.id as keyof Weights];
          return (
            <li key={p.id} className="border-b border-line py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-platinum">{meta.label}</span>
                  <KindBadge kind={p.kind} />
                </div>
                <span className="font-mono text-[13px] text-platinum tabular">{p.value === null ? "—" : p.value.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
                {p.value !== null && (
                  <motion.div
                    className={clsx("h-full rounded-full", p.kind === "computed" ? "bg-platinum" : "bg-chrome/50")}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.value * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-dim">
                <span>{p.kind === "gap" ? "Earth's magnetic field and atmosphere block it — shown, never scored" : meta.what}</span>
                {w !== null && <span className="font-mono">w {Math.round(w * 100)}%</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <button onClick={() => setOpen((o) => !o)} className="mt-4 text-[12px] text-chrome link-wipe">
        {open ? "Hide" : "Adjust"} mission weights
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
            <label key={k} className="flex items-center gap-3 text-[12px]">
              <span className="w-24 text-chrome capitalize">{k}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: +e.target.value })}
                className="flex-1 accent-[#edeae4]"
              />
              <span className="w-9 text-right font-mono text-dim">{Math.round(weights[k] * 100)}</span>
            </label>
          ))}
          <button onClick={() => setWeights(TASK_WEIGHTS[task])} className="text-[11px] text-dim hover:text-chrome">
            Reset to {TASKS.find((t) => t.id === task)!.short} preset
          </button>
        </div>
      )}
    </Card>
  );
}

function Bars({ a, b, labels, colorB }: { a: number[]; b: number[]; labels: string[]; colorB: string }) {
  const max = Math.max(...a, ...b, 0.01);
  return (
    <div>
      <div className="flex h-36 items-end gap-2">
        {a.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end gap-[3px]">
            <motion.div className="flex-1 rounded-t-[2px] bg-earth/80" initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 }} />
            <motion.div className="flex-1 rounded-t-[2px]" style={{ background: colorB }} initial={{ height: 0 }} animate={{ height: `${(b[i] / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 + 0.05 }} />
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

function TerrainMetrics({
  statsE,
  statsT,
  illE,
  illT,
  sunElev,
  target,
  topo,
}: {
  statsE: TerrainStats | null;
  statsT: TerrainStats | null;
  illE: Illumination | null;
  illT: Illumination | null;
  sunElev: number;
  target: "moon" | "mars";
  topo: number | null;
}) {
  const labels = SLOPE_BINS.slice(0, -1).map((v, i) => (i === SLOPE_BINS.length - 2 ? `${v}°+` : `${v}°`));
  const rows: [string, (s: TerrainStats) => string][] = [
    ["Mean slope", (s) => `${s.meanSlope.toFixed(1)}°`],
    ["90th-pct slope", (s) => `${s.p90Slope.toFixed(1)}°`],
    ["Relief (P2–P98)", (s) => `${(s.relief / 1000).toFixed(2)} km`],
    ["Roughness", (s) => `${s.roughness.toFixed(0)} m`],
  ];
  return (
    <Card>
      <CardHead k="Topography · shared grid" title="Slope distribution" kind="computed">
        {topo !== null && <span className="font-mono text-[13px] text-platinum">{topo.toFixed(2)}</span>}
      </CardHead>
      {statsE && statsT ? (
        <>
          <Bars a={statsE.slopeHist} b={statsT.slopeHist} labels={labels} colorB={WORLD_COLOR[target]} />
          <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2 text-[12.5px]">
            <span className="font-mono text-[10px] tracking-widest text-dim uppercase">Metric</span>
            <span className="text-right font-mono text-[10px] tracking-widest text-earth uppercase">Earth</span>
            <span className="text-right font-mono text-[10px] tracking-widest uppercase" style={{ color: WORLD_COLOR[target] }}>
              {target}
            </span>
            {rows.map(([k, f]) => (
              <Row3 key={k} k={k} a={f(statsE)} b={f(statsT)} />
            ))}
            <Row3 k={`Never lit · Sun ${sunElev.toFixed(1)}°`} a={illE ? `${(illE.persistentShadow * 100).toFixed(1)}%` : "…"} b={illT ? `${(illT.persistentShadow * 100).toFixed(1)}%` : "…"} />
            <Row3 k="Mean illumination" a={illE ? `${(illE.meanLit * 100).toFixed(0)}%` : "…"} b={illT ? `${(illT.meanLit * 100).toFixed(0)}%` : "…"} />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-dim">
            Slopes over 2 cells; Moon/Mars from 8-bit preview DEMs (lightly smoothed). Shadows: horizon method, 24 azimuths, Sun at constant
            elevation as at the lunar poles. Preview-grade — full-precision DEMs come with the pipeline.
          </p>
        </>
      ) : (
        <div className="grid h-56 place-items-center text-[12px] text-dim">Waiting for terrain…</div>
      )}
    </Card>
  );
}

function Row3({ k, a, b }: { k: string; a: string; b: string }) {
  return (
    <>
      <span className="border-t border-line pt-2 text-chrome">{k}</span>
      <span className="border-t border-line pt-2 text-right font-mono text-platinum tabular">{a}</span>
      <span className="border-t border-line pt-2 text-right font-mono text-platinum tabular">{b}</span>
    </>
  );
}

function LightTwinCard({ light, targetBody, targetName, earthName }: { light: ReturnType<typeof lightTwin>; targetBody: "moon" | "mars"; targetName: string; earthName: string }) {
  const labels = SUN_BINS.slice(0, -1).map((v) => `${v}°`);
  const top = Math.max(...light.months.map((m) => m.score), 0.01);
  return (
    <Card>
      <CardHead k="Lighting · light twin" title="When does Earth's Sun behave like theirs?" kind="computed">
        <span className="font-mono text-[13px] text-platinum">{light.score.toFixed(2)}</span>
      </CardHead>
      <Bars a={light.earth.hist} b={light.target.hist} labels={labels} colorB={WORLD_COLOR[targetBody]} />
      <div className="mt-2 flex justify-between text-[11px] text-dim">
        <span>Daylight Sun elevation, whole year · annual match {light.annual.toFixed(2)}</span>
        <span className="font-mono">median {light.earth.medianElev.toFixed(0)}° / {light.target.medianElev.toFixed(1)}°</span>
      </div>

      <div className="mt-6 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Rehearsal calendar</div>
      <div className="mt-2 grid grid-cols-12 gap-1">
        {light.months.map((m) => {
          const best = light.best.includes(m.month);
          return (
            <div key={m.month} className="text-center">
              <div className="flex h-16 items-end overflow-hidden rounded-[3px] bg-ink">
                <motion.div
                  className={clsx("w-full", best ? "bg-flare" : "bg-line-2")}
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.score / top) * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className={clsx("mt-1 font-mono text-[9.5px]", best ? "text-flare" : "text-dim")}>{m.month}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] text-chrome">
        Best window at {earthName}: <span className="text-flare">{light.best.join(" · ") || "—"}</span> — the months when its Sun-angle
        pattern is closest to {targetName}. Plan field seasons here.
      </p>
    </Card>
  );
}

function ImageryCard({ earthId, targetId }: { earthId: string; targetId: string }) {
  const earth = EARTH_BY_ID[earthId];
  const target = TARGET_BY_ID[targetId];
  const polar = target.body === "moon" && target.lat < -80;
  const eRef = useRef<BodyMapHandle>(null);
  const tRef = useRef<BodyMapHandle>(null);
  const [swipe, setSwipe] = useState(0.5);
  const [locked, setLocked] = useState(true);
  const [mpp, setMpp] = useState<number | null>(null);
  const targetLayer = polar ? "moon-south-pole" : target.body === "moon" ? "moon-wac" : "mars-viking";

  const onE = useCallback(
    (v: MapView) => {
      setMpp(v.metresPerPixel);
      if (locked) tRef.current?.setMetresPerPixel(v.metresPerPixel);
    },
    [locked],
  );
  const onT = useCallback(
    (v: MapView) => {
      if (locked) eRef.current?.setMetresPerPixel(v.metresPerPixel);
    },
    [locked],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      eRef.current?.flyTo(earth.lat, earth.lon, 8);
      tRef.current?.flyTo(target.lat, target.lon, polar ? 1.2 : 6);
    }, 150);
    return () => clearTimeout(t);
  }, [earthId, targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">NASA imagery · swipe</div>
          <h2 className="mt-1 text-[19px] font-medium tracking-tight">Same scale, two worlds</h2>
        </div>
        <div className="flex items-center gap-2">
          {mpp && <span className="font-mono text-[11px] text-dim">{mpp >= 1000 ? `${(mpp / 1000).toFixed(2)} km` : `${mpp.toFixed(0)} m`}/px</span>}
          <button
            onClick={() => setLocked((l) => !l)}
            className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]", locked ? "border-platinum/40 text-platinum" : "border-line-2 text-chrome")}
          >
            {locked ? <Link2 size={13} /> : <Link2Off size={13} />} Matched scale
          </button>
        </div>
      </div>
      <SwipeStage
        className="h-[420px] border-t border-line"
        value={swipe}
        onChange={setSwipe}
        leftLabel={earth.name.split(",")[0]}
        rightLabel={target.name}
        rightWorld={target.body}
        left={
          <BodyMap
            ref={eRef}
            body="earth"
            layerId="earth-bluemarble"
            markers={[{ id: earth.id, lat: earth.lat, lon: earth.lon, color: WORLD_COLOR.earth, label: earth.name }]}
            activeId={earth.id}
            onViewChange={onE}
            initial={{ lat: earth.lat, lon: earth.lon, zoom: 8 }}
          />
        }
        right={
          <BodyMap
            ref={tRef}
            body={target.body}
            layerId={targetLayer}
            markers={[{ id: target.id, lat: target.lat, lon: target.lon, color: "#ffffff", label: target.name }]}
            activeId={target.id}
            onViewChange={onT}
            initial={{ lat: target.lat, lon: target.lon, zoom: 6 }}
          />
        }
      />
    </Card>
  );
}

function Sustainability({
  home,
  setHome,
  task,
  targetId,
  earthId,
  onPick,
}: {
  home: string;
  setHome: (h: string) => void;
  task: TaskId;
  targetId: string;
  earthId: string;
  onPick: (id: string) => void;
}) {
  const base = HOME_BASES.find((h) => h.id === home)!;
  const target = TARGET_BY_ID[targetId];
  const earth = EARTH_BY_ID[earthId];
  const km = greatCircleKm(base.lat, base.lon, earth.lat, earth.lon);
  const stew = STEWARDSHIP[earth.id];

  // Rank every site for this target & task with the same weights (lighting computed, rest demo).
  const ranked = useMemo(() => {
    return EARTH_SITES.map((s) => {
      const d = demoValues(s, target);
      const l = lightTwin(s.lat, target.body, target.lat).score;
      const res: ParamResult[] = [
        { id: "topography", value: d.topography, kind: "demo", note: "" },
        { id: "geology", value: d.geology, kind: "demo", note: "" },
        { id: "temperature", value: d.temperature, kind: "demo", note: "" },
        { id: "lighting", value: l, kind: "computed", note: "" },
        { id: "regolith", value: d.regolith, kind: "demo", note: "" },
      ];
      const score = analogFit(res, TASK_WEIGHTS[task]).score;
      return { s, score, km: greatCircleKm(base.lat, base.lon, s.lat, s.lon) };
    })
      .filter((x) => x.score >= 0.55)
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }, [target, task, base]);

  return (
    <Card>
      <CardHead k="Sustainability · rehearse closer" title="Field footprint">
        <Leaf size={16} className="text-strong" />
      </CardHead>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-3 py-2 text-[12px]">
        <span className="text-dim">Team based in</span>
        <select value={home} onChange={(e) => setHome(e.target.value)} className="cursor-pointer bg-transparent text-right text-platinum outline-none">
          {HOME_BASES.map((h) => (
            <option key={h.id} value={h.id} className="bg-panel">
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className="bg-panel p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-dim">
            <Plane size={12} /> To {earth.name.split(",")[0]}
          </div>
          <div className="mt-1 font-mono text-[17px] text-platinum tabular">{Math.round(km).toLocaleString()} km</div>
        </div>
        <div className="bg-panel p-3">
          <div className="text-[11px] text-dim">CO₂e · 4-person round trip</div>
          <div className="mt-1 font-mono text-[17px] text-platinum tabular">≈ {tripCo2Tonnes(km, 4).toFixed(1)} t</div>
        </div>
      </div>

      <div className="mt-5 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Closest credible analogs</div>
      <ul className="mt-2 border-t border-line">
        {ranked.map(({ s, score, km }) => (
          <li key={s.id}>
            <button onClick={() => onPick(s.id)} className="group flex w-full items-center gap-3 border-b border-line py-2.5 text-left">
              <img src={`/thumbs/${s.id}.webp`} alt="" className="h-9 w-12 rounded-md object-cover" loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-platinum">{s.name}</span>
                <span className="block font-mono text-[10.5px] text-dim">
                  {Math.round(km).toLocaleString()} km · ≈{tripCo2Tonnes(km, 4).toFixed(1)} t CO₂e
                </span>
              </span>
              <span className="font-mono text-[12px] text-chrome">{score.toFixed(2)}</span>
            </button>
          </li>
        ))}
        {ranked.length === 0 && <li className="py-3 text-[12px] text-dim">No catalogued site clears 0.55 for this task — a gap to screen.</li>}
      </ul>

      {stew && (
        <div className="mt-5 flex gap-3 rounded-xl border border-line bg-ink p-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-chrome" />
          <div>
            <div className="text-[12px] text-platinum">{stew.status}</div>
            <div className="text-[11.5px] leading-relaxed text-dim">{stew.note}</div>
          </div>
        </div>
      )}
      <p className="mt-3 text-[10.5px] leading-relaxed text-dim">
        Great-circle distance ×1.08 routing, 0.15 kg CO₂e per passenger-km (indicative long-haul economy factor). Ranking uses computed lighting + demo
        values.
      </p>
    </Card>
  );
}

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
    <Card>
      <CardHead k="What Earth cannot reproduce" title="Reality gaps stay next to every score" />
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {GAPS[world].map((g) => (
          <div key={g.k} className="bg-panel p-4">
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">{g.k}</div>
            <div className="mt-2 text-[22px] font-light tracking-tight text-platinum">{g.v}</div>
            <div className="mt-1 text-[12px] text-chrome">{g.e}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Insight({
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
}) {
  const lines: string[] = [];
  if (topo !== null && statsE && statsT) {
    const r = statsE.relief / Math.max(1, statsT.relief);
    lines.push(
      `Topography ${topo.toFixed(2)}: slope distributions ${topo >= 0.6 ? "overlap well" : "differ"} on the shared grid; ${earthName}'s relief is ${r >= 1 ? r.toFixed(1) + "×" : (1 / r).toFixed(1) + "× lower than"} ${targetName}'s.`,
    );
  }
  lines.push(`Lighting ${light.score.toFixed(2)}: plan field work in ${light.best.join(", ") || "—"}, when ${earthName}'s Sun-angle pattern is closest.`);
  if (illE && illT)
    lines.push(
      `Under the same low Sun, ${(illE.persistentShadow * 100).toFixed(1)}% of ${earthName} never sees light versus ${(illT.persistentShadow * 100).toFixed(1)}% of ${targetName} — ${illE.persistentShadow < illT.persistentShadow * 0.5 ? "shadow-trap rehearsal will be weaker than the real thing" : "a usable shadow rehearsal"}.`,
    );
  lines.push(`Overall ${fit.toFixed(2)} is provisional: geology, temperature and regolith are demo values until the model is trained.`);
  return (
    <Card>
      <CardHead k="Auto-summary" title="What the numbers say" />
      <ol className="space-y-3">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-chrome">
            <span className="font-mono text-[11px] text-dim">{String(i + 1).padStart(2, "0")}</span>
            {l}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] text-dim">Written by a template from the computed values above — no language model, no invented facts.</p>
    </Card>
  );
}

function ModelRoadmap() {
  const steps = [
    { k: "Now", t: "Prototype", d: "Topography & lighting computed live; other parameters are demo values.", on: true },
    { k: "Hackathon", t: "Physical baseline", d: "Full-precision LOLA, MOLA, HiRISE & NASADEM; transparent feature ranker." },
    { k: "Next", t: "Trained model", d: "Terrain encoder + mission-conditioned ranker, with uncertainty and abstention." },
  ];
  return (
    <Card>
      <CardHead k="Model status" title="From demo to trained" />
      <ol className="relative space-y-5 border-l border-line pl-5">
        {steps.map((s) => (
          <li key={s.k} className="relative">
            <span className={clsx("absolute top-1.5 -left-[25px] size-2.5 rounded-full border", s.on ? "border-flare bg-flare" : "border-line-2 bg-void")} />
            <div className="font-mono text-[10px] tracking-widest text-dim uppercase">{s.k}</div>
            <div className="text-[14px] text-platinum">{s.t}</div>
            <div className="text-[12.5px] text-chrome">{s.d}</div>
          </li>
        ))}
      </ol>
      <Link to="/methods" className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-chrome link-wipe">
        Read the method <ArrowRight size={13} />
      </Link>
    </Card>
  );
}
