import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Box, ChevronLeft, ChevronRight, ExternalLink, Map as MapIcon, Radar, Sparkles, X } from "lucide-react";
import { Nav, FitBadge, WorldDot, WORLD_COLOR } from "../components/ui/Chrome";
import { Astronaut } from "../components/ui/Astronaut";
import { BodyMap, type BodyMapHandle, type MapMarker } from "../components/map/BodyMap";
import type { GlobeMarker } from "../components/three/Planet";
import {
  EARTH_BY_ID,
  EARTH_SITES,
  FIT_KEYS,
  REALITY_GAPS,
  SCREENING_REGIONS,
  TARGETS,
  TARGET_BY_ID,
  TASKS,
  type Body,
  type TaskId,
  type World,
} from "../data/sites";
import { DEFAULT_LAYER, LAYERS, LAYERS_BY_BODY } from "../data/layers";
import { formatCoord } from "../lib/geo";
import { useGrid, type Candidate, type Grid } from "../lib/grid";
import { aiTwins, findTwins, spotTerrain, type SpotTerrain } from "../lib/twins";
import { hasWebGL } from "../components/ui/Safe";

type TwinMode = "like" | "ground" | "ai";
import { useEarthThumb } from "../lib/thumbs";
import { EASE, Meter } from "../components/ui/kit";

const GlobeView = lazy(() => import("../components/three/GlobeView"));

type WorldFilter = World | "both";
type Selection = { kind: "earth" | "target" | "screen"; id: string } | null;

const BODIES: { id: Body; label: string }[] = [
  { id: "earth", label: "Earth" },
  { id: "moon", label: "Moon" },
  { id: "mars", label: "Mars" },
];

function siteColor(worlds: World[]) {
  if (worlds.length > 1) return WORLD_COLOR.earth;
  return worlds[0] === "moon" ? WORLD_COLOR.moon : WORLD_COLOR.mars;
}

export default function Atlas() {
  const [params, setParams] = useSearchParams();
  const initialSite = params.get("site");
  const [body, setBody] = useState<Body>(() => (params.get("body") as Body) || "earth");
  // without WebGL the 2D map is the useful view, so open it straight away
  const [view, setView] = useState<"3d" | "2d">(() => (params.get("layer") || !hasWebGL() ? "2d" : "3d"));
  const [layerByBody, setLayerByBody] = useState<Record<Body, string>>(() => {
    const l = params.get("layer");
    const base = { ...DEFAULT_LAYER };
    const found = LAYERS.find((x) => x.id === l);
    if (found) base[found.body] = found.id;
    return base;
  });
  const [lst, setLst] = useState(false);
  const [world, setWorld] = useState<WorldFilter>("both");
  const [task, setTask] = useState<TaskId | null>(null);
  const [showScreening, setShowScreening] = useState(true);
  const [sel, setSel] = useState<Selection>(() =>
    initialSite && EARTH_BY_ID[initialSite] ? { kind: "earth", id: initialSite } : null,
  );
  const mapRef = useRef<BodyMapHandle>(null);
  const [spot, setSpot] = useState<{ lat: number; lon: number } | null>(() => {
    const m = /^(-?[\d.]+),(-?[\d.]+)$/.exec(params.get("spot") ?? "");
    return m && params.get("body") !== "earth" && params.get("body") ? { lat: +m[1], lon: +m[2] } : null;
  });
  const [earthFocus, setEarthFocus] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (body === "earth") setSpot(null);
    else setEarthFocus(null);
  }, [body]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("body", body);
    if (view === "2d") next.set("layer", layerByBody[body]);
    if (sel?.kind === "earth") next.set("site", sel.id);
    if (spot && body !== "earth") next.set("spot", `${spot.lat.toFixed(2)},${spot.lon.toFixed(2)}`);
    setParams(next, { replace: true });
  }, [body, view, layerByBody, sel, spot, setParams]);

  const matchEarth = (s: (typeof EARTH_SITES)[number]) =>
    (world === "both" || s.worlds.includes(world)) && (!task || s.tasks.includes(task));
  const matchTarget = (t: (typeof TARGETS)[number]) => !task || t.tasks.includes(task);

  const selected = useMemo(() => {
    if (!sel) return null;
    if (sel.kind === "earth") return EARTH_BY_ID[sel.id];
    if (sel.kind === "target") return TARGET_BY_ID[sel.id];
    return SCREENING_REGIONS.find((r) => r.id === sel.id) ?? null;
  }, [sel]);

  const selectedBody: Body | null = sel ? (sel.kind === "target" ? TARGET_BY_ID[sel.id].body : "earth") : null;
  const focus = selected && selectedBody === body ? { lat: selected.lat, lon: selected.lon } : spot && body !== "earth" ? spot : earthFocus && body === "earth" ? earthFocus : null;

  const markers = useMemo(() => {
    const out: (MapMarker & GlobeMarker)[] = [];
    if (body === "earth") {
      for (const s of EARTH_SITES)
        out.push({ id: s.id, lat: s.lat, lon: s.lon, color: siteColor(s.worlds), label: s.name, dim: !matchEarth(s) });
      if (showScreening)
        for (const r of SCREENING_REGIONS)
          out.push({
            id: `screen:${r.id}`,
            lat: r.lat,
            lon: r.lon,
            color: "#a197cf",
            label: `${r.name} · checked`,
            dashed: true,
            dim: world !== "both" && !r.worlds.includes(world),
          });
      if (earthFocus) out.push({ id: "twin", lat: earthFocus.lat, lon: earthFocus.lon, color: "#f2c879", label: "Earth twin" });
    } else {
      for (const t of TARGETS.filter((t) => t.body === body))
        out.push({ id: t.id, lat: t.lat, lon: t.lon, color: "#edeae4", label: t.name, dim: !matchTarget(t) });
      if (spot) out.push({ id: "spot", lat: spot.lat, lon: spot.lon, color: "#f2c879", label: "Your spot" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, world, task, showScreening, spot, earthFocus]);

  const onSelect = (id: string) => {
    if (id === "spot" || id === "twin") return;
    setSpot(null);
    if (id.startsWith("screen:")) setSel({ kind: "screen", id: id.slice(7) });
    else if (body === "earth") setSel({ kind: "earth", id });
    else setSel({ kind: "target", id });
  };

  const goTarget = (id: string) => {
    const t = TARGET_BY_ID[id];
    setBody(t.body);
    setSel({ kind: "target", id });
    if (t.body === "moon" && t.lat < -80 && view === "2d") setLayerByBody((l) => ({ ...l, moon: "moon-south-pole" }));
  };
  const goEarth = (id: string) => {
    setBody("earth");
    setSel({ kind: "earth", id });
  };

  useEffect(() => {
    if (view === "2d" && focus) {
      const t = setTimeout(() => mapRef.current?.flyTo(focus.lat, focus.lon), 60);
      return () => clearTimeout(t);
    }
  }, [sel, view, body]); // eslint-disable-line react-hooks/exhaustive-deps

  const layerId = layerByBody[body];
  const visibleCount = markers.filter((m) => !m.dim && !m.dashed).length;

  const [panels, setPanels] = useState({ left: true, right: true });
  const layer = LAYERS.find((l) => l.id === layerId);

  return (
    <div className="bg-void">
      <Nav />
      <div className="relative lg:h-[calc(100dvh-64px)] lg:min-h-[680px]">
        {/* ------------------------------------------------ stage */}
        <main data-theme="dark" className="relative h-[62vh] min-h-[420px] overflow-hidden border-b border-line bg-void lg:absolute lg:inset-0 lg:h-auto lg:border-b-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${body}-${view}`}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              {view === "3d" ? (
                <Suspense fallback={<StageLoading />}>
                  <GlobeView
                    wheel="zoom"
                    body={body}
                    markers={markers}
                    activeId={spot ? "spot" : earthFocus && body === "earth" && !sel ? "twin" : (sel?.id ?? null)}
                    onSelect={onSelect}
                    focus={focus}
                    onPick={
                      body === "earth"
                        ? undefined
                        : (lat, lon) => {
                            setSel(null);
                            setSpot({ lat, lon });
                            setPanels((p) => ({ ...p, right: true }));
                          }
                    }
                  />
                </Suspense>
              ) : (
                <BodyMap
                  wheelZoom="always"
                  ref={mapRef}
                  body={body}
                  layerId={layerId}
                  overlayIds={body === "earth" && lst ? ["earth-lst"] : []}
                  markers={markers}
                  activeId={sel ? (sel.kind === "screen" ? `screen:${sel.id}` : sel.id) : null}
                  onSelect={onSelect}
                  initial={focus ? { ...focus, lat: focus.lat, lon: focus.lon, zoom: body === "earth" ? 5 : 4 } : undefined}
                />
              )}
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 z-[500] bg-[radial-gradient(120%_80%_at_50%_50%,transparent_55%,rgba(7,8,10,0.55))]" />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex flex-wrap items-start justify-center gap-2 p-3 sm:gap-3 sm:p-4 lg:pt-5">
            <div className="pointer-events-auto flex gap-1 rounded-full border border-line-2 bg-void/70 p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              {BODIES.map((b) => (
                <button key={b.id} onClick={() => setBody(b.id)} aria-pressed={body === b.id} className={clsx("relative flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-[12px] transition-colors sm:gap-2 sm:py-1.5 sm:pr-4 sm:pl-1.5 sm:text-[13px]", body === b.id ? "text-platinum" : "text-dim hover:text-chrome")}>
                  {body === b.id && <motion.span layoutId="world-pill" className="absolute inset-0 rounded-full bg-platinum/[0.09] ring-1 ring-platinum/15" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <PlanetThumb body={b.id} on={body === b.id} size={22} />
                  <span className="relative">{b.label}</span>
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex gap-1 rounded-full border border-line-2 bg-void/70 p-1 backdrop-blur-xl lg:absolute lg:top-5 lg:right-[412px]">
              <ViewBtn on={view === "3d"} onClick={() => setView("3d")} icon={<Box size={14} />} label="3D" />
              <ViewBtn on={view === "2d"} onClick={() => setView("2d")} icon={<MapIcon size={14} />} label="2D" />
            </div>
          </div>

          <WorldTitle body={body} shown={visibleCount} layer={view === "2d" ? (layer?.name ?? null) : null} left={panels.left} />

          <div className={clsx("pointer-events-none absolute bottom-16 z-[600] hidden md:block", panels.left ? "left-4 lg:left-[336px]" : "left-4")}>
            <Astronaut
              size={76}
              mood={sel ? "happy" : task ? "focused" : "thinking"}
              action={sel ? "sample" : task ? "scan" : "idle"}
              say={sel || spot ? null : body !== "earth" ? `Tap anywhere on ${body === "moon" ? "the Moon" : "Mars"}. I'll find its twins on Earth.` : task ? "Dim pins don't fit this task." : "Pick a pin, or choose a mission task."}
            />
          </div>
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-[600] hidden -translate-x-1/2 items-center gap-4 rounded-full border border-line bg-void/75 px-4 py-2 text-[11px] whitespace-nowrap text-chrome backdrop-blur-xl md:flex">
            {body === "earth" ? (
              <>
                <Key color={WORLD_COLOR.moon} label="Moon analog" />
                <Key color={WORLD_COLOR.mars} label="Mars analog" />
                <Key color={WORLD_COLOR.earth} label="Both" />
                {showScreening && <Key color="#a197cf" label="Regions we checked" dashed />}
              </>
            ) : (
              <Key color="#edeae4" label={body === "moon" ? "Moon base & target regions" : "Mars targets"} />
            )}
            <span className="font-mono text-dim">{visibleCount} shown</span>
          </div>
        </main>

        {/* ------------------------------------------------ left panel */}
        <Panel side="left" open={panels.left} onToggle={() => setPanels((p) => ({ ...p, left: !p.left }))} label="Filters and layers">
          <div className="space-y-8 p-5">
            <Section title="Practising for">
              <div className="relative grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink p-1">
                {(["moon", "both", "mars"] as WorldFilter[]).map((w) => (
                  <button key={w} onClick={() => setWorld(w)} aria-pressed={world === w} className={clsx("relative flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] capitalize transition-colors duration-150", world === w ? "text-platinum" : "text-dim hover:text-chrome")}>
                    {world === w && <motion.span layoutId="practise-pill" className="absolute inset-0 rounded-lg bg-platinum/[0.08]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span className="relative flex items-center gap-2">
                      {w !== "both" && <WorldDot world={w} />}
                      {w}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Mission task" hint={task ? "clear" : undefined} onHint={() => setTask(null)}>
              <div className="flex flex-wrap gap-1.5">
                {TASKS.map((t) => (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setTask((cur) => (cur === t.id ? null : t.id))}
                    title={t.question}
                    aria-pressed={task === t.id}
                    className={clsx("rounded-full border px-3 py-1.5 text-[12px] transition-colors duration-150", task === t.id ? "border-flare/60 bg-flare/10 text-platinum" : "border-line-2 text-chrome hover:border-chrome")}
                  >
                    {t.label}
                  </motion.button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                {task && (
                  <motion.div key={task} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-3 rounded-xl border border-line bg-ink p-3">
                    <p className="text-[13px] leading-relaxed text-platinum">{TASKS.find((t) => t.id === task)!.question}</p>
                    <div className="mt-3 font-mono text-[10px] tracking-widest text-dim uppercase">What to compare</div>
                    <ul className="mt-1.5 space-y-1">
                      {TASKS.find((t) => t.id === task)!.evidence.map((e) => (
                        <li key={e} className="flex items-center gap-2 text-[12px] text-chrome">
                          <ChevronRight size={12} className="text-flare" /> {e}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            <Section title={`${BODIES.find((b) => b.id === body)!.label} map layers`}>
              <div className="space-y-2">
                {LAYERS_BY_BODY[body]
                  .filter((l) => !l.overlay)
                  .map((l) => (
                    <LayerCard
                      key={l.id}
                      layer={l}
                      on={view === "2d" && layerId === l.id}
                      onClick={() => {
                        setLayerByBody((s) => ({ ...s, [body]: l.id }));
                        setView("2d");
                      }}
                    />
                  ))}
                {body === "earth" && (
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-line-2 px-3 py-2.5">
                    <span>
                      <span className="block text-[13px] text-platinum">+ Land surface temperature</span>
                      <span className="block text-[11px] text-dim">Terra MODIS overlay · 2D only</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={lst}
                      onChange={(e) => {
                        setLst(e.target.checked);
                        if (e.target.checked) setView("2d");
                      }}
                      className="size-4 accent-[#edeae4]"
                    />
                  </label>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-dim">The 3D globe uses a NASA mosaic; a layer opens the live 2D tile map.</p>
            </Section>

            {body === "earth" && (
              <Section title="Regions we checked">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
                  <input type="checkbox" checked={showScreening} onChange={(e) => setShowScreening(e.target.checked)} className="mt-0.5 size-4 accent-[#a197cf]" />
                  <span>
                    <span className="block text-[13px] text-platinum">Show the regions we checked</span>
                    <span className="block text-[11px] leading-relaxed text-dim">{SCREENING_REGIONS.length} regions we picked by hand, now measured with the global data. For the whole planet, use Find new sites.</span>
                  </span>
                </label>
              </Section>
            )}
          </div>
        </Panel>

        {/* ------------------------------------------------ right panel */}
        <Panel side="right" open={panels.right} onToggle={() => setPanels((p) => ({ ...p, right: !p.right }))} label="Places">
          <AnimatePresence mode="wait">
            <motion.div key={spot && body !== "earth" ? `spot:${spot.lat.toFixed(2)},${spot.lon.toFixed(2)}` : sel ? `${sel.kind}:${sel.id}` : `none-${body}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.28, ease: EASE }}>
              {spot && body !== "earth" && (
                <SpotTwins
                  body={body}
                  spot={spot}
                  onClose={() => setSpot(null)}
                  onEarth={(lat, lon) => {
                    setBody("earth");
                    setSel(null);
                    setView("3d");
                    setEarthFocus({ lat, lon });
                  }}
                />
              )}
              {!sel && !(spot && body !== "earth") && <Overview body={body} world={world} task={task} onEarth={goEarth} onTarget={goTarget} />}
              {sel?.kind === "earth" && <EarthDetail id={sel.id} world={world} onTarget={goTarget} onClose={() => setSel(null)} />}
              {sel?.kind === "target" && <TargetDetail id={sel.id} onEarth={goEarth} onClose={() => setSel(null)} />}
              {sel?.kind === "screen" && <ScreenDetail id={sel.id} onClose={() => setSel(null)} />}
            </motion.div>
          </AnimatePresence>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- twins */

function SpotTwins({ body, spot, onClose, onEarth }: { body: "moon" | "mars"; spot: { lat: number; lon: number }; onClose: () => void; onEarth: (lat: number, lon: number) => void }) {
  const { grid, progress } = useGrid();
  const [terrain, setTerrain] = useState<SpotTerrain | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setTerrain(null);
    setFailed(false);
    spotTerrain(body, spot.lat, spot.lon)
      .then((t) => alive && setTerrain(t))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [body, spot.lat, spot.lon]);
  const [mode, setMode] = useState<TwinMode>("like");
  const formulaTwins = useMemo(() => (grid && terrain && mode !== "ai" ? findTwins(grid, terrain, 8, mode === "like") : null), [grid, terrain, mode]);
  const [ai, setAi] = useState<{ key: string; list: Candidate[] } | null>(null);
  const aiKey = `${body}|${spot.lat}|${spot.lon}`;
  useEffect(() => {
    if (mode !== "ai" || !grid || ai?.key === aiKey) return;
    let alive = true;
    aiTwins(grid, body, spot.lat, spot.lon, 8)
      .then((list) => alive && setAi({ key: aiKey, list }))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [mode, grid, aiKey, ai?.key, body, spot.lat, spot.lon]);
  const twins = mode === "ai" ? (ai?.key === aiKey ? ai.list : null) : formulaTwins;
  const name = body === "moon" ? "the Moon" : "Mars";
  const short = body === "moon" ? "Moon" : "Mars";
  const modes: { id: TwinMode; label: string }[] = [
    { id: "like", label: `Ground + ${short}-like` },
    { id: "ground", label: "Ground only" },
    { id: "ai", label: "AI match" },
  ];
  return (
    <div className="space-y-6 p-5">
      <PanelHeader eyebrow={`Your spot on ${name}`} title="Earth twins" sub={formatCoord(spot.lat, spot.lon)} onClose={onClose} />
      {terrain ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
          <div className="bg-panel p-3">
            <div className="text-[10.5px] text-dim">Average slope</div>
            <div className="font-mono text-[15px] text-platinum">{terrain.slope.toFixed(1)}°</div>
          </div>
          <div className="bg-panel p-3">
            <div className="text-[10.5px] text-dim">Height range, 50 km</div>
            <div className="font-mono text-[15px] text-platinum">{(terrain.relief / 1000).toFixed(2)} km</div>
          </div>
        </div>
      ) : (
        <div className="shimmer h-[62px] rounded-xl" />
      )}
      <div className="relative grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink p-1 text-[11.5px]">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={clsx("relative rounded-lg px-1 py-1.5 transition-colors", mode === m.id ? "text-platinum" : "text-dim hover:text-chrome")}>
            {mode === m.id && <motion.span layoutId="twin-mode" className="absolute inset-0 rounded-lg bg-platinum/[0.08]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative flex items-center justify-center gap-1">
              {m.id === "ai" && <Sparkles size={11} className="text-flare" />}
              {m.label}
            </span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="text-[12.5px] leading-relaxed text-chrome">
          {mode === "like"
            ? `Places on Earth with the same slopes and height range as this spot, that are also like the places experts use to practise for ${name} (half and half).`
            : mode === "ground"
              ? `Places on Earth whose 50 km of ground has the same slopes and height range as this spot, measured the same way from ${body === "moon" ? "LRO LOLA 118 m" : "MGS MOLA 463 m"} heights.`
              : `Our terrain AI (a vision transformer trained on Kaggle GPUs with heights from all three worlds) compares how the ground looks, not just its numbers. It beat our formula on the known and the independent test sites.`}
        </motion.p>
      </AnimatePresence>
      {failed && <p className="text-[12.5px] text-weak">This spot's data could not be loaded.</p>}
      {!grid && <div className="text-[12px] text-dim">Loading Earth · {Math.round(progress * 100)}%</div>}
      {grid && !twins && !failed && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-[72px] rounded-xl" />
          ))}
        </div>
      )}
      {twins && (
        <ol className="space-y-2">
          {twins.map((c, i) => (
            <TwinRow key={`${mode}-${c.k}`} grid={grid!} c={c} rank={i + 1} ai={mode === "ai"} onShow={() => onEarth(c.lat, c.lon)} />
          ))}
        </ol>
      )}
      <p className="text-[11px] leading-relaxed text-dim">Rocks, cold and light are scored in Find new sites for the 18 named targets.</p>
    </div>
  );
}

function TwinRow({ grid, c, rank, ai = false, onShow }: { grid: Grid; c: Candidate; rank: number; ai?: boolean; onShow: () => void }) {
  const thumb = useEarthThumb(c.lat, c.lon, 160);
  const nm = grid.name(c.k);
  return (
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: rank * 0.04 }}>
      <button onClick={onShow} className="surface lift group flex w-full items-center gap-3 rounded-xl p-2 text-left">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-ink">
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <span className="shimmer block size-full" />}
          <span className="absolute top-0.5 left-0.5 grid size-5 place-items-center rounded-full bg-void/80 font-mono text-[10px] text-platinum">{rank}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-platinum">{nm.title}</span>
          <span className="block truncate text-[11px] text-dim">{nm.subtitle || formatCoord(c.lat, c.lon)}</span>
        </span>
        {ai ? (
          <span className="flex w-12 flex-col items-end gap-1" title="How strongly the AI agrees across the spot and its neighbours">
            <span className="h-1 w-full overflow-hidden rounded-full bg-line-2">
              <span className="block h-full rounded-full bg-flare" style={{ width: `${Math.round(c.score * 100)}%` }} />
            </span>
            <span className="font-mono text-[9.5px] tracking-wider text-dim uppercase">agree</span>
          </span>
        ) : (
          <span className="font-mono text-[13px] text-flare">{c.score.toFixed(2)}</span>
        )}
        <ChevronRight size={14} className="text-dim group-hover:text-platinum" />
      </button>
    </motion.li>
  );
}

/* --------------------------------------------------------------- stage pieces */

const TEX: Record<Body, string> = { earth: "/textures/earth_day_1k.webp", moon: "/textures/moon_lroc_1k.webp", mars: "/textures/mars_viking_1k.webp" };

/** A tiny spinning planet made from the real NASA mosaic. */
function PlanetThumb({ body, on, size = 24 }: { body: Body; on: boolean; size?: number }) {
  return (
    <motion.span
      aria-hidden
      className="relative block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundImage: `url(${TEX[body]})`, backgroundSize: "200% 100%", boxShadow: "inset -6px -2px 8px rgba(0,0,0,0.85), inset 2px 1px 3px rgba(255,255,255,0.12)" }}
      animate={{ backgroundPositionX: on ? ["0%", "-200%"] : "0%", scale: on ? 1.08 : 1, opacity: on ? 1 : 0.65 }}
      transition={{ backgroundPositionX: { duration: 18, repeat: Infinity, ease: "linear" }, scale: { type: "spring", stiffness: 300, damping: 20 }, opacity: { duration: 0.3 } }}
    />
  );
}

const WORLD_FACTS: Record<Body, { kicker: string; line: string }> = {
  earth: { kicker: "Practice ground", line: "38 known analog sites · live NASA GIBS and ESA layers" },
  moon: { kicker: "Destination", line: "10 targets · LRO LOLA 118 m heights · LROC images" },
  mars: { kicker: "Destination", line: "8 targets · MGS MOLA 463 m heights · Viking colour" },
};

function WorldTitle({ body, shown, layer, left }: { body: Body; shown: number; layer: string | null; left: boolean }) {
  const name = BODIES.find((b) => b.id === body)!.label;
  return (
    <div className={clsx("pointer-events-none absolute top-24 z-[550] hidden transition-[left] duration-500 lg:block", left ? "left-[336px]" : "left-8")}>
      <AnimatePresence mode="wait">
        <motion.div key={body} initial="hide" animate="show" exit="hide" variants={{ show: { transition: { staggerChildren: 0.05 } }, hide: {} }}>
          <motion.div variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="font-mono text-[10.5px] tracking-[0.26em] text-chrome uppercase">
            {WORLD_FACTS[body].kicker}
          </motion.div>
          <div className="mt-1 flex overflow-hidden text-[clamp(56px,6.4vw,104px)] leading-[0.9] font-medium tracking-[-0.05em] text-platinum">
            {name.split("").map((ch, i) => (
              <motion.span key={i} variants={{ hide: { y: "100%", opacity: 0 }, show: { y: "0%", opacity: 1 } }} transition={{ duration: 0.7, ease: EASE }}>
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.div variants={{ hide: { opacity: 0 }, show: { opacity: 1 } }} transition={{ delay: 0.3 }} className="mt-2 max-w-[340px] text-[12.5px] leading-relaxed text-chrome">
            {WORLD_FACTS[body].line}
            <span className="block font-mono text-[11px] text-dim">
              {shown} places shown{layer ? ` · ${layer}` : ""}
            </span>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Floating glass panel on wide screens; a normal block below the stage on small ones. */
function Panel({ side, open, onToggle, label, children }: { side: "left" | "right"; open: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
  const left = side === "left";
  return (
    <>
      <aside
        style={{ ["--px" as string]: left ? "-24px" : "24px" }}
        className={clsx(
          "scrollbar-thin relative z-[700] border-line bg-void transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:absolute lg:top-4 lg:bottom-4 lg:overflow-y-auto lg:rounded-3xl lg:border lg:bg-panel/80 lg:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] lg:backdrop-blur-xl",
          left ? "lg:left-4 lg:w-[304px]" : "lg:right-4 lg:w-[384px]",
          !open && "lg:pointer-events-none lg:translate-x-[var(--px)] lg:opacity-0",
        )}
        aria-label={label}
      >
        <button onClick={onToggle} className={clsx("absolute top-3 z-10 hidden size-8 place-items-center rounded-full border border-line-2 bg-void/70 text-chrome hover:text-platinum lg:grid", left ? "right-3" : "left-3")} aria-label={`Hide ${label.toLowerCase()}`}>
          {left ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className={clsx(left ? "lg:pr-8" : "lg:pl-8")}>{children}</div>
      </aside>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, x: left ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className={clsx("absolute top-1/2 z-[700] hidden -translate-y-1/2 items-center gap-2 rounded-full border border-line-2 bg-void/80 px-3 py-2 text-[12px] text-chrome backdrop-blur-xl hover:text-platinum lg:flex", left ? "left-4" : "right-4")}
          >
            {left ? <ChevronRight size={14} /> : <ChevronLeft size={14} />} {label}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

function previewUrl(l: (typeof LAYERS)[number]) {
  if (l.projection === "polar-south") return l.url;
  const merc = l.projection === "mercator";
  return l.url
    .replace("{z}", merc ? "2" : "1")
    .replace("{x}", merc ? "2" : "1")
    .replace("{y}", merc ? "1" : "0");
}

function LayerCard({ layer: l, on, onClick }: { layer: (typeof LAYERS)[number]; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={clsx("group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors duration-150", on ? "border-flare/50 bg-flare/[0.06]" : "border-line hover:border-line-2")}>
      <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-ink">
        <span className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${previewUrl(l)})` }} />
        {on && <span className="absolute inset-0 rounded-lg ring-2 ring-flare/70 ring-inset" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[12.5px] text-platinum">{l.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-dim">{l.resolution}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-dim">{l.instrument}</span>
      </span>
    </button>
  );
}

/* --------------------------------------------------------------- pieces */

function Section({ title, children, hint, onHint }: { title: string; children: React.ReactNode; hint?: string; onHint?: () => void }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
        <span>{title}</span>
        {hint && (
          <button onClick={onHint} className="normal-case tracking-normal text-chrome hover:text-platinum">
            {hint}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ViewBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-colors duration-150",
        on ? "bg-platinum text-void" : "text-chrome hover:text-platinum",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Key({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("size-2.5 rounded-full", dashed && "border border-dashed")} style={dashed ? { borderColor: color } : { background: color }} />
      {label}
    </span>
  );
}

function StageLoading() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex items-center gap-3 font-mono text-[11px] tracking-widest text-chrome uppercase">
        <span className="size-2 animate-ping rounded-full bg-earth" /> Loading NASA mosaic
      </div>
    </div>
  );
}

function PanelHeader({ eyebrow, title, sub, onClose }: { eyebrow: string; title: string; sub: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">{eyebrow}</div>
        <h2 className="mt-1.5 text-2xl leading-tight font-medium tracking-tight">{title}</h2>
        <div className="mt-1 font-mono text-[11px] text-chrome tabular">{sub}</div>
      </div>
      <button onClick={onClose} aria-label="Close details" className="rounded-full border border-line-2 p-1.5 text-chrome hover:text-platinum">
        <X size={14} />
      </button>
    </div>
  );
}

function Overview({
  body,
  world,
  task,
  onEarth,
  onTarget,
}: {
  body: Body;
  world: WorldFilter;
  task: TaskId | null;
  onEarth: (id: string) => void;
  onTarget: (id: string) => void;
}) {
  const earth = EARTH_SITES.filter((s) => (world === "both" || s.worlds.includes(world)) && (!task || s.tasks.includes(task)));
  const targets = TARGETS.filter((t) => (world === "both" || t.body === world) && (!task || t.tasks.includes(task)));
  return (
    <div className="p-5">
      <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Overview</div>
      <h2 className="mt-1.5 text-2xl leading-tight font-medium tracking-tight">
        {task ? TASKS.find((t) => t.id === task)!.label : "All jobs"}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-chrome">
        Select a pin on the {body === "earth" ? "Earth" : body === "moon" ? "Moon" : "Mars"} {""}globe, or pick from the lists below.
      </p>

      <div className="mt-6 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Targets · {targets.length}</div>
      <ul className="mt-2 border-t border-line">
        {targets.map((t) => (
          <li key={t.id}>
            <button onClick={() => onTarget(t.id)} className="group flex w-full items-center justify-between gap-3 border-b border-line py-2.5 text-left">
              <span className="flex items-center gap-2.5 text-[13px] text-platinum">
                <WorldDot world={t.body} /> {t.name}
              </span>
              <span className="text-[11px] text-dim group-hover:text-chrome">{t.kind}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Earth reference analogs · {earth.length}</div>
      <ul className="mt-2 border-t border-line">
        {earth.map((s) => (
          <li key={s.id}>
            <button onClick={() => onEarth(s.id)} className="group flex w-full items-center gap-3 border-b border-line py-2 text-left">
              <img src={`/thumbs/${s.id}.webp`} alt="" className="h-9 w-12 rounded-md object-cover" loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-platinum">{s.name}</span>
                <span className="block text-[11px] text-dim">{s.country}</span>
              </span>
              <ChevronRight size={14} className="text-dim group-hover:text-platinum" />
            </button>
          </li>
        ))}
        {earth.length === 0 && <li className="py-4 text-[13px] text-dim">No known test site for this combination yet. Try Find new sites.</li>}
      </ul>
    </div>
  );
}

function EarthDetail({ id, world, onTarget, onClose }: { id: string; world: WorldFilter; onTarget: (id: string) => void; onClose: () => void }) {
  const s = EARTH_BY_ID[id];
  const gapsWorld: World = world === "both" ? s.worlds[0] : world;
  return (
    <div>
      <div className="relative h-48 overflow-hidden">
        <img src={`/thumbs/${s.id}.webp`} alt={`NASA Blue Marble regional view around ${s.name}`} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent" />
        <span className="absolute right-3 bottom-3 rounded-full bg-void/70 px-2 py-0.5 font-mono text-[10px] text-chrome backdrop-blur">
          NASA Blue Marble · 500 m
        </span>
      </div>
      <div className="space-y-7 p-5">
        <PanelHeader eyebrow={`Reference analog · ${s.country}`} title={s.name} sub={formatCoord(s.lat, s.lon)} onClose={onClose} />
        <div className="flex flex-wrap gap-1.5">
          {s.worlds.map((w) => (
            <span key={w} className="flex items-center gap-1.5 rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-chrome capitalize">
              <WorldDot world={w} /> {w} analog
            </span>
          ))}
        </div>
        <p className="text-[14px] leading-relaxed text-platinum">{s.summary}</p>
        <p className="text-[12px] leading-relaxed text-dim">
          <span className="text-chrome">History: </span>
          {s.heritage}
        </p>

        <div>
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">What it is like</div>
            <span className="rounded-full border border-dashed border-line-2 px-2 py-0.5 text-[10px] text-dim">prototype · literature-based</span>
          </div>
          <ul className="mt-2 border-t border-line">
            {FIT_KEYS.map((k) => (
              <li key={k.key} className="flex items-center justify-between border-b border-line py-2.5 text-[13px]">
                <span className="text-chrome">{k.label}</span>
                <FitBadge fit={s.fit[k.key]} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Practises for</div>
          <div className="mt-2 grid gap-1.5">
            {s.pairs.map((p) => {
              const t = TARGET_BY_ID[p];
              return (
                <button
                  key={p}
                  onClick={() => onTarget(p)}
                  className="group flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-line-2"
                >
                  <span className="flex items-center gap-2.5">
                    <WorldDot world={t.body} />
                    <span>
                      <span className="block text-[13px] text-platinum">{t.name}</span>
                      <span className="block text-[11px] text-dim">{t.kind}</span>
                    </span>
                  </span>
                  <ArrowRight size={14} className="text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-platinum" />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Earth can't copy</div>
          <ul className="mt-2 space-y-1.5">
            {s.gaps.map((g) => (
              <li key={g} className="flex gap-2 text-[13px] text-chrome">
                <span className="text-weak">✕</span> {g}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {REALITY_GAPS[gapsWorld].map((g) => (
              <span key={g} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-dim">
                {g}
              </span>
            ))}
          </div>
        </div>

        <Link
          to={`/lab?earth=${s.id}&target=${s.pairs[0]}`}
          className="flex items-center justify-center gap-2 rounded-full bg-platinum py-3 text-sm font-medium text-void transition-transform hover:bg-white active:scale-[0.99]"
        >
          Compare in 3D <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function TargetDetail({ id, onEarth, onClose }: { id: string; onEarth: (id: string) => void; onClose: () => void }) {
  const t = TARGET_BY_ID[id];
  const grounds = EARTH_SITES.filter((s) => s.pairs.includes(t.id));
  return (
    <div className="space-y-7 p-5">
      <PanelHeader eyebrow={`${t.body === "moon" ? "Moon" : "Mars"} · ${t.region}`} title={t.name} sub={formatCoord(t.lat, t.lon)} onClose={onClose} />
      <span className="inline-flex items-center gap-2 rounded-full border border-earth/40 bg-earth/10 px-3 py-1 text-[12px] text-earth">
        <WorldDot world={t.body} /> {t.kind}
      </span>
      <p className="text-[14px] leading-relaxed text-platinum">{t.why}</p>
      <div className="flex flex-wrap gap-1.5">
        {t.tasks.map((k) => (
          <span key={k} className="rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-chrome">
            {TASKS.find((x) => x.id === k)!.label}
          </span>
        ))}
      </div>
      <div className="text-[12px] text-dim">
        <span className="text-chrome">Source: </span>
        {t.source}
      </div>

      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Earth practice sites · {grounds.length}</div>
        <div className="mt-2 grid gap-1.5">
          {grounds.map((s) => (
            <button key={s.id} onClick={() => onEarth(s.id)} className="group flex items-center gap-3 rounded-xl border border-line p-2 text-left hover:border-line-2">
              <img src={`/thumbs/${s.id}.webp`} alt="" className="h-11 w-16 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-platinum">{s.name}</span>
                <span className="block text-[11px] text-dim">{s.country}</span>
              </span>
              <ArrowRight size={14} className="mr-1 text-dim group-hover:text-platinum" />
            </button>
          ))}
          {grounds.length === 0 && (
            <Link to={`/discover?target=${t.id}&task=${t.tasks[0]}`} className="block rounded-xl border border-dashed border-line-2 p-4 text-[13px] text-chrome hover:border-flare/50 hover:text-platinum">
              No known Earth site yet. Find new ones on the global map <ArrowRight size={12} className="inline" />
            </Link>
          )}
        </div>
      </div>

      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Earth can't copy</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REALITY_GAPS[t.body].map((g) => (
            <span key={g} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-dim">
              {g}
            </span>
          ))}
        </div>
      </div>

      {grounds[0] && (
        <Link
          to={`/lab?earth=${grounds[0].id}&target=${t.id}`}
          className="btn-primary flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium"
        >
          Compare with {grounds[0].name.split(",")[0]} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

function ScreenDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const r = SCREENING_REGIONS.find((x) => x.id === id)!;
  const { grid, progress } = useGrid();
  const k = grid ? grid.cellAt(r.lat, r.lon, 3) : -1;
  const v = (n: string) => (grid && k >= 0 ? grid.value(n, k) : null);
  const moon = grid && k >= 0 ? grid.model("moon", k) : null;
  const mars = grid && k >= 0 ? grid.model("mars", k) : null;
  const top = (x: number | null) => (x === null ? "…" : `top ${Math.max(1, Math.round((1 - x) * 100))}%`);
  const facts: [string, number | null, string][] = [
    ["Height range", v("f_relief"), " m"],
    ["Coldest night", v("f_lst_night_min"), " °C"],
    ["Hottest ground", v("f_lst_day_max"), " °C"],
    ["Rain a year", v("f_precip"), " mm"],
  ];
  const volc = grid && k >= 0 ? grid.volcano(k) : null;
  return (
    <div>
      <div className="relative h-44 overflow-hidden">
        <img src={`/thumbs/${r.id}.webp`} alt={`NASA Blue Marble regional view around ${r.name}`} className="size-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent" />
      </div>
      <div className="space-y-7 p-5">
        <PanelHeader eyebrow={`Region we checked · ${r.country}`} title={r.name} sub={formatCoord(r.lat, r.lon)} onClose={onClose} />
        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Our idea</div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-platinum">{r.hypothesis}</p>
          <p className="mt-1 text-[12px] text-dim">{r.terrain}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
            <Radar size={12} className="text-amethyst" /> What the data says
          </div>
          {grid ? (
            <div className="mt-3 space-y-3">
              <Meter value={moon} label="Moon-like" kind="model" right={top(moon)} tone="var(--color-moon)" />
              <Meter value={mars} label="Mars-like" kind="model" right={top(mars)} tone="var(--color-mars)" />
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
                {facts.map(([a, b, u]) => (
                  <div key={a} className="bg-panel p-2.5">
                    <div className="text-[10.5px] text-dim">{a}</div>
                    <div className="font-mono text-[13px] text-platinum">{b === null ? "n/a" : `${Math.round(b)}${u}`}</div>
                  </div>
                ))}
              </div>
              {volc && volc.km < 150 && <p className="text-[12px] text-chrome">Nearest volcano: {volc.name}, {Math.round(volc.km)} km.</p>}
            </div>
          ) : (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-flare transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
          )}
        </div>
        <Link
          to={`/discover?target=${r.worlds[0] === "moon" ? "shackleton" : "jezero"}&task=${r.worlds[0] === "moon" ? "base" : "traverse"}&at=${r.lat.toFixed(2)},${r.lon.toFixed(2)}`}
          className="btn-primary flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium"
        >
          Open the full report <ArrowRight size={15} />
        </Link>
        <Link to="/methods" className="inline-flex items-center gap-1.5 text-sm text-chrome hover:text-platinum">
          How places are measured <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  );
}
