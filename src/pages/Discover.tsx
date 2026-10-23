import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Copy,
  Flame,
  Globe,
  LocateFixed,
  Map as MapIcon,
  Microscope,
  Pickaxe,
  Route,
  Search,
  SlidersHorizontal,
  Snowflake,
  SunDim,
  Target,
  Tent,
  Trash2,
  X,
} from "lucide-react";
import { Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { Astronaut, climateReaction, reactionFor, type Reaction } from "../components/ui/Astronaut";
import { Chip, Counter, EASE, KindBadge, Kicker, Meter, Reveal, RevealWords, Ring, Seg, Tip, toast } from "../components/ui/kit";
import type { GlobePin } from "../components/three/ScoreGlobe";
import { TARGETS, TARGET_BY_ID, TASKS, type TaskId, type World } from "../data/sites";
import { TASK_WEIGHTS, type Weights } from "../lib/scoring";
import { formatCoord } from "../lib/geo";
import {
  DIMS,
  DIM_INFO,
  MONTHS,
  RAMP_CSS,
  nearestKnown,
  paintScores,
  percentileOf,
  rankPlaces,
  scoreAll,
  scoreCell,
  searchGrid,
  useGrid,
  type Candidate,
  type Dim,
  type Grid,
  type GridTarget,
  type SearchHit,
} from "../lib/grid";
import { placeId, useSaved } from "../lib/saved";
import { logBadge } from "../lib/fieldlog";

const ScoreGlobe = lazy(() => import("../components/three/ScoreGlobe"));

const TASK_ICON: Record<TaskId, typeof Tent> = {
  base: Tent,
  traverse: Route,
  isru: Pickaxe,
  ice: Snowflake,
  caves: Flame,
  astrobio: Microscope,
  impact: Target,
  polar: SunDim,
};

const TASK_HINT: Record<TaskId, string> = {
  base: "Live and work far from help",
  traverse: "Rough slopes for wheels and boots",
  isru: "Rock and dust to dig and process",
  ice: "Frozen ground and deep cold",
  caves: "Lava fields with tubes and caves",
  astrobio: "The driest places life survives",
  impact: "Real craters and shocked rock",
  polar: "Long shadows like the lunar pole",
};

type Within = { field: "n_country" | "n_region"; value: number; label: string } | null;

/* ===================================================================== page */

export default function Discover() {
  const { grid, progress, error } = useGrid();
  const [params, setParams] = useSearchParams();
  const [targetId, setTargetId] = useState(() => (TARGET_BY_ID[params.get("target") ?? ""] ? params.get("target")! : "jezero"));
  const [task, setTask] = useState<TaskId>(() => (TASKS.some((t) => t.id === params.get("task")) ? (params.get("task") as TaskId) : "astrobio"));
  const [weights, setWeights] = useState<Weights>(TASK_WEIGHTS[task]);
  const [modelMix, setModelMix] = useState(0.3);
  const [onlyNew, setOnlyNew] = useState(true);
  const [skipAnt, setSkipAnt] = useState(false);
  const [view, setView] = useState<"globe" | "flat">(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "flat" : "globe"));
  const [heatOn, setHeatOn] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const [within, setWithin] = useState<Within>(null);
  const [tab, setTab] = useState<"best" | "saved">("best");

  useEffect(() => setWeights(TASK_WEIGHTS[task]), [task]);
  const target = TARGET_BY_ID[targetId];
  const gt = grid?.targets[targetId] ?? null;
  const dWeights = useDeferredValue(weights);
  const dMix = useDeferredValue(modelMix);

  const scores = useMemo(() => (grid && gt ? scoreAll(grid, { target: gt, task, weights: dWeights, modelMix: dMix }) : null), [grid, gt, task, dWeights, dMix]);

  const heat = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas")), []);
  const [heatVersion, setHeatVersion] = useState(0);
  const [range, setRange] = useState<{ lo: number; hi: number } | null>(null);
  useEffect(() => {
    if (!grid || !scores || !heat) return;
    setRange(paintScores(grid, scores, heat));
    setHeatVersion((v) => v + 1);
  }, [grid, scores, heat]);

  const places = useMemo(
    () => (grid && scores ? rankPlaces(grid, scores, { count: 12, onlyNew: within ? false : onlyNew, skipAntarctica: skipAnt, within, spacingKm: within ? 120 : 400 }) : []),
    [grid, scores, onlyNew, skipAnt, within],
  );

  // keep the URL shareable
  useEffect(() => {
    const p: Record<string, string> = { target: targetId, task };
    if (grid && sel !== null) p.at = `${grid.lat(sel).toFixed(2)},${grid.lon(sel).toFixed(2)}`;
    setParams(p, { replace: true, preventScrollReset: true });
  }, [targetId, task, sel, grid, setParams]);

  // open a shared place once the data is in
  const [initialAt] = useState(() => params.get("at"));
  useEffect(() => {
    if (!grid || !initialAt) return;
    const [la, lo] = initialAt.split(",").map(Number);
    if (Number.isFinite(la) && Number.isFinite(lo)) selectAt(la, lo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  function selectCell(k: number, lat?: number, lon?: number) {
    if (!grid) return;
    const la = lat ?? grid.lat(k);
    const lo = lon ?? grid.lon(k);
    setSel(k);
    setPick({ lat: la, lon: lo });
    setFocus({ lat: la, lon: lo, key: Date.now() });
  }
  function selectAt(lat: number, lon: number) {
    if (!grid) return;
    const k = grid.cellAt(lat, lon, 3);
    if (k < 0) {
      toast("That spot is sea or ice shelf. Try land.", "info");
      return;
    }
    selectCell(k, lat, lon);
  }
  function chooseHit(h: SearchHit) {
    if (!grid) return;
    if (h.field !== undefined && h.value !== undefined) {
      setWithin({ field: h.field, value: h.value, label: h.label });
      setSel(null);
      setTab("best");
      return;
    }
    if (h.lat !== undefined && h.lon !== undefined) selectAt(h.lat, h.lon);
    if (h.kind === "place") logBadge("town");
  }
  useEffect(() => {
    // fly to the best spot when a region filter is set
    if (within && places[0]) setFocus({ lat: places[0].lat, lon: places[0].lon, key: Date.now() });
  }, [within, places]);

  const pins: GlobePin[] = useMemo(() => {
    const out: GlobePin[] = places.map((c, i) => ({ id: `c${c.k}`, lat: c.lat, lon: c.lon, color: "#f2c879", kind: "candidate", rank: i + 1 }));
    if (grid)
      grid.meta.known
        .filter((s) => s.worlds.includes(target.body))
        .forEach((s) => out.push({ id: `k-${s.id}`, lat: s.lat, lon: s.lon, color: target.body === "moon" ? "#c9c5bc" : "#e08a5f", kind: "known" }));
    if (pick && sel !== null) out.push({ id: "pick", lat: pick.lat, lon: pick.lon, color: "#ffffff", kind: "pick" });
    return out;
  }, [places, grid, target.body, pick, sel]);

  const activePin = sel === null ? null : places.some((c) => c.k === sel) ? `c${sel}` : "pick";
  const onPin = (id: string) => {
    if (!grid) return;
    if (id.startsWith("c")) selectCell(+id.slice(1));
    else if (id.startsWith("k-")) {
      const s = grid.meta.known.find((x) => `k-${x.id}` === id);
      if (s) selectAt(s.lat, s.lon);
    }
  };

  const hoverInfo = useMemo(() => {
    if (!grid || !scores || !hover) return null;
    const k = grid.cellAt(hover.lat, hover.lon, 0);
    if (k < 0) return { title: "Sea", score: null as number | null };
    return { title: grid.name(k).title, score: scores[k] };
  }, [grid, scores, hover]);

  const reaction: Reaction = useMemo(() => {
    if (!grid || !scores) return { mood: "focused", action: "scan", say: `Loading ${(80206).toLocaleString()} places of NASA data…` };
    if (sel !== null) {
      const c = climateReaction(grid.value("f_lst_night_min", sel), grid.value("f_lst_day_max", sel));
      if (c) return c;
      return reactionFor(scores[sel], false);
    }
    const top = places[0];
    if (!top) return { mood: "thinking", action: "binoculars", say: "Nothing here yet. Try another job or region." };
    const nm = grid.name(top.k).title;
    if (top.score >= 0.72) return { mood: "happy", action: "celebrate", say: `Top pick: ${nm} (${top.score.toFixed(2)}). Click it to see why.` };
    return { mood: "thinking", action: "binoculars", say: `Best match is ${nm} at ${top.score.toFixed(2)}. Move the sliders to explore.` };
  }, [grid, scores, sel, places]);

  return (
    <div className="bg-void">
      <Nav />
      <section className="border-b border-line">
        <div className="grid md:grid-cols-2 xl:h-[calc(100dvh-64px)] xl:min-h-[680px] xl:grid-cols-[330px_minmax(0,1fr)_390px]">
          {/* ------------------------------------------------ controls */}
          <aside className="scrollbar-thin order-2 border-line p-5 xl:order-1 xl:overflow-y-auto xl:border-r">
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Find new test sites</div>
            <h1 className="mt-2 text-[26px] leading-[1.08] font-medium tracking-[-0.03em]">
              Search the whole Earth <span className="font-serif font-normal text-flare italic">for the next one.</span>
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-chrome">
              {grid ? <Counter value={grid.n} /> : "80,206"} land areas, each about 55 km wide, scored live from NASA data. Pick a job and a destination.
            </p>

            <Step n={1} title="What do you want to practise?">
              <div className="grid grid-cols-2 gap-1.5">
                {TASKS.map((t) => {
                  const Icon = TASK_ICON[t.id];
                  const on = t.id === task;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTask(t.id)}
                      aria-pressed={on}
                      title={TASK_HINT[t.id]}
                      className={clsx("surface flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] leading-tight transition-colors", on ? "!border-flare/60 text-platinum" : "text-chrome hover:text-platinum")}
                    >
                      <Icon size={15} strokeWidth={1.6} className={on ? "text-flare" : "text-dim"} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11.5px] text-dim">{TASK_HINT[task]}.</p>
            </Step>

            <Step n={2} title="Where is the mission going?">
              <TargetPicker value={targetId} onChange={setTargetId} />
            </Step>

            <Step n={3} title="Fine-tune (optional)" icon={<SlidersHorizontal size={13} />}>
              <Tuning weights={weights} setWeights={setWeights} task={task} modelMix={modelMix} setModelMix={setModelMix} onlyNew={onlyNew} setOnlyNew={setOnlyNew} skipAnt={skipAnt} setSkipAnt={setSkipAnt} />
            </Step>
          </aside>

          {/* ------------------------------------------------ map */}
          <div data-theme="dark" className="relative order-1 h-[64vh] min-h-[440px] overflow-hidden bg-void md:col-span-2 xl:order-2 xl:col-span-1 xl:h-auto">
            {grid && heat ? (
              view === "globe" ? (
                <Suspense fallback={<StageLoader progress={1} label="Starting the globe" />}>
                  <ScoreGlobe heat={heat} heatVersion={heatVersion} heatOn={heatOn} pins={pins} activeId={activePin} focus={focus} onPick={selectAt} onHover={setHover} onPin={onPin} />
                </Suspense>
              ) : (
                <FlatMap heat={heat} heatVersion={heatVersion} heatOn={heatOn} pins={pins} activeId={activePin} onPick={selectAt} onHover={setHover} onPin={onPin} />
              )
            ) : (
              <StageLoader progress={progress} label={error ?? "Loading the planet"} />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3">
              <SearchBox grid={grid} onHit={chooseHit} onLocate={selectAt} />
              <div className="pointer-events-auto flex items-center gap-2">
                <Seg
                  size="sm"
                  value={view}
                  onChange={setView}
                  options={[
                    { id: "globe", label: <><Globe size={12} /> Globe</> },
                    { id: "flat", label: <><MapIcon size={12} /> Flat</> },
                  ]}
                />
                <button onClick={() => setHeatOn((h) => !h)} aria-pressed={heatOn} className={clsx("glass rounded-full px-3 py-1.5 text-[11.5px]", heatOn ? "text-flare" : "text-chrome")}>
                  {heatOn ? "Scores on" : "Scores off"}
                </button>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-3">
              <div className="pointer-events-auto hidden sm:block">
                <Astronaut size={74} mood={reaction.mood} action={reaction.action} say={reaction.say} sayAlign="side" />
              </div>
              <div className="glass pointer-events-auto ml-auto w-[260px] rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] text-chrome">
                  <span>Match score</span>
                  <span className="font-mono text-dim">{hoverInfo ? (hoverInfo.score === null ? hoverInfo.title : `${hoverInfo.title.slice(0, 22)} · ${hoverInfo.score.toFixed(2)}`) : "hover the map"}</span>
                </div>
                <div className="mt-2 h-2 rounded-full" style={{ background: RAMP_CSS }} />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-dim">
                  <span>{range ? range.lo.toFixed(2) : "…"} lower</span>
                  <span>higher {range ? range.hi.toFixed(2) : "…"}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10.5px] text-dim">
                  <span className="flex items-center gap-1.5">
                    <span className="grid size-3.5 place-items-center rounded-full border border-flare bg-void font-mono text-[7px] text-platinum">1</span> ranked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full border-2" style={{ borderColor: target.body === "moon" ? "#c9c5bc" : "#e08a5f" }} /> already used
                  </span>
                  <span>click land to check it</span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------ results */}
          <aside className="scrollbar-thin order-3 border-line md:border-l xl:overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              {grid && scores && gt && sel !== null ? (
                <motion.div key={`r${sel}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.4, ease: EASE }}>
                  <PlaceReport grid={grid} k={sel} scores={scores} gt={gt} task={task} weights={weights} modelMix={modelMix} onBack={() => setSel(null)} />
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.35, ease: EASE }} className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Seg
                      size="sm"
                      value={tab}
                      onChange={setTab}
                      options={[
                        { id: "best", label: "Best places" },
                        { id: "saved", label: "Saved" },
                      ]}
                    />
                    <span className="flex items-center gap-1.5 text-[11px] text-dim">
                      <WorldDot world={target.body} /> {target.name}
                    </span>
                  </div>
                  {tab === "best" ? (
                    <>
                      {within && (
                        <div className="mt-4 flex items-center justify-between rounded-xl border border-flare/40 bg-flare/10 px-3 py-2 text-[12px] text-flare">
                          Only inside {within.label}
                          <button onClick={() => setWithin(null)} aria-label="Clear region filter" className="hover:text-platinum">
                            <X size={13} />
                          </button>
                        </div>
                      )}
                      <p className="mt-4 text-[12px] leading-relaxed text-dim">
                        {within ? "The best spots inside this area." : onlyNew ? "New places only: none of these are within 150 km of a known test site." : "Including places already used for testing."}
                      </p>
                      <ol className="mt-3 space-y-2">
                        {grid && gt
                          ? places.map((c, i) => <PlaceRow key={c.k} grid={grid} c={c} rank={i + 1} gt={gt} task={task} weights={weights} modelMix={modelMix} onClick={() => selectCell(c.k)} />)
                          : Array.from({ length: 6 }, (_, i) => <li key={i} className="shimmer h-[86px] rounded-xl" />)}
                      </ol>
                    </>
                  ) : (
                    <SavedList onOpen={(la, lo) => selectAt(la, lo)} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </section>

      {grid && <HowItWorks grid={grid} />}
      <Footer />
    </div>
  );
}

/* ================================================================ controls */

function Step({ n, title, icon, children }: { n: number; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-platinum">
        <span className="grid size-5 place-items-center rounded-full bg-platinum font-mono text-[10px] text-void">{n}</span>
        {title}
        {icon && <span className="text-dim">{icon}</span>}
      </div>
      {children}
    </div>
  );
}

function TargetPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const cur = TARGET_BY_ID[value];
  const [world, setWorld] = useState<World>(cur.body);
  useEffect(() => setWorld(cur.body), [cur.body]);
  const list = TARGETS.filter((t) => t.body === world);
  return (
    <div>
      <Seg
        size="sm"
        value={world}
        onChange={(w) => {
          setWorld(w);
          if (cur.body !== w) onChange(TARGETS.find((t) => t.body === w)!.id);
        }}
        options={[
          { id: "moon", label: <><WorldDot world="moon" /> Moon</> },
          { id: "mars", label: <><WorldDot world="mars" /> Mars</> },
        ]}
      />
      <ul className="mt-2 space-y-1">
        {list.map((t) => {
          const on = t.id === value;
          return (
            <li key={t.id}>
              <button
                onClick={() => onChange(t.id)}
                aria-pressed={on}
                className={clsx("w-full rounded-lg border px-3 py-2 text-left transition-colors", on ? "border-flare/50 bg-flare/[0.07]" : "border-transparent hover:border-line-2 hover:bg-platinum/[0.025]")}
              >
                <div className={clsx("text-[12.5px]", on ? "text-platinum" : "text-chrome")}>{t.name}</div>
                <div className="text-[11px] text-dim">{t.kind}</div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11.5px] leading-relaxed text-dim">{cur.why}</p>
    </div>
  );
}

function Tuning({
  weights,
  setWeights,
  task,
  modelMix,
  setModelMix,
  onlyNew,
  setOnlyNew,
  skipAnt,
  setSkipAnt,
}: {
  weights: Weights;
  setWeights: (w: Weights) => void;
  task: TaskId;
  modelMix: number;
  setModelMix: (v: number) => void;
  onlyNew: boolean;
  setOnlyNew: (v: boolean) => void;
  skipAnt: boolean;
  setSkipAnt: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {DIMS.map((d) => (
          <label key={d} className="block text-[12px]">
            <span className="flex items-center justify-between text-chrome">
              <span className="flex items-center gap-1.5">
                {DIM_INFO[d].label} <Tip text={DIM_INFO[d].plain} />
              </span>
              <span className="font-mono text-dim">{Math.round(weights[d] * 100)}</span>
            </span>
            <input
              type="range"
              className="range mt-1 w-full"
              min={0}
              max={1}
              step={0.05}
              value={weights[d]}
              style={{ ["--fill" as string]: `${weights[d] * 100}%` }}
              onChange={(e) => setWeights({ ...weights, [d]: +e.target.value })}
              aria-label={`${DIM_INFO[d].label} importance`}
            />
          </label>
        ))}
        <button onClick={() => setWeights(TASK_WEIGHTS[task])} className="text-[11px] text-dim hover:text-chrome">
          Reset to the preset for this job
        </button>
      </div>
      <label className="block rounded-xl border border-line bg-ink p-3 text-[12px]">
        <span className="flex items-center justify-between text-chrome">
          <span className="flex items-center gap-1.5">
            Trust the learned model <Tip text="Our model learned what 38 known test sites have in common. 0 means use only the mission formula. 100 means use only the model." />
          </span>
          <span className="font-mono text-dim">{Math.round(modelMix * 100)}%</span>
        </span>
        <input type="range" className="range mt-1 w-full" min={0} max={1} step={0.05} value={modelMix} style={{ ["--fill" as string]: `${modelMix * 100}%` }} onChange={(e) => setModelMix(+e.target.value)} aria-label="Model share" />
      </label>
      <Toggle on={onlyNew} set={setOnlyNew} label="Only new places" hint="Hide places within 150 km of a known test site" />
      <Toggle on={skipAnt} set={setSkipAnt} label="Skip Antarctica" hint="Useful when a team can't get treaty permits" />
    </div>
  );
}

function Toggle({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => set(!on)} role="switch" aria-checked={on} className="flex w-full items-center justify-between gap-3 text-left">
      <span>
        <span className="block text-[12.5px] text-platinum">{label}</span>
        <span className="block text-[11px] text-dim">{hint}</span>
      </span>
      <span className={clsx("relative h-5 w-9 shrink-0 rounded-full border transition-colors", on ? "border-flare/60 bg-flare/25" : "border-line-2 bg-ink")}>
        <motion.span className="absolute top-0.5 size-3.5 rounded-full bg-platinum" animate={{ left: on ? 18 : 3 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
      </span>
    </button>
  );
}

/* ================================================================== search */

function SearchBox({ grid, onHit, onLocate }: { grid: Grid | null; onHit: (h: SearchHit) => void; onLocate: (lat: number, lon: number) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const hits = useMemo(() => (grid ? searchGrid(grid, q) : []), [grid, q]);
  const go = (h: SearchHit) => {
    onHit(h);
    setQ(h.label);
    setOpen(false);
  };
  const locate = () => {
    if (!navigator.geolocation) return toast("Location is not available in this browser.", "info");
    navigator.geolocation.getCurrentPosition(
      (p) => onLocate(p.coords.latitude, p.coords.longitude),
      () => toast("Location permission was not given.", "info"),
      { timeout: 8000 },
    );
  };
  return (
    <div className="pointer-events-auto relative w-full max-w-[340px]">
      <div className="glass flex items-center gap-2 rounded-full py-1 pr-1 pl-3.5">
        <Search size={14} className="text-dim" />
        <input
          value={q}
          disabled={!grid}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setI(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setI((v) => Math.min(hits.length - 1, v + 1));
            if (e.key === "ArrowUp") setI((v) => Math.max(0, v - 1));
            if (e.key === "Enter" && hits[i]) go(hits[i]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={grid ? "Check any place: Dhaka, Sahara, Iceland…" : "Loading places…"}
          aria-label="Search a place"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-platinum outline-none placeholder:text-dim"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search" className="p-1 text-dim hover:text-platinum">
            <X size={13} />
          </button>
        )}
        <button onClick={locate} title="Use my location" aria-label="Use my location" className="grid size-8 place-items-center rounded-full bg-platinum/[0.06] text-chrome transition-colors hover:text-flare">
          <LocateFixed size={14} />
        </button>
      </div>
      <AnimatePresence>
        {open && hits.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="glass absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl p-1" role="listbox">
            {hits.map((h, k) => (
              <li key={`${h.kind}${h.label}${k}`}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(h)}
                  onMouseEnter={() => setI(k)}
                  className={clsx("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left", k === i ? "bg-platinum/[0.08]" : "")}
                >
                  <span className="truncate text-[13px] text-platinum">{h.label}</span>
                  <span className="shrink-0 text-[11px] text-dim">{h.sub}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================== flat map */

function FlatMap({
  heat,
  heatVersion,
  heatOn,
  pins,
  activeId,
  onPick,
  onHover,
  onPin,
}: {
  heat: HTMLCanvasElement;
  heatVersion: number;
  heatOn: boolean;
  pins: GlobePin[];
  activeId: string | null;
  onPick: (lat: number, lon: number) => void;
  onHover: (p: { lat: number; lon: number } | null) => void;
  onPin: (id: string) => void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    c.width = heat.width;
    c.height = heat.height;
    c.getContext("2d")!.drawImage(heat, 0, 0);
  }, [heat, heatVersion]);
  const ll = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { lat: 90 - ((e.clientY - r.top) / r.height) * 180, lon: ((e.clientX - r.left) / r.width) * 360 - 180 };
  };
  return (
    <div className="grid size-full place-items-center p-3 pt-16 pb-28">
      <div
        className="relative aspect-[2/1] w-full max-w-full cursor-crosshair overflow-hidden rounded-xl border border-line"
        style={{ maxHeight: "100%" }}
        onClick={(e) => {
          const p = ll(e);
          onPick(p.lat, p.lon);
        }}
        onMouseMove={(e) => onHover(ll(e))}
        onMouseLeave={() => onHover(null)}
      >
        <img src="/textures/earth_day_2k.webp" alt="" className="absolute inset-0 size-full object-cover opacity-55 saturate-50" draggable={false} />
        <canvas ref={cv} className="absolute inset-0 size-full transition-opacity duration-500" style={{ opacity: heatOn ? 1 : 0 }} />
        {pins.map((p) => {
          const x = ((p.lon + 180) / 360) * 100;
          const y = ((90 - p.lat) / 180) * 100;
          const on = p.id === activeId;
          return (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation();
                onPin(p.id);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-label={p.kind === "candidate" ? `Place ${p.rank}` : p.kind === "known" ? "Known test site" : "Selected place"}
            >
              {p.kind === "candidate" ? (
                <span className={clsx("grid place-items-center rounded-full border-2 bg-void font-mono text-platinum transition-transform", on ? "size-6 scale-110 text-[11px]" : "size-[18px] text-[9px]")} style={{ borderColor: p.color }}>
                  {p.rank}
                </span>
              ) : p.kind === "known" ? (
                <span className="block size-2.5 rounded-full border-2 bg-void/60" style={{ borderColor: p.color }} />
              ) : (
                <span className="relative block size-3.5 rounded-full bg-white shadow-[0_0_0_3px_rgba(7,8,10,0.8)]">
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StageLoader({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="grid size-full place-items-center">
      <div className="flex flex-col items-center">
        <Astronaut size={92} mood="focused" action="scan" />
        <div className="mt-4 font-mono text-[11px] tracking-widest text-chrome uppercase">{label}</div>
        <div className="mt-3 h-px w-60 bg-line">
          <motion.div className="h-px bg-flare" animate={{ width: `${Math.max(3, progress * 100)}%` }} transition={{ ease: EASE, duration: 0.4 }} />
        </div>
        <div className="mt-2 font-mono text-[10px] text-dim">{Math.round(progress * 100)}% · 4 MB of NASA-derived data, cached after the first visit</div>
      </div>
    </div>
  );
}

/* ================================================================ results */

function reasons(grid: Grid, k: number, gt: GridTarget, task: TaskId, weights: Weights, modelMix: number) {
  const cs = scoreCell(grid, k, { target: gt, task, weights, modelMix });
  const ranked = (Object.keys(cs.dims) as Dim[]).filter((d) => weights[d] > 0).sort((a, b) => cs.dims[b] * weights[b] - cs.dims[a] * weights[a]);
  const label = (d: Dim) => {
    if (d === "geology") {
      const v = grid.ind("volcanic", k);
      const i = grid.ind("impact", k);
      return v >= i ? "Volcanic ground" : "Impact crater";
    }
    if (d === "temperature") return grid.ind("cold", k) > grid.ind("swing", k) ? "Deep cold" : "Big heat swing";
    if (d === "lighting") return "Similar Sun angle";
    if (d === "topography") return "Similar slopes";
    return "Bare, dry ground";
  };
  return { cs, top: ranked.slice(0, 2).map((d) => ({ d, label: label(d), v: cs.dims[d] })) };
}

function PlaceRow({ grid, c, rank, gt, task, weights, modelMix, onClick }: { grid: Grid; c: Candidate; rank: number; gt: GridTarget; task: TaskId; weights: Weights; modelMix: number; onClick: () => void }) {
  const nm = grid.name(c.k);
  const { top } = reasons(grid, c.k, gt, task, weights, modelMix);
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: rank * 0.025 }}>
      <button onClick={onClick} className="surface lift group flex w-full gap-3 rounded-xl p-3 text-left">
        <span className="outline-num w-7 shrink-0 pt-0.5 text-[22px] leading-none">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13.5px] text-platinum">{nm.title}</span>
            <span className="font-mono text-[13px] text-flare">{c.score.toFixed(2)}</span>
          </span>
          <span className="block truncate text-[11px] text-dim">{nm.subtitle || formatCoord(c.lat, c.lon)}</span>
          <span className="mt-2 flex flex-wrap gap-1">
            {top.map((r) => (
              <Chip key={r.d} className="!px-2 !py-0.5 !text-[10.5px]">
                {r.label}
              </Chip>
            ))}
            {c.known && (
              <Chip tone="moon" className="!px-2 !py-0.5 !text-[10.5px]">
                Known: {c.known.name.split(",")[0]}
              </Chip>
            )}
          </span>
        </span>
        <ArrowRight size={14} className="mt-1 shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-platinum" />
      </button>
    </motion.li>
  );
}

function SavedList({ onOpen }: { onOpen: (lat: number, lon: number) => void }) {
  const { list, remove } = useSaved();
  if (!list.length)
    return (
      <div className="mt-8 flex flex-col items-center text-center">
        <Astronaut size={80} mood="thinking" action="idle" />
        <p className="mt-3 max-w-[240px] text-[13px] text-chrome">Nothing saved yet. Open a place and press “Save” to keep it here.</p>
      </div>
    );
  return (
    <ul className="mt-4 space-y-2">
      {list.map((p) => (
        <li key={p.id} className="surface flex items-center gap-3 rounded-xl p-3">
          <button onClick={() => onOpen(p.lat, p.lon)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px] text-platinum">{p.name}</span>
            <span className="block truncate text-[11px] text-dim">{p.sub || formatCoord(p.lat, p.lon)}</span>
          </button>
          {p.score !== undefined && <span className="font-mono text-[12px] text-flare">{p.score.toFixed(2)}</span>}
          <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="p-1 text-dim hover:text-weak">
            <Trash2 size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}

const fmt = (v: number | null, unit: string, d = 0) => (v === null ? "no data" : `${v.toFixed(d)}${unit}`);

function plantWord(ndvi: number | null) {
  if (ndvi === null) return "no data";
  if (ndvi < 0.15) return "Almost none";
  if (ndvi < 0.3) return "Sparse";
  if (ndvi < 0.5) return "Some";
  return "Green";
}

function PlaceReport({ grid, k, scores, gt, task, weights, modelMix, onBack }: { grid: Grid; k: number; scores: Float32Array; gt: GridTarget; task: TaskId; weights: Weights; modelMix: number; onBack: () => void }) {
  const lat = grid.lat(k);
  const lon = grid.lon(k);
  const nm = grid.name(k);
  const { cs } = reasons(grid, k, gt, task, weights, modelMix);
  const pct = percentileOf(scores, scores[k]);
  const topPct = Math.max(0.1, (1 - pct) * 100);
  const topText = `top ${topPct < 1 ? topPct.toFixed(1) : Math.round(topPct)}%`;
  const nk = nearestKnown(grid, lat, lon);
  const v = (n: string) => grid.value(n, k);
  const climate = climateReaction(v("f_lst_night_min"), v("f_lst_day_max"));
  const react = climate ?? reactionFor(cs.total, false);
  const volc = grid.volcano(k);
  const crater = grid.crater(k);
  const bestMonth = MONTHS[gt.light_month[grid.row[k]]];
  const saved = useSaved();
  const id = placeId(lat, lon);
  const isSaved = saved.has(id);
  const worldName = gt.body === "moon" ? "Moon" : "Mars";
  useEffect(() => logBadge("find"), []);
  const facts: [string, string, string?][] = [
    ["Height above sea", fmt(v("f_elev"), " m")],
    ["Height range in 50 km", fmt(v("f_relief"), " m"), "Highest minus lowest ground (2nd to 98th percentile)."],
    ["Average slope", fmt(v("f_slope"), "°", 1)],
    ["Coldest ground at night", fmt(v("f_lst_night_min"), " °C"), "MODIS night land surface temperature, coldest month of 2024."],
    ["Hottest ground by day", fmt(v("f_lst_day_max"), " °C"), "MODIS day land surface temperature, hottest month of 2024."],
    ["Rain and snow per year", fmt(v("f_precip"), " mm"), "NASA POWER climate average."],
    ["Plants", plantWord(v("f_ndvi")), "From MODIS vegetation index (NDVI)."],
    ["Bare ground", fmt(v("f_barren") === null ? null : v("f_barren")! * 100, "%")],
    ["Nearest volcano", volc ? `${volc.name}, ${Math.round(volc.km)} km` : "none near"],
    ["Impact crater", crater && crater.score > 0.2 ? crater.name : "none near"],
    ["Nearest town", nm.place ? `${nm.place}, ${Math.round(nm.placeKm ?? 0)} km` : "none listed"],
    ["Best month for the light", bestMonth, `When the Sun angle here is most like ${gt.name}.`],
  ];
  const share = () => {
    const url = `${window.location.origin}/discover?target=${gt.id}&task=${task}&at=${lat.toFixed(2)},${lon.toFixed(2)}`;
    navigator.clipboard?.writeText(url).then(
      () => toast("Link copied"),
      () => toast("Could not copy the link", "info"),
    );
  };
  return (
    <div className="p-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-chrome hover:text-platinum">
        <ArrowLeft size={13} /> Back to the list
      </button>
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {nk.km < 150 && nk.site ? <Chip tone="moon">Known site nearby: {nk.site.name.split(",")[0]}</Chip> : <Chip tone="flare">New candidate</Chip>}
          {grid.lat(k) < -60 && <Chip>Antarctic Treaty area</Chip>}
        </div>
        <h2 className="mt-3 text-[24px] leading-tight font-medium tracking-[-0.02em]">{nm.title}</h2>
        <div className="mt-1 text-[12px] text-dim">
          {nm.subtitle ? `${nm.subtitle} · ` : ""}
          <span className="font-mono">{formatCoord(lat, lon)}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Ring value={cs.total} size={112} label="match" sub={topText} />
        <Astronaut size={92} mood={react.mood} action={react.action} />
      </div>
      <p className="mt-3 min-h-[40px] text-[13.5px] leading-snug text-platinum">{react.say}</p>
      <p className="text-[11.5px] text-dim">
        Match for “{TASKS.find((t) => t.id === task)!.label.toLowerCase()}” at {gt.name}: in the {topText} of all land on Earth.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to={`/lab?earth=@${lat.toFixed(2)},${lon.toFixed(2)}&target=${gt.id}&task=${task}`} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium">
          Compare in 3D <ArrowRight size={13} />
        </Link>
        <button
          onClick={() => {
            const added = saved.toggle({ id, name: nm.title, sub: nm.subtitle, lat, lon, score: cs.total, target: gt.id, task });
            toast(added ? "Saved to your list" : "Removed from your list");
            if (added) logBadge("save");
          }}
          className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] transition-colors", isSaved ? "border-flare/60 text-flare" : "border-line-2 text-chrome hover:text-platinum")}
        >
          {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />} {isSaved ? "Saved" : "Save"}
        </button>
        <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-2 text-[12.5px] text-chrome hover:text-platinum">
          <Copy size={13} /> Copy link
        </button>
      </div>

      <h3 className="mt-7 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Why it scores {cs.total.toFixed(2)}</h3>
      <div className="mt-3 space-y-3.5">
        {DIMS.map((d) => (
          <Meter key={d} value={cs.dims[d]} label={DIM_INFO[d].label} kind="computed" hint={`${DIM_INFO[d].plain} Weight ${Math.round(weights[d] * 100)}.`} />
        ))}
        <Meter
          value={cs.model}
          label="Learned model"
          kind="model"
          tone="var(--color-earth)"
          hint={`Looks more ${worldName}-like than ${Math.round(cs.model * 100)}% of land, judged by a model trained on 38 known test sites. Counts ${Math.round(modelMix * 100)}% of the total.`}
        />
      </div>

      <h3 className="mt-7 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">What the data says</h3>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {facts.map(([a, b, tip]) => (
          <div key={a} className="bg-panel p-3">
            <dt className="flex items-center gap-1 text-[10.5px] text-dim">
              {a} {tip && <Tip text={tip} />}
            </dt>
            <dd className="mt-0.5 text-[13px] text-platinum">{b}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 rounded-xl border border-weak/30 bg-weak/[0.06] p-3">
        <div className="flex items-center gap-2">
          <KindBadge kind="gap" />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-chrome">
          {gt.body === "moon" ? "Gravity is 6 times stronger here, there is air, and Earth's magnetic field blocks space radiation." : "Gravity is 2.6 times stronger here, the air is 160 times thicker, and Earth's magnetic field blocks space radiation."}
        </p>
      </div>
    </div>
  );
}

/* ============================================================ how it works */

const FEATURE_NAME: Record<string, string> = {
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
};

function HowItWorks({ grid }: { grid: Grid }) {
  const [world, setWorld] = useState<World>("moon");
  const ev = grid.meta.evaluation[world];
  const rows = Object.entries(ev.per_site)
    .map(([id, [m, b]]) => ({ id, name: grid.meta.known.find((s) => s.id === id)?.name.split(",")[0] ?? id, m, b }))
    .sort((a, b) => a.m - b.m);
  const x = (pct: number) => (Math.log10(Math.max(0.1, pct)) + 1) / 3; // 0.1% → 0, 100% → 1
  const sources = [
    ["NASA POWER", "Air temperature, rain, humidity, sunshine"],
    ["NASA GIBS · MODIS", "Ground temperature day and night, plants, snow, land cover"],
    ["AWS Terrain Tiles", "Earth heights (SRTM based), 50 km around every place"],
    ["LRO LOLA · MGS MOLA", "Moon and Mars heights at full precision"],
    ["Smithsonian GVP", "1,214 volcanoes active in the last 12,000 years"],
    ["Earth Impact Database", "65 confirmed impact craters"],
  ];
  return (
    <section className="relative border-b border-line px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1300px]">
        <Kicker n="01">How the ranking works</Kicker>
        <h2 className="mt-6 max-w-[900px] text-[clamp(28px,3.6vw,52px)] leading-[1.04] font-medium tracking-[-0.035em]">
          <RevealWords text="Every land area on Earth, measured the same way." />{" "}
          <span className="font-serif font-normal text-chrome italic">
            <RevealWords text="Then scored for your mission." delay={0.2} />
          </span>
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { n: grid.n, t: "places scored", d: "Each about 55 by 55 km. Seas are left out." },
            { n: 24, t: "measurements per place", d: "Heights, slopes, cold, heat, rain, plants, volcanoes, craters and more." },
            { n: grid.meta.known.length, t: "known sites to learn from", d: "Used by NASA, ESA, CSA and university teams for field tests." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.06} className="surface rounded-2xl p-6">
              <div className="font-mono text-[clamp(36px,4vw,56px)] leading-none font-light text-platinum">
                <Counter value={s.n} />
              </div>
              <div className="mt-3 text-[14px] text-platinum">{s.t}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-dim">{s.d}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {sources.map(([a, b], i) => (
            <Reveal key={a} delay={i * 0.04} className="bg-panel p-5">
              <div className="flex items-center gap-2 text-[13.5px] text-platinum">
                <span className="size-1.5 rounded-full bg-flare" /> {a}
              </div>
              <p className="mt-1 text-[12.5px] text-chrome">{b}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-24 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Kicker n="02">Does it work?</Kicker>
            <h3 className="mt-6 text-[clamp(26px,3vw,42px)] leading-[1.06] font-medium tracking-[-0.03em]">
              We hid each known site <span className="font-serif font-normal text-chrome italic">and asked the model to find it.</span>
            </h3>
            <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-chrome">
              For every known test site, we trained the model without it, and without any other known site within 300 km. Then we checked where the hidden site
              ranked among all {grid.n.toLocaleString()} places. A simple hand-made rule is shown for comparison.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="surface rounded-2xl p-5">
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Model · typical rank</div>
                <div className="mt-2 font-mono text-[34px] leading-none font-light text-flare">
                  top <Counter value={ev.model_median_top_pct} decimals={1} suffix="%" />
                </div>
                <div className="mt-2 text-[12px] text-chrome">{ev.model_in_top10_pct}% of hidden sites land in the top 10%</div>
              </div>
              <div className="surface rounded-2xl p-5">
                <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Simple rule · typical rank</div>
                <div className="mt-2 font-mono text-[34px] leading-none font-light text-chrome">
                  top <Counter value={ev.baseline_median_top_pct} decimals={1} suffix="%" />
                </div>
                <div className="mt-2 text-[12px] text-chrome">{ev.baseline_in_top10_pct}% land in the top 10%</div>
              </div>
            </div>
            <div className="mt-6">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">What the model looks at most</div>
              <div className="mt-3 space-y-2">
                {ev.importance.slice(0, 6).map(([f, w]) => (
                  <Meter key={f} thin value={w / ev.importance[0][1]} label={<span className="text-[12px]">{FEATURE_NAME[f] ?? f}</span>} right={<span className="text-[11px] text-dim">{Math.round(w * 100)}%</span>} tone="var(--color-earth)" />
                ))}
              </div>
            </div>
          </div>
          <div className="surface rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px] text-platinum">Where each hidden site ranked</div>
              <Seg
                size="sm"
                value={world}
                onChange={setWorld}
                options={[
                  { id: "moon", label: "Moon sites" },
                  { id: "mars", label: "Mars sites" },
                ]}
              />
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-dim">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-flare" /> model
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-chrome" /> simple rule
              </span>
              <span className="ml-auto">left is better</span>
            </div>
            <div className="relative mt-4">
              <div className="pointer-events-none absolute inset-y-0 right-0 left-[132px]">
                {[0.1, 1, 10, 100].map((p) => (
                  <div key={p} className="absolute inset-y-0 border-l border-dashed border-line" style={{ left: `${x(p) * 100}%` }}>
                    <span className="absolute -top-5 -translate-x-1/2 font-mono text-[9.5px] text-dim">top {p}%</span>
                  </div>
                ))}
              </div>
              <ul className="space-y-1.5 pt-2">
                {rows.map((r, i) => (
                  <li key={`${world}${r.id}`} className="flex items-center gap-3">
                    <span className="w-[120px] shrink-0 truncate text-right text-[11.5px] text-chrome">{r.name}</span>
                    <span className="relative h-4 flex-1">
                      <motion.span
                        className="absolute top-1/2 h-px bg-line-2"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        style={{ left: `${Math.min(x(r.m), x(r.b)) * 100}%`, width: `${Math.abs(x(r.b) - x(r.m)) * 100}%` }}
                      />
                      <motion.span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-chrome bg-void" style={{ left: `${x(r.b) * 100}%` }} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.02 }} />
                      <motion.span
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flare"
                        initial={{ left: `${x(r.b) * 100}%`, opacity: 0 }}
                        whileInView={{ left: `${x(r.m) * 100}%`, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.2 + i * 0.03 }}
                        title={`Model: top ${r.m}% · rule: top ${r.b}%`}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-5 text-[11.5px] leading-relaxed text-dim">
              Ranks are among all {grid.n.toLocaleString()} land places. Sites like Concordia (an ice sheet station) rank low on purpose: they copy isolation, not the ground.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

