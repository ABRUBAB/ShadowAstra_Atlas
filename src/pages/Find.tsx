import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, animate, motion } from "motion/react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Copy, FileText, LocateFixed, MapPin, Plane, RotateCcw, Search, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { Astronaut, climateReaction, reactionFor, type Reaction } from "../components/ui/Astronaut";
import { Chip, ConfidenceChip, Counter, EASE, GlyphTile, KindBadge, Meter, Ring, Seg, Tip, toast } from "../components/ui/kit";
import { Pick, StepRail, StepTitle, TargetImage, TASK_ICON, TASK_LINE, type StepId } from "../components/find/pieces";
import type { GlobePin } from "../components/three/ScoreGlobe";
import type { GlobeMarker } from "../components/three/Planet";
import { TARGETS, TARGET_BY_ID, TASKS, type TaskId, type World } from "../data/sites";
import { TASK_WEIGHTS } from "../lib/scoring";
import { formatCoord } from "../lib/geo";
import { sunRegime } from "../lib/sun";
import { greatCircleKm, tripCo2Tonnes } from "../lib/scoring";
import { MONTHS, RAMP_CSS, displayRange, paintScores, scoreCell, searchGrid, useGrid, type Candidate, type Grid, type SearchHit } from "../lib/grid";
import {
  ALTITUDES,
  DHAKA,
  DISTANCES,
  FACTORS,
  FIELD_TESTS,
  LEVELS,
  MONTHS_LONG,
  PRESETS,
  RULE_TEXT,
  TOWN_LIMITS,
  defaultMission,
  factorLevel,
  homeKm,
  knownKm,
  runSearch,
  screen,
  setFactorLevel,
  type Mission,
  type SearchResult,
} from "../lib/mission";
import { useEarthThumb } from "../lib/thumbs";
import { placeId, useSaved } from "../lib/saved";
import { logBadge } from "../lib/fieldlog";

const ScoreGlobe = lazy(() => import("../components/three/ScoreGlobe"));
const GlobeView = lazy(() => import("../components/three/GlobeView"));

/* =============================================================== URL state */

function readMission(p: URLSearchParams): { m: Mission; step: StepId; at: [number, number] | null } {
  const target = TARGET_BY_ID[p.get("target") ?? ""] ? p.get("target")! : "jezero";
  const task = (TASKS.some((t) => t.id === p.get("task")) ? p.get("task") : TARGET_BY_ID[target].tasks[0]) as TaskId;
  const m = defaultMission(target, task);
  const num = (k: string) => (p.get(k) !== null && p.get(k) !== "" && Number.isFinite(+p.get(k)!) ? +p.get(k)! : null);
  m.maxKm = num("km");
  m.townKm = num("town");
  m.maxElev = num("alt");
  m.month = num("month");
  m.skipAntarctica = p.get("ant") === "0";
  m.onlyNew = p.get("new") !== "0";
  const hl = num("hlat");
  const ho = num("hlon");
  if (hl !== null && ho !== null) m.home = { name: p.get("home") ?? "Home", lat: hl, lon: ho };
  const at = p.get("at")?.split(",").map(Number);
  const step = (["start", "destination", "job", "needs", "results"].includes(p.get("step") ?? "") ? p.get("step") : p.get("target") ? "results" : "start") as StepId;
  return { m, step, at: at && at.length === 2 && at.every(Number.isFinite) ? [at[0], at[1]] : null };
}

function writeMission(m: Mission, step: StepId, at: [number, number] | null) {
  const p: Record<string, string> = { step, target: m.target, task: m.task };
  if (m.maxKm !== null) p.km = String(m.maxKm);
  if (m.townKm !== null) p.town = String(m.townKm);
  if (m.maxElev !== null) p.alt = String(m.maxElev);
  if (m.month !== null) p.month = String(m.month);
  if (m.skipAntarctica) p.ant = "0";
  if (!m.onlyNew) p.new = "0";
  if (m.home.name !== DHAKA.name) Object.assign(p, { home: m.home.name, hlat: m.home.lat.toFixed(2), hlon: m.home.lon.toFixed(2) });
  if (at) p.at = `${at[0].toFixed(2)},${at[1].toFixed(2)}`;
  return p;
}

/* ===================================================================== page */

export default function Find() {
  const { grid, progress, error } = useGrid();
  const [params, setParams] = useSearchParams();
  const init = useMemo(() => readMission(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState<StepId>(init.step);
  const [m, setM] = useState<Mission>(init.m);
  const [sel, setSel] = useState<number | null>(null);
  const [scan, setScan] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const [world, setWorld] = useState<World>(TARGET_BY_ID[init.m.target].body);
  const [picked, setPicked] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const togglePick = (k: number) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 4 ? p : [...p, k]));
  const target = TARGET_BY_ID[m.target];
  const update = (patch: Partial<Mission>) => setM((x) => ({ ...x, ...patch }));

  // URL stays shareable
  useEffect(() => {
    const at = grid && sel !== null ? ([grid.lat(sel), grid.lon(sel)] as [number, number]) : null;
    setParams(writeMission(m, step, at), { replace: true, preventScrollReset: true });
  }, [m, step, sel, grid, setParams]);

  const dist = useMemo(() => (grid ? homeKm(grid, m.home) : null), [grid, m.home]);
  const screening = useMemo(() => (grid && dist ? screen(grid, m, dist) : null), [grid, dist, m]);
  const result = useMemo<SearchResult | null>(() => (grid && dist && step === "results" ? runSearch(grid, m, dist) : null), [grid, dist, m, step]);

  // open a shared place once results are ready
  const [pendingAt, setPendingAt] = useState(init.at);
  useEffect(() => {
    if (!grid || !pendingAt || !result) return;
    const k = grid.cellAt(pendingAt[0], pendingAt[1], 3);
    if (k >= 0) openPlace(k);
    setPendingAt(null);
  }, [grid, result, pendingAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPicked([]);
    setComparing(false);
  }, [result]);

  /* ---------- heat canvas: the possible area while choosing needs, the scores in results */
  const heat = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas")), []);
  const [heatVersion, setHeatVersion] = useState(0);
  const [range, setRange] = useState<{ lo: number; hi: number } | null>(null);
  useEffect(() => {
    if (!grid || !heat) return;
    if (step === "results" && result) {
      const shown = new Float32Array(grid.n);
      for (let k = 0; k < grid.n; k++) shown[k] = result.screening.pass[k] ? result.scores[k] : -1;
      const passScores = Array.from(result.scores).filter((_, k) => result.screening.pass[k]);
      const r = passScores.length > 50 ? displayRange(Float32Array.from(passScores)) : displayRange(result.scores);
      setRange(paintScores(grid, shown, heat, r));
    } else if (step === "needs" && screening) {
      const { rows, cols } = grid.meta;
      heat.width = cols;
      heat.height = rows;
      const ctx = heat.getContext("2d")!;
      const img = ctx.createImageData(cols, rows);
      for (let k = 0; k < grid.n; k++) {
        const p = (grid.row[k] * cols + grid.col[k]) * 4;
        const ok = screening.pass[k];
        img.data.set(ok ? [143, 180, 234, 150] : [0, 0, 0, 0], p);
      }
      ctx.putImageData(img, 0, 0);
    }
    setHeatVersion((v) => v + 1);
  }, [grid, heat, step, result, screening]);

  // while choosing needs, keep the team's home in view so the range ring is visible
  useEffect(() => {
    if (step === "needs") setFocus({ lat: m.home.lat, lon: m.home.lon, key: Date.now() });
  }, [step, m.home.lat, m.home.lon, m.maxKm]);

  // each step starts at the top of the console
  const consoleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: 0 });
  }, [step, sel]);

  /* ---------- the search sweep */
  const runScan = (keepPlace = false) => {
    setScanning(true);
    setScan(0);
    if (!keepPlace) {
      setSel(null);
      setFocus({ lat: m.home.lat, lon: m.home.lon, key: Date.now() });
    }
    const c = animate(0, 1, { duration: 2.6, ease: [0.45, 0, 0.2, 1], onUpdate: setScan, onComplete: () => setTimeout(() => setScanning(false), 900) });
    return () => c.stop();
  };
  const goResults = () => {
    setStep("results");
    runScan();
  };
  // results opened from a link: still show the sweep once
  const firstScan = useRef(init.step === "results");
  useEffect(() => {
    if (firstScan.current && grid) {
      firstScan.current = false;
      runScan(!!init.at); // a shared link opens its place; the sweep plays behind it
    }
  }, [grid]); // eslint-disable-line react-hooks/exhaustive-deps

  function openPlace(k: number) {
    if (!grid) return;
    setSel(k);
    setFocus({ lat: grid.lat(k), lon: grid.lon(k), key: Date.now() });
  }

  /* ---------- stage content */
  const targetsOfWorld = TARGETS.filter((t) => t.body === world);
  const markers: GlobeMarker[] = targetsOfWorld.map((t) => ({ id: t.id, lat: t.lat, lon: t.lon, color: t.id === m.target ? "#f2c879" : "#edeae4", label: t.name }));
  const earthStage = step === "needs" || step === "results";
  const pins: GlobePin[] = useMemo(() => {
    const out: GlobePin[] = [{ id: "home", lat: m.home.lat, lon: m.home.lon, color: "#f2c879", kind: "home" }];
    if (step === "results" && result && scan > 0.98) result.places.forEach((c, i) => out.push({ id: `c${c.k}`, lat: c.lat, lon: c.lon, color: "#f2c879", kind: "candidate", rank: i + 1 }));
    if (grid && sel !== null && !result?.places.some((c) => c.k === sel)) out.push({ id: "pick", lat: grid.lat(sel), lon: grid.lon(sel), color: "#ffffff", kind: "pick" });
    return out;
  }, [m.home, step, result, scan, grid, sel]);

  const reaction: Reaction = useMemo(() => {
    if (!grid) return { mood: "focused", action: "scan", say: "Loading every land area on Earth…" };
    if (step === "destination") return { mood: "happy", action: "binoculars", say: `${target.name}. ${target.why.split(".")[0]}.` };
    if (step === "job") return { mood: "thinking", action: "idle", say: "What should we practise there? Each job needs different ground." };
    if (step === "needs") return { mood: "focused", action: "point", say: screening ? `${screening.passCount.toLocaleString()} places still possible. Blue shows where.` : "Tell me your limits." };
    if (scanning) return { mood: "focused", action: "scan", say: "Searching all 80,206 places…" };
    if (sel !== null) {
      const c = climateReaction(grid.value("f_lst_night_min", sel), grid.value("f_lst_day_max", sel));
      return c ?? reactionFor(result?.scores[sel] ?? null, false);
    }
    const top = result?.places[0];
    if (!top) return { mood: "sad", action: "slump", say: "No place meets every need. Try relaxing one, below." };
    return top.score >= 0.7 ? { mood: "happy", action: "celebrate", say: `Found them! Best match: ${grid.name(top.k).title} (${top.score.toFixed(2)}).` } : { mood: "thinking", action: "sample", say: `Best match is ${top.score.toFixed(2)}. See what's holding back better sites.` };
  }, [grid, step, target, screening, scanning, sel, result]);

  if (step === "start")
    return (
      <div className="bg-void">
        <Nav />
        <StartScreen
          onPreset={(p) => {
            const next = { ...m, target: p.target, task: p.task, weights: { ...TASK_WEIGHTS[p.task] } };
            setM(next);
            setWorld(TARGET_BY_ID[p.target].body);
            setStep("needs");
          }}
          onBuild={() => setStep("destination")}
        />
        <Footer />
      </div>
    );

  return (
    <div className="bg-void">
      <Nav />
      <section className="relative xl:h-[calc(100dvh-64px)] xl:min-h-[700px]">
        {/* stage: a window into space */}
        <div
          data-theme="dark"
          className={clsx(
            "relative h-[48vh] min-h-[360px] overflow-hidden bg-void transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] xl:absolute xl:inset-y-0 xl:right-0 xl:h-auto",
            sel !== null && step === "results" ? "xl:left-[612px]" : "xl:left-[472px]",
          )}
        >
          <Suspense fallback={<StageLoading label="Starting the globe" progress={1} />}>
            {earthStage ? (
              grid && heat ? (
                <ScoreGlobe
                  heat={heat}
                  heatVersion={heatVersion}
                  heatOn
                  reveal={step === "results" ? scan : 1.02}
                  pins={pins}
                  activeId={sel !== null ? (result?.places.some((c) => c.k === sel) ? `c${sel}` : "pick") : null}
                  focus={focus}
                  home={{ lat: m.home.lat, lon: m.home.lon, rangeKm: m.maxKm }}
                  arc={grid && sel !== null ? { from: m.home, to: { lat: grid.lat(sel), lon: grid.lon(sel) }, key: sel } : null}
                  onPick={(la, lo) => {
                    if (step !== "results") return;
                    const k = grid.cellAt(la, lo, 3);
                    if (k >= 0) openPlace(k);
                  }}
                  onPin={(id) => id.startsWith("c") && openPlace(+id.slice(1))}
                />
              ) : (
                <StageLoading label={error ?? "Loading the planet"} progress={progress} />
              )
            ) : (
              <GlobeView key={world} body={world} markers={markers} activeId={m.target} onSelect={(id) => update({ target: id })} focus={{ lat: target.body === world ? target.lat : 0, lon: target.body === world ? target.lon : 0 }} />
            )}
          </Suspense>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-end justify-end gap-3 p-4 xl:flex">
            <div className="pointer-events-auto">
              <Astronaut size={82} mood={reaction.mood} action={reaction.action} say={reaction.say} sayAlign="left" />
            </div>
          </div>
          {earthStage && <StageLegend step={step} range={range} m={m} />}
          <AnimatePresence>{scanning && step === "results" && result && <ScanCounters total={grid?.n ?? 80206} pass={result.screening.passCount} found={result.places.length} />}</AnimatePresence>
        </div>

        {/* the mission console */}
        <aside
          className={clsx(
            "relative z-20 flex flex-col border-line bg-panel xl:absolute xl:top-3 xl:bottom-3 xl:left-3 xl:rounded-3xl xl:border xl:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]",
            sel !== null && step === "results" ? "xl:w-[600px]" : "xl:w-[460px]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <StepRail step={step} onStep={(s) => (s === "results" ? goResults() : setStep(s))} done={{ results: !!result }} />
            <button onClick={() => setStep("start")} title="Start over" aria-label="Start over" className="grid size-8 shrink-0 place-items-center rounded-full border border-line-2 text-chrome hover:text-platinum">
              <RotateCcw size={13} />
            </button>
          </div>
          <div ref={consoleRef} className="scrollbar-thin flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step + (sel ?? "")} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.35, ease: EASE }} className="p-5">
                {step === "destination" && (
                  <DestinationStep
                    world={world}
                    setWorld={(w) => {
                      setWorld(w);
                      if (target.body !== w) update({ target: TARGETS.find((t) => t.body === w)!.id });
                    }}
                    value={m.target}
                    onPick={(id) => update({ target: id })}
                    grid={grid}
                    onNext={() => setStep("job")}
                  />
                )}
                {step === "job" && <JobStep m={m} onPick={(task) => update({ task, weights: { ...TASK_WEIGHTS[task] } })} onNext={() => setStep("needs")} onBack={() => setStep("destination")} />}
                {step === "needs" && <NeedsStep m={m} update={update} grid={grid} screening={screening} onSearch={goResults} onBack={() => setStep("job")} />}
                {step === "results" && grid && result && sel === null && (
                  <ResultsPanel
                    grid={grid}
                    m={m}
                    result={result}
                    scanning={scanning}
                    onOpen={openPlace}
                    onRelax={(r) => {
                      if (r === "distance") update({ maxKm: null });
                      if (r === "town") update({ townKm: null });
                      if (r === "altitude") update({ maxElev: null });
                      if (r === "antarctica") update({ skipAntarctica: false });
                      if (r === "known") update({ onlyNew: false });
                      toast(RULE_TEXT[r].relax);
                    }}
                    onEdit={() => setStep("needs")}
                    picked={picked}
                    onPick={togglePick}
                    onCompare={() => setComparing(true)}
                    onClear={() => setPicked([])}
                  />
                )}
                {step === "results" && grid && result && sel !== null && <SiteReport grid={grid} k={sel} m={m} result={result} onBack={() => setSel(null)} />}
                {step === "results" && !grid && <PanelLoading progress={progress} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </section>
      <AnimatePresence>
        {comparing && grid && result && picked.length >= 2 && (
          <CompareSheet
            grid={grid}
            m={m}
            ks={picked}
            onClose={() => setComparing(false)}
            onOpen={(k) => {
              setComparing(false);
              openPlace(k);
            }}
          />
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
}

/* ================================================================ start */

function StartScreen({ onPreset, onBuild }: { onPreset: (p: (typeof PRESETS)[number]) => void; onBuild: () => void }) {
  return (
    <section data-theme="dark" className="relative overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(143,180,234,0.10),transparent_70%),radial-gradient(40%_40%_at_100%_100%,rgba(224,138,95,0.10),transparent_70%)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-[340px] rounded-full opacity-70"
        style={{ backgroundImage: "url(/textures/moon_lroc_1k.webp)", backgroundSize: "200% 100%", boxShadow: "inset -90px -20px 110px rgba(7,8,10,0.95)" }}
        animate={{ backgroundPositionX: ["0%", "-200%"] }}
        transition={{ duration: 160, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-10 size-[300px] rounded-full opacity-70 max-md:hidden"
        style={{ backgroundImage: "url(/textures/mars_viking_1k.webp)", backgroundSize: "200% 100%", boxShadow: "inset 80px -20px 100px rgba(7,8,10,0.95)" }}
        animate={{ backgroundPositionX: ["0%", "200%"] }}
        transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative mx-auto max-w-[1180px] px-4 pt-20 pb-24 sm:px-6 md:pt-28">
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
            <Astronaut size={96} mood="happy" action="wave" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }} className="mt-6 text-[clamp(38px,6vw,84px)] leading-[0.98] font-medium tracking-[-0.045em] text-platinum">
            Where should we test?
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} className="mt-5 max-w-[620px] text-[17px] leading-relaxed text-chrome">
            Tell us where your mission is going and what you need. We search all 80,206 land areas on Earth with NASA data and show you the best new places to practise.
          </motion.p>
          <motion.ol initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.35 }} className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-chrome">
            {["Pick a destination", "Pick the job", "Set your needs", "We search the Earth"].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full border border-line-2 font-mono text-[10px] text-platinum">{i + 1}</span>
                {s}
                {i < 3 && <ArrowRight size={13} className="text-dim" />}
              </li>
            ))}
          </motion.ol>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
            onClick={onBuild}
            className="btn-primary group mt-9 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-medium"
          >
            <Wand2 size={17} /> Build my mission <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </motion.button>
        </div>

        <div className="mt-16 flex items-center gap-4">
          <span className="font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">Or start from a real mission</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p, i) => {
            const t = TARGET_BY_ID[p.target];
            const Icon = TASK_ICON[p.task];
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.5 + i * 0.06 }}
                onClick={() => onPreset(p)}
                className="surface lift group relative flex min-h-[168px] overflow-hidden rounded-2xl text-left"
              >
                <TargetImage t={t} className="absolute inset-0 opacity-55 transition-[opacity,transform] duration-700 group-hover:scale-[1.05] group-hover:opacity-75" span={30} />
                <div className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/10" />
                <div className="relative flex w-full flex-col justify-end p-5">
                  <div className="flex items-center gap-2 text-[11px] text-chrome">
                    <WorldDot world={t.body} /> {t.body === "moon" ? "Moon" : "Mars"} · {t.name}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[18px] font-medium tracking-tight text-platinum">
                    <Icon size={17} className="text-flare" /> {p.title}
                  </div>
                  <div className="mt-1 text-[13px] text-chrome">{p.line}</div>
                </div>
                <ArrowRight size={16} className="absolute top-4 right-4 text-chrome transition-transform group-hover:translate-x-0.5 group-hover:text-flare" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ================================================================ steps */

const KIND_ORDER = (kind: string) => (/base/i.test(kind) ? 0 : /rover|landing|human/i.test(kind) ? 1 : /cave|pit|tube/i.test(kind) ? 2 : 3);

function DestinationStep({ world, setWorld, value, onPick, grid, onNext }: { world: World; setWorld: (w: World) => void; value: string; onPick: (id: string) => void; grid: Grid | null; onNext: () => void }) {
  const t = TARGET_BY_ID[value];
  const list = TARGETS.filter((x) => x.body === world).sort((a, b) => KIND_ORDER(a.kind) - KIND_ORDER(b.kind));
  const terrain = grid?.targets[value]?.terrain;
  const sun = useMemo(() => sunRegime(t.body, t.lat), [t.body, t.lat]);
  return (
    <div>
      <StepTitle kicker="Step 1 of 3" title="Where is the mission going?" text="Pick a place on the Moon or Mars. Click a pin on the globe or choose from the list." />
      <Seg
        className="mt-5"
        value={world}
        onChange={setWorld}
        options={[
          { id: "moon", label: <><WorldDot world="moon" /> The Moon</> },
          { id: "mars", label: <><WorldDot world="mars" /> Mars</> },
        ]}
      />
      <div className="surface mt-5 overflow-hidden rounded-2xl">
        <TargetImage t={t} className="h-40 w-full" span={18} />
        <div className="p-4">
          <div className="flex items-center gap-2 text-[11px] tracking-wide text-flare uppercase">
            <WorldDot world={t.body} /> {t.kind}
          </div>
          <div className="mt-1 text-[19px] font-medium tracking-tight">{t.name}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-chrome">{t.why}</p>
          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
            {[
              ["Average slope", terrain ? `${terrain.mean_slope.toFixed(1)}°` : "…"],
              ["Height range", terrain ? `${(terrain.relief / 1000).toFixed(1)} km` : "…"],
              ["Highest Sun", `${Math.round(sun.maxElev)}°`],
            ].map(([a, b]) => (
              <div key={a} className="bg-panel px-2 py-2.5">
                <dt className="text-[10px] text-dim">{a}</dt>
                <dd className="font-mono text-[14px] text-platinum">{b}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 text-[10.5px] text-dim">Measured across 50 km from {t.body === "moon" ? "LRO LOLA" : "MGS MOLA"} heights.</div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {list.map((x) => (
          <li key={x.id}>
            <button
              onClick={() => onPick(x.id)}
              aria-pressed={x.id === value}
              className={clsx("flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors", x.id === value ? "border-flare/50 bg-flare/[0.07]" : "border-transparent hover:border-line-2 hover:bg-platinum/[0.03]")}
            >
              <TargetImage t={x} className="size-11 shrink-0 rounded-lg" span={14} />
              <span className="min-w-0 flex-1">
                <span className={clsx("block truncate text-[13px]", x.id === value ? "text-platinum" : "text-chrome")}>{x.name}</span>
                <span className="block truncate text-[11px] text-dim">{x.kind}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <NextBar onNext={onNext} label="Next: the job" />
    </div>
  );
}

function JobStep({ m, onPick, onNext, onBack }: { m: Mission; onPick: (t: TaskId) => void; onNext: () => void; onBack: () => void }) {
  const t = TARGET_BY_ID[m.target];
  const w = TASK_WEIGHTS[m.task];
  return (
    <div>
      <StepTitle kicker="Step 2 of 3" title="What do you want to practise?" text={`Each job needs different ground. Jobs marked ★ suit ${t.name}.`} />
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TASKS.map((x) => {
          const Icon = TASK_ICON[x.id];
          const on = x.id === m.task;
          const fit = t.tasks.includes(x.id);
          return (
            <button key={x.id} onClick={() => onPick(x.id)} aria-pressed={on} className={clsx("surface flex items-start gap-3 rounded-xl p-3 text-left", on && "!border-flare/60")}>
              <GlyphTile className="size-10" tone={on ? "var(--color-flare)" : "var(--color-chrome)"}>
                <Icon size={16} strokeWidth={1.6} />
              </GlyphTile>
              <span className="min-w-0">
                <span className={clsx("block text-[13.5px] leading-tight", on ? "text-platinum" : "text-chrome")}>
                  {x.label} {fit && <span className="text-flare">★</span>}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-dim">{TASK_LINE[x.id]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="surface mt-5 rounded-2xl p-4">
        <div className="text-[13px] text-platinum">What matters most for “{TASKS.find((x) => x.id === m.task)!.label.toLowerCase()}”</div>
        <div className="mt-3 space-y-2.5">
          {FACTORS.map((f) => {
            const v = f.dims.reduce((a, d) => a + w[d as keyof typeof w], 0);
            return <Meter key={f.id} thin value={Math.min(1, v / 0.5)} label={<span className="text-[12.5px]">{f.label}</span>} right={<span className="text-[11px] text-dim">{LEVELS[factorLevel(w, f.id)].label}</span>} />;
          })}
        </div>
        <div className="mt-4 text-[12px] text-dim">Tests a field team could run</div>
        <ul className="mt-1.5 space-y-1">
          {FIELD_TESTS[m.task].map((x) => (
            <li key={x} className="flex gap-2 text-[12.5px] leading-snug text-chrome">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-flare" />
              {x}
            </li>
          ))}
        </ul>
      </div>
      <NextBar onNext={onNext} onBack={onBack} label="Next: your needs" />
    </div>
  );
}

function CityPicker({ grid, value, onChange }: { grid: Grid | null; value: string; onChange: (h: { name: string; lat: number; lon: number }) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const hits = useMemo<SearchHit[]>(() => (grid ? searchGrid(grid, q, 6).filter((h) => h.lat !== undefined) : []), [grid, q]);
  return (
    <span className="relative inline-flex align-baseline">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg border-b-2 border-flare/60 bg-flare/[0.08] px-2 py-0.5 font-medium text-flare hover:bg-flare/[0.14]">
        {value}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute top-full left-0 z-30 mt-2 w-[280px] rounded-2xl p-2">
            <div className="flex items-center gap-2 rounded-xl border border-line-2 bg-ink px-3 py-1.5">
              <Search size={13} className="text-dim" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={grid ? "Type a city" : "Loading places…"} className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-platinum outline-none placeholder:text-dim" aria-label="Home city" />
              <button
                title="Use my location"
                aria-label="Use my location"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition(
                    (p) => {
                      onChange({ name: "My location", lat: p.coords.latitude, lon: p.coords.longitude });
                      setOpen(false);
                    },
                    () => toast("Location permission was not given.", "info"),
                  )
                }
                className="text-chrome hover:text-flare"
              >
                <LocateFixed size={14} />
              </button>
            </div>
            <ul className="mt-1">
              {hits.map((h, i) => (
                <li key={`${h.label}${i}`}>
                  <button
                    onClick={() => {
                      onChange({ name: h.label, lat: h.lat!, lon: h.lon! });
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] text-platinum hover:bg-platinum/[0.07]"
                  >
                    {h.label} <span className="text-[11px] text-dim">{h.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function NeedsStep({ m, update, grid, screening, onSearch, onBack }: { m: Mission; update: (p: Partial<Mission>) => void; grid: Grid | null; screening: ReturnType<typeof screen> | null; onSearch: () => void; onBack: () => void }) {
  const removed = screening?.removed;
  const lines: [string, number][] = removed
    ? ([
        [RULE_TEXT.distance.label, m.maxKm !== null ? removed.distance : 0],
        [RULE_TEXT.town.label, m.townKm !== null ? removed.town : 0],
        [RULE_TEXT.altitude.label, m.maxElev !== null ? removed.altitude : 0],
        [RULE_TEXT.antarctica.label, m.skipAntarctica ? removed.antarctica : 0],
        [RULE_TEXT.known.label, m.onlyNew ? removed.known : 0],
      ].filter(([, n]) => (n as number) > 0) as [string, number][])
    : [];
  return (
    <div>
      <StepTitle kicker="Step 3 of 3" title="What does your team need?" text="Real field teams choose sites by distance, access, season and safety. Change the orange words." />
      <div className="surface mt-5 rounded-2xl p-4 text-[15.5px] leading-[2.1] text-platinum">
        My team is based in <CityPicker grid={grid} value={m.home.name} onChange={(home) => update({ home })} /> and can travel{" "}
        <Pick label="Maximum distance" value={m.maxKm} options={DISTANCES.map((d) => ({ v: d.km, label: d.km === null ? d.label : `up to ${d.label}` }))} onChange={(v) => update({ maxKm: v })} />. We plan to go in{" "}
        <Pick label="Month" value={m.month} options={[{ v: null, label: "any month" }, ...MONTHS_LONG.map((x, i) => ({ v: i, label: x }))]} onChange={(v) => update({ month: v })} />. The site must be within{" "}
        <Pick label="Distance to a town" value={m.townKm} options={TOWN_LIMITS.map((d) => ({ v: d.km, label: d.label }))} onChange={(v) => update({ townKm: v })} /> of a town and below{" "}
        <Pick label="Maximum height" value={m.maxElev} options={ALTITUDES.map((d) => ({ v: d.m, label: d.label }))} onChange={(v) => update({ maxElev: v })} />.
      </div>
      <div className="mt-3 space-y-2">
        <Toggle on={m.onlyNew} set={(v) => update({ onlyNew: v })} label="Only new places" hint="Hide places within 150 km of a site teams already use" />
        <Toggle on={m.skipAntarctica} set={(v) => update({ skipAntarctica: v })} label="Skip Antarctica" hint="Treaty permits can take a year" />
      </div>
      <div className="surface mt-4 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 text-[13px] text-platinum">
          How much each thing matters <Tip text="Preset from the job you picked. Change it if your test cares about something else." />
        </div>
        <div className="mt-3 space-y-3">
          {FACTORS.map((f) => (
            <div key={f.id}>
              <div className="flex items-center justify-between text-[12.5px] text-chrome">
                <span className="flex items-center gap-1.5">
                  {f.label} <Tip text={f.plain} />
                </span>
              </div>
              <Seg
                size="sm"
                className="mt-1.5"
                value={String(factorLevel(m.weights, f.id))}
                onChange={(v) => update({ weights: setFactorLevel(m.weights, f.id, +v) })}
                options={LEVELS.map((l) => ({ id: String(l.id), label: l.label }))}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-earth/30 bg-earth/[0.06] p-4">
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Places still possible</div>
        <div className="mt-1 font-mono text-[34px] leading-none font-light text-platinum">{screening ? <Counter value={screening.passCount} duration={0.6} /> : "…"}</div>
        <div className="mt-1 text-[12px] text-chrome">of {grid ? grid.n.toLocaleString() : "80,206"} land areas · shown in blue on the globe</div>
        {lines.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11.5px] text-dim">
            {lines.map(([l, n]) => (
              <li key={l}>
                −{n.toLocaleString()} {l}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] text-chrome hover:text-platinum">
          <ArrowLeft size={13} /> Back
        </button>
        <button onClick={onSearch} disabled={!grid || !screening?.passCount} className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium disabled:opacity-50">
          <Search size={15} /> Search the whole Earth
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => set(!on)} role="switch" aria-checked={on} className="surface flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left">
      <span>
        <span className="block text-[13px] text-platinum">{label}</span>
        <span className="block text-[11px] text-dim">{hint}</span>
      </span>
      <span className={clsx("relative h-5 w-9 shrink-0 rounded-full border transition-colors", on ? "border-flare/60 bg-flare/25" : "border-line-2 bg-ink")}>
        <motion.span className="absolute top-0.5 size-3.5 rounded-full bg-platinum" animate={{ left: on ? 18 : 3 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
      </span>
    </button>
  );
}

function NextBar({ onNext, onBack, label }: { onNext: () => void; onBack?: () => void; label: string }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t border-line bg-panel/95 px-5 py-3 backdrop-blur">
      {onBack ? (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] text-chrome hover:text-platinum">
          <ArrowLeft size={13} /> Back
        </button>
      ) : (
        <span />
      )}
      <button onClick={onNext} className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-medium">
        {label} <ArrowRight size={14} />
      </button>
    </div>
  );
}

/* ================================================================ stage bits */

function StageLoading({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="grid size-full place-items-center">
      <div className="flex flex-col items-center">
        <Astronaut size={86} mood="focused" action="scan" />
        <div className="mt-4 font-mono text-[11px] tracking-widest text-chrome uppercase">{label}</div>
        <div className="mt-3 h-px w-56 bg-line">
          <motion.div className="h-px bg-flare" animate={{ width: `${Math.max(3, progress * 100)}%` }} transition={{ ease: EASE, duration: 0.4 }} />
        </div>
      </div>
    </div>
  );
}

function PanelLoading({ progress }: { progress: number }) {
  return (
    <div className="space-y-3">
      <div className="text-[13px] text-chrome">Loading NASA data for every land area… {Math.round(progress * 100)}%</div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="shimmer h-24 rounded-xl" />
      ))}
    </div>
  );
}

function StageLegend({ step, range, m }: { step: StepId; range: { lo: number; hi: number } | null; m: Mission }) {
  return (
    <div className="pointer-events-none absolute top-4 right-4 z-10 hidden w-[250px] xl:block">
      <div className="glass rounded-xl p-3 text-[11px] text-chrome">
        {step === "needs" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-[#8fb4ea]" /> Places that meet your needs
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="size-2.5 rounded-full border-2 border-flare" /> {m.home.name}
              {m.maxKm !== null && <span className="text-dim">· dashed ring = {m.maxKm.toLocaleString()} km</span>}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span>Match score</span>
              <span className="font-mono text-dim">grey = ruled out</span>
            </div>
            <div className="mt-2 h-2 rounded-full" style={{ background: RAMP_CSS }} />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-dim">
              <span>{range ? range.lo.toFixed(2) : "…"}</span>
              <span>{range ? range.hi.toFixed(2) : "…"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ScanCounters({ total, pass, found }: { total: number; pass: number; found: number }) {
  const items = [
    { n: total, l: "places checked" },
    { n: pass, l: "meet your needs" },
    { n: found, l: "best new places" },
  ];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: EASE }} className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center xl:top-auto xl:bottom-10 xl:left-[480px]">
      <div className="glass flex items-center gap-6 rounded-2xl px-6 py-4">
        {items.map((it, i) => (
          <motion.div key={it.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.7, duration: 0.5, ease: EASE }} className="text-center">
            <div className="font-mono text-[28px] leading-none font-light text-platinum">
              <Counter value={it.n} duration={0.9} />
            </div>
            <div className="mt-1 text-[11px] text-chrome">{it.l}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ================================================================ results */

function needLines(grid: Grid, m: Mission, k: number) {
  const km = greatCircleKm(m.home.lat, m.home.lon, grid.lat(k), grid.lon(k));
  const town = grid.value("n_place_km", k);
  const elev = grid.value("f_elev", k);
  return [
    { ok: m.maxKm === null || km <= m.maxKm, text: `${Math.round(km).toLocaleString()} km from ${m.home.name}` },
    { ok: m.townKm === null || (town ?? 1e9) <= m.townKm, text: town === null ? "No town listed" : `${Math.round(town)} km to a town` },
    { ok: m.maxElev === null || (elev ?? 0) <= m.maxElev, text: elev === null ? "Height unknown" : `${Math.round(elev).toLocaleString()} m high` },
  ];
}

function PickThumb({ grid, k }: { grid: Grid; k: number }) {
  const thumb = useEarthThumb(grid.lat(k), grid.lon(k), 96);
  return <span className="block size-9 overflow-hidden rounded-full border-2 border-panel bg-ink">{thumb && <img src={thumb} alt="" className="size-full object-cover" />}</span>;
}

function ResultCard({ grid, c, rank, m, onOpen, picked, onPick, full }: { grid: Grid; c: Candidate; rank: number; m: Mission; onOpen: () => void; picked: boolean; onPick: () => void; full: boolean }) {
  const nm = grid.name(c.k);
  const thumb = useEarthThumb(c.lat, c.lon, 160);
  const t = grid.targets[m.target];
  const cs = scoreCell(grid, c.k, { target: t, task: m.task, weights: m.weights, modelMix: m.modelMix });
  const best = FACTORS.map((f) => ({ f, v: f.dims.reduce((a, d) => a + cs.dims[d as keyof typeof cs.dims], 0) / f.dims.length })).sort((a, b) => b.v - a.v)[0];
  return (
    <motion.li initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 * rank }} className="relative">
      <button
        onClick={onPick}
        disabled={full && !picked}
        aria-pressed={picked}
        title={picked ? "Remove from the comparison" : full ? "Up to 4 places" : "Add to the comparison"}
        className={clsx("absolute right-2.5 bottom-2.5 z-10 rounded-full border px-2 py-0.5 text-[10.5px] transition-colors disabled:opacity-30", picked ? "border-flare bg-flare text-void" : "border-line-2 bg-void/60 text-chrome hover:border-flare/60 hover:text-platinum")}
      >
        {picked ? "Comparing" : "+ Compare"}
      </button>
      <button onClick={onOpen} className={clsx("surface lift group flex w-full gap-3 overflow-hidden rounded-2xl p-2.5 text-left", picked && "!border-flare/60")}>
        <div className="relative size-[86px] shrink-0 overflow-hidden rounded-xl bg-ink">
          {thumb ? <motion.img src={thumb} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="size-full object-cover" /> : <div className="shimmer size-full" />}
          <span className="absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-void/80 font-mono text-[11px] text-platinum">{rank}</span>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-[14.5px] font-medium text-platinum">{nm.title}</span>
            <span className="shrink-0 font-mono text-[14px] text-flare">{c.score.toFixed(2)}</span>
          </div>
          <div className="truncate text-[11.5px] text-dim">{nm.subtitle || formatCoord(c.lat, c.lon)}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Chip className="!px-2 !py-0.5 !text-[10.5px]">Best at: {best.f.label.toLowerCase()}</Chip>
            {needLines(grid, m, c.k)
              .slice(0, 1)
              .map((l) => (
                <Chip key={l.text} tone={l.ok ? "strong" : "default"} className="!px-2 !py-0.5 !text-[10.5px]">
                  {l.text}
                </Chip>
              ))}
            {c.known && <Chip tone="moon" className="!px-2 !py-0.5 !text-[10.5px]">Known: {c.known.name.split(",")[0]}</Chip>}
            {grid.confidence(c.k, t.body).level === "low" && (
              <Chip tone="weak" className="!px-2 !py-0.5 !text-[10.5px]">
                Not enough evidence
              </Chip>
            )}
          </div>
        </div>
      </button>
    </motion.li>
  );
}

function ResultsPanel({
  grid,
  m,
  result,
  scanning,
  onOpen,
  onRelax,
  onEdit,
  picked,
  onPick,
  onCompare,
  onClear,
}: {
  grid: Grid;
  m: Mission;
  result: SearchResult;
  scanning: boolean;
  onOpen: (k: number) => void;
  onRelax: (r: keyof typeof RULE_TEXT) => void;
  onEdit: () => void;
  picked: number[];
  onPick: (k: number) => void;
  onCompare: () => void;
  onClear: () => void;
}) {
  const t = TARGET_BY_ID[m.target];
  const task = TASKS.find((x) => x.id === m.task)!;
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.24em] text-flare uppercase">Results</div>
      <h2 className="mt-2 text-[24px] leading-tight font-medium tracking-[-0.025em]">
        {result.places.length ? `${result.places.length} best ${m.onlyNew ? "new " : ""}places` : "No place fits every need"}
      </h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip tone={t.body === "moon" ? "moon" : "mars"}>
          <WorldDot world={t.body} /> {t.name}
        </Chip>
        <Chip>{task.label}</Chip>
        {m.maxKm !== null && <Chip>≤ {m.maxKm.toLocaleString()} km from {m.home.name}</Chip>}
        {m.month !== null && <Chip>{MONTHS_LONG[m.month]}</Chip>}
        <button onClick={onEdit} className="text-[11.5px] text-chrome underline-offset-2 hover:text-platinum hover:underline">
          Change needs
        </button>
      </div>

      {result.hints.length > 0 && !scanning && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.3 }} className="mt-4 rounded-2xl border border-flare/35 bg-flare/[0.06] p-3.5">
          <div className="flex items-center gap-2 text-[13px] text-platinum">
            <Sparkles size={14} className="text-flare" /> What's holding back better sites?
          </div>
          <ul className="mt-2 space-y-2">
            {result.hints.slice(0, 3).map((h) => (
              <li key={h.rule} className="flex items-center justify-between gap-3 text-[12.5px] leading-snug text-chrome">
                <span>
                  Your rule “{RULE_TEXT[h.rule].label.replace(/^(too|in|next)/, (x) => x)}” hides <span className="text-platinum">{grid.name(h.best.k).title}</span> ({h.best.score.toFixed(2)}, +{h.gain.toFixed(2)}).
                </span>
                <button onClick={() => onRelax(h.rule)} className="shrink-0 rounded-full border border-flare/50 px-2.5 py-1 text-[11px] text-flare hover:bg-flare/10">
                  {RULE_TEXT[h.rule].relax}
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <ol className="mt-4 space-y-2">
        {scanning
          ? Array.from({ length: 6 }, (_, i) => <li key={i} className="shimmer h-[106px] rounded-2xl" />)
          : result.places.map((c, i) => <ResultCard key={c.k} grid={grid} c={c} rank={i + 1} m={m} onOpen={() => onOpen(c.k)} picked={picked.includes(c.k)} onPick={() => onPick(c.k)} full={picked.length >= 4} />)}
      </ol>
      <AnimatePresence>
        {picked.length > 0 && !scanning && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.35, ease: EASE }} className="sticky bottom-3 z-10 mt-4 flex items-center gap-3 rounded-2xl border border-flare/40 bg-panel/95 p-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="flex -space-x-2">
              {picked.map((k) => (
                <PickThumb key={k} grid={grid} k={k} />
              ))}
            </div>
            <span className="flex-1 text-[12.5px] text-chrome">{picked.length < 2 ? "Pick one more to compare" : `${picked.length} places picked`}</span>
            <button onClick={onClear} className="text-[11.5px] text-dim hover:text-platinum">
              Clear
            </button>
            <button onClick={onCompare} disabled={picked.length < 2} className="btn-primary rounded-full px-4 py-2 text-[12.5px] font-medium disabled:opacity-40">
              Compare
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {!scanning && result.places.length > 0 && (
        <p className="mt-4 text-[11.5px] leading-relaxed text-dim">
          Scores compare each place with {t.name} for this job: ground shape, rocks and craters, cold and light, ice and loose ground, plus our learned model (60%). Click a place for the full report.
        </p>
      )}
    </div>
  );
}

/* ================================================================ compare sheet */

function CompareSheet({ grid, m, ks, onClose, onOpen }: { grid: Grid; m: Mission; ks: number[]; onClose: () => void; onOpen: (k: number) => void }) {
  const t = grid.targets[m.target];
  const T = TARGET_BY_ID[m.target];
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const cols = ks.map((k) => {
    const cs = scoreCell(grid, k, { target: t, task: m.task, weights: m.weights, modelMix: m.modelMix });
    const factor = (dims: readonly string[]) => dims.reduce((a, d) => a + cs.dims[d as keyof typeof cs.dims], 0) / dims.length;
    const km = greatCircleKm(m.home.lat, m.home.lon, grid.lat(k), grid.lon(k));
    return { k, cs, factors: FACTORS.map((f) => factor(f.dims)), km, conf: grid.confidence(k, T.body) };
  });
  const v = (n: string, k: number) => grid.value(n, k);
  type Row = { label: string; vals: (number | null)[]; fmt: (x: number) => string; better: "high" | "low" | null };
  const rows: Row[] = [
    { label: "Average slope", vals: ks.map((k) => v("f_slope", k)), fmt: (x) => `${x.toFixed(1)}°`, better: null },
    { label: "Height range", vals: ks.map((k) => v("f_relief", k)), fmt: (x) => `${(x / 1000).toFixed(2)} km`, better: null },
    { label: "Coldest night", vals: ks.map((k) => v("f_lst_night_min", k)), fmt: (x) => `${Math.round(x)} °C`, better: "low" },
    { label: "Rain a year", vals: ks.map((k) => v("f_precip", k)), fmt: (x) => `${Math.round(x).toLocaleString()} mm`, better: "low" },
    { label: `From ${m.home.name}`, vals: cols.map((c) => c.km), fmt: (x) => `${Math.round(x).toLocaleString()} km`, better: "low" },
    { label: "Trip CO₂, 4 people", vals: cols.map((c) => tripCo2Tonnes(c.km, 4)), fmt: (x) => `${x.toFixed(1)} t`, better: "low" },
  ];
  const bestOf = (vals: (number | null)[], better: "high" | "low") => {
    const ok = vals.filter((x): x is number => x !== null);
    if (!ok.length) return null;
    return better === "high" ? Math.max(...ok) : Math.min(...ok);
  };
  const top = Math.max(...cols.map((c) => c.cs.total));
  const gridCols = { gridTemplateColumns: `150px repeat(${ks.length}, minmax(150px, 1fr))` };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1200] grid place-items-center bg-void/70 p-3 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label="Compare places">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.45, ease: EASE }} onClick={(e) => e.stopPropagation()} className="scrollbar-thin max-h-full w-full max-w-[1100px] overflow-auto rounded-3xl border border-line bg-panel shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-panel/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-flare uppercase">Side by side</div>
            <div className="mt-0.5 text-[17px] text-platinum">
              {TASKS.find((x) => x.id === m.task)!.label} · {T.name}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-line-2 px-3 py-1.5 text-[12px] text-chrome hover:text-platinum">
            Close
          </button>
        </div>
        <div className="min-w-[640px] p-5">
          <div className="grid gap-3" style={gridCols}>
            <span />
            {cols.map((c, i) => (
              <CompareHead key={c.k} grid={grid} k={c.k} score={c.cs.total} best={c.cs.total === top} delay={i * 0.06} onOpen={() => onOpen(c.k)} conf={c.conf} />
            ))}
          </div>
          <div className="mt-5 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">The four factors</div>
          {FACTORS.map((f, fi) => {
            const vals = cols.map((c) => c.factors[fi]);
            const best = Math.max(...vals);
            return (
              <div key={f.id} className="grid items-center gap-3 border-b border-line py-3" style={gridCols}>
                <span className="text-[13px] text-chrome">{f.label}</span>
                {vals.map((x, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <motion.span className="block h-full rounded-full" style={{ background: x === best ? "var(--color-flare)" : "var(--color-chrome)" }} initial={{ width: 0 }} animate={{ width: `${x * 100}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.05 }} />
                    </span>
                    <span className={clsx("w-9 text-right font-mono text-[12px]", x === best ? "text-flare" : "text-chrome")}>{x.toFixed(2)}</span>
                  </span>
                ))}
              </div>
            );
          })}
          <div className="mt-5 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Measured, and the trip</div>
          {rows.map((r) => {
            const b = r.better ? bestOf(r.vals, r.better) : null;
            return (
              <div key={r.label} className="grid items-center gap-3 border-b border-line py-2.5 text-[13px]" style={gridCols}>
                <span className="text-chrome">{r.label}</span>
                {r.vals.map((x, i) => (
                  <span key={i} className={clsx("font-mono", x !== null && b !== null && x === b ? "text-flare" : "text-platinum")}>
                    {x === null ? "n/a" : r.fmt(x)}
                  </span>
                ))}
              </div>
            );
          })}
          <div className="grid items-center gap-3 py-2.5 text-[13px]" style={gridCols}>
            <span className="text-chrome">Main rock</span>
            {ks.map((k) => (
              <span key={k} className="text-platinum">
                {grid.rock(k)?.label ?? "unknown"}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] text-dim">Gold marks the best value in each row. Earth can't copy gravity, air or space radiation at any of these places.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompareHead({ grid, k, score, best, delay, onOpen, conf }: { grid: Grid; k: number; score: number; best: boolean; delay: number; onOpen: () => void; conf: ReturnType<Grid["confidence"]> }) {
  const thumb = useEarthThumb(grid.lat(k), grid.lon(k), 320);
  const nm = grid.name(k);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay }} className={clsx("overflow-hidden rounded-2xl border", best ? "border-flare/60" : "border-line")}>
      <div className="relative aspect-[4/3] bg-ink">
        {thumb ? <img src={thumb} alt={`Satellite view of ${nm.title}`} className="h-full w-full object-cover" /> : <div className="shimmer h-full" />}
        {best && <span className="absolute top-2 left-2 rounded-full bg-flare px-2 py-0.5 text-[10.5px] font-medium text-void">Best match</span>}
      </div>
      <div className="p-3">
        <div className="truncate text-[14px] text-platinum">{nm.title}</div>
        <div className="truncate text-[11px] text-dim">{nm.subtitle}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[22px] text-platinum">{score.toFixed(2)}</span>
          <button onClick={onOpen} className="rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-chrome hover:text-platinum">
            Report
          </button>
        </div>
        <div className="mt-2">
          <ConfidenceChip {...conf} />
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================ site report */

function plantWord(ndvi: number | null) {
  if (ndvi === null) return "no data";
  return ndvi < 0.15 ? "almost none" : ndvi < 0.3 ? "sparse" : ndvi < 0.5 ? "some" : "green";
}

function SiteReport({ grid, k, m, result, onBack }: { grid: Grid; k: number; m: Mission; result: SearchResult; onBack: () => void }) {
  const lat = grid.lat(k);
  const lon = grid.lon(k);
  const nm = grid.name(k);
  const t = result.target;
  const T = TARGET_BY_ID[m.target];
  const cs = scoreCell(grid, k, { target: t, task: m.task, weights: m.weights, modelMix: m.modelMix });
  const thumb = useEarthThumb(lat, lon, 520);
  const v = (n: string) => grid.value(n, k);
  const climate = climateReaction(v("f_lst_night_min"), v("f_lst_day_max"));
  const react = climate ?? reactionFor(cs.total, false);
  const km = greatCircleKm(m.home.lat, m.home.lon, lat, lon);
  const saved = useSaved();
  const id = placeId(lat, lon);
  const below = (() => {
    let n = 0;
    for (let i = 0; i < result.scores.length; i++) if (result.scores[i] < result.scores[k]) n++;
    return n / result.scores.length;
  })();
  const topPct = Math.max(0.1, (1 - below) * 100);
  const sunT = useMemo(() => sunRegime(T.body, T.lat), [T.body, T.lat]);
  const volc = grid.volcano(k);
  const crater = grid.crater(k);
  const bestMonth = MONTHS[t.light_month?.[grid.row[k]] ?? 0];
  const rock = grid.rock(k);
  const rm = grid.rockMatch(k, t);
  const rockWord = !rock ? "unknown" : rm >= 0.75 ? "close" : rm >= 0.45 ? "partly alike" : "different";
  const conf = grid.confidence(k, T.body);
  useEffect(() => logBadge("find"), []);

  const factor = (dims: readonly string[]) => dims.reduce((a, d) => a + cs.dims[d as keyof typeof cs.dims], 0) / dims.length;
  const rows: { f: (typeof FACTORS)[number]; earth: [string, string][]; target: [string, string][] }[] = [
    {
      f: FACTORS[0],
      earth: [
        ["Average slope", v("f_slope") === null ? "n/a" : `${v("f_slope")!.toFixed(1)}°`],
        ["Height range", v("f_relief") === null ? "n/a" : `${(v("f_relief")! / 1000).toFixed(2)} km`],
      ],
      target: [
        ["Average slope", `${t.terrain.mean_slope.toFixed(1)}°`],
        ["Height range", `${(t.terrain.relief / 1000).toFixed(2)} km`],
      ],
    },
    {
      f: FACTORS[1],
      earth: [
        ["Volcano", volc && volc.km < 300 ? `${volc.name}, ${Math.round(volc.km)} km` : "none near"],
        ["Impact crater", crater && crater.score > 0.2 ? crater.name : "none near"],
        ["Bare ground", v("f_barren") === null ? "n/a" : `${Math.round(v("f_barren")! * 100)}%`],
        ["Main rock", rock?.label ?? "unknown"],
      ],
      target: [
        ["Type", T.kind],
        ["Main rocks", t.rock?.label ?? "n/a"],
        ["Rock match", rockWord],
      ],
    },
    {
      f: FACTORS[2],
      earth: [
        ["Coldest night", v("f_lst_night_min") === null ? "n/a" : `${Math.round(v("f_lst_night_min")!)} °C`],
        ["Hottest ground", v("f_lst_day_max") === null ? "n/a" : `${Math.round(v("f_lst_day_max")!)} °C`],
        ["Best month for light", bestMonth],
      ],
      target: [
        ["Highest Sun", `${Math.round(sunT.maxElev)}°`],
        ["Typical Sun", `${Math.round(sunT.medianElev)}°`],
      ],
    },
    {
      f: FACTORS[3],
      earth: [
        ["Rain a year", v("f_precip") === null ? "n/a" : `${Math.round(v("f_precip")!)} mm`],
        ["Plants", plantWord(v("f_ndvi"))],
        ["Snow and ice", v("f_snowice") === null ? "n/a" : `${Math.round(v("f_snowice")! * 100)}%`],
      ],
      target: [["Water ice", T.tasks.includes("ice") || T.tasks.includes("polar") ? "likely nearby" : "not the focus"]],
    },
  ];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-chrome hover:text-platinum">
        <ArrowLeft size={13} /> All results
      </button>
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-line bg-ink">
        {thumb ? <motion.img src={thumb} alt={`Satellite view of ${nm.title}, 50 km across`} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: EASE }} className="h-56 w-full object-cover" /> : <div className="shimmer h-56" />}
        <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex flex-wrap gap-1.5">
            {knownKm(grid)[k] >= 150 ? <Chip tone="flare">New candidate</Chip> : <Chip tone="moon">Known site nearby</Chip>}
            <ConfidenceChip {...conf} />
            {lat < -60 && <Chip>Antarctic Treaty area</Chip>}
          </div>
          <h2 className="mt-2 text-[26px] leading-tight font-medium tracking-[-0.02em] text-white">{nm.title}</h2>
          <div className="text-[12px] text-white/75">
            {nm.subtitle ? `${nm.subtitle} · ` : ""}
            <span className="font-mono">{formatCoord(lat, lon)}</span>
          </div>
        </div>
        <span className="absolute top-3 right-3 rounded-full bg-void/70 px-2 py-0.5 font-mono text-[10px] text-white/80">50 km · Sentinel-2</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Ring value={cs.total} size={104} label="match" sub={`top ${topPct < 1 ? topPct.toFixed(1) : Math.round(topPct)}%`} />
        <div className="flex-1">
          <p className="text-[14px] leading-snug text-platinum">{react.say}</p>
          <p className="mt-1 text-[11.5px] text-dim">
            For “{TASKS.find((x) => x.id === m.task)!.label.toLowerCase()}” at {T.name}.
          </p>
        </div>
        <Astronaut size={78} mood={react.mood} action={react.action} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/lab?earth=@${lat.toFixed(2)},${lon.toFixed(2)}&target=${m.target}&task=${m.task}`} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium">
          Compare in 3D <ArrowRight size={13} />
        </Link>
        <Link to={`/report?target=${m.target}&task=${m.task}&at=${lat.toFixed(2)},${lon.toFixed(2)}&home=${encodeURIComponent(m.home.name)}&hlat=${m.home.lat.toFixed(2)}&hlon=${m.home.lon.toFixed(2)}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-2 text-[12.5px] text-chrome hover:text-platinum">
          <FileText size={13} /> Site report (PDF)
        </Link>
        <button
          onClick={() => {
            const added = saved.toggle({ id, name: nm.title, sub: nm.subtitle, lat, lon, score: cs.total, target: m.target, task: m.task });
            toast(added ? "Saved to your list" : "Removed from your list");
            if (added) logBadge("save");
          }}
          className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px]", saved.has(id) ? "border-flare/60 text-flare" : "border-line-2 text-chrome hover:text-platinum")}
        >
          {saved.has(id) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />} {saved.has(id) ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => toast("Link copied"))}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-2 text-[12.5px] text-chrome hover:text-platinum"
        >
          <Copy size={13} /> Link
        </button>
      </div>

      <h3 className="mt-7 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">The four challenge factors, side by side</h3>
      <div className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.f.id} className="surface rounded-2xl p-4">
            <Meter value={factor(r.f.dims)} label={r.f.label} kind="computed" />
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <div className="flex items-center gap-1.5 text-[10.5px] tracking-wide text-earth uppercase">
                  <WorldDot world="earth" /> This place
                </div>
                <dl className="mt-1 space-y-0.5">
                  {r.earth.map(([a, b]) => (
                    <div key={a} className="flex justify-between gap-2">
                      <dt className="text-dim">{a}</dt>
                      <dd className="text-right text-platinum">{b}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[10.5px] tracking-wide uppercase" style={{ color: `var(--color-${T.body})` }}>
                  <WorldDot world={T.body} /> {T.name}
                </div>
                <dl className="mt-1 space-y-0.5">
                  {r.target.map(([a, b]) => (
                    <div key={a} className="flex justify-between gap-2">
                      <dt className="text-dim">{a}</dt>
                      <dd className="text-right text-platinum">{b}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        ))}
        <div className="surface rounded-2xl p-4">
          <Meter value={cs.model} label="Learned model" kind="model" tone="var(--color-earth)" hint={`Looks more ${T.body === "moon" ? "Moon" : "Mars"}-like than ${Math.round(cs.model * 100)}% of land, judged by a model trained on 38 known test sites.`} />
        </div>
      </div>

      <h3 className="mt-7 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Planning the trip</h3>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-[12.5px]">
        {[
          [<Plane key="p" size={13} />, "From " + m.home.name, `${Math.round(km).toLocaleString()} km`],
          [<RotateCcw key="c" size={13} />, "CO₂, 4 people return", `≈ ${tripCo2Tonnes(km, 4).toFixed(1)} t`],
          [<MapPin key="m" size={13} />, "Nearest town", nm.place ? `${nm.place}, ${Math.round(nm.placeKm ?? 0)} km` : "none listed"],
          [<ShieldCheck key="s" size={13} />, "Permission", lat < -60 ? "Antarctic Treaty permit" : "Ask local authorities and land owners"],
        ].map(([icon, a, b], i) => (
          <div key={i} className="bg-panel p-3">
            <div className="flex items-center gap-1.5 text-[10.5px] text-dim">
              {icon} {a}
            </div>
            <div className="mt-0.5 text-platinum">{b}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-7 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Tests a team could run here</h3>
      <ul className="mt-2 space-y-1.5">
        {FIELD_TESTS[m.task].map((x) => (
          <li key={x} className="flex gap-2 text-[13px] leading-snug text-chrome">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-flare" />
            {x}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-weak/30 bg-weak/[0.06] p-4">
        <KindBadge kind="gap" />
        <p className="mt-2 text-[12.5px] leading-relaxed text-chrome">
          {T.body === "moon" ? "Gravity here is six times stronger, there is air, and Earth's magnetic field blocks space radiation." : "Gravity here is 2.6 times stronger, the air is 160 times thicker, and Earth's magnetic field blocks space radiation."} Use this site
          for what it can copy: {rows
            .filter((r) => factor(r.f.dims) >= 0.6)
            .map((r) => r.f.label.toLowerCase())
            .join(", ") || "parts of the ground and climate"}
          .
        </p>
      </div>
      <p className="mt-4 text-[10.5px] leading-relaxed text-dim">
        Data: SRTM terrain, NASA POWER, MODIS (NASA GIBS), Smithsonian GVP, impact craters, Natural Earth; {T.body === "moon" ? "LRO LOLA" : "MGS MOLA"} for {T.name}. Satellite view: ESA Sentinel-2 cloudless.
      </p>
    </div>
  );
}
