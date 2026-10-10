import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Box, ChevronRight, CircleDashed, ExternalLink, Layers, Map as MapIcon, Radar, X } from "lucide-react";
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
  const [view, setView] = useState<"3d" | "2d">(() => (params.get("layer") ? "2d" : "3d"));
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

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("body", body);
    if (view === "2d") next.set("layer", layerByBody[body]);
    if (sel?.kind === "earth") next.set("site", sel.id);
    setParams(next, { replace: true });
  }, [body, view, layerByBody, sel, setParams]);

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
  const focus = selected && selectedBody === body ? { lat: selected.lat, lon: selected.lon } : null;

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
            label: `${r.name} · queued`,
            dashed: true,
            dim: world !== "both" && !r.worlds.includes(world),
          });
    } else {
      for (const t of TARGETS.filter((t) => t.body === body))
        out.push({ id: t.id, lat: t.lat, lon: t.lon, color: "#edeae4", label: t.name, dim: !matchTarget(t) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, world, task, showScreening]);

  const onSelect = (id: string) => {
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

  return (
    <div className="flex min-h-dvh flex-col bg-void lg:h-dvh">
      <Nav />
      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_380px]">
        {/* ------------------------------------------------ left rail */}
        <aside className="scrollbar-thin order-2 border-line lg:order-1 lg:overflow-y-auto lg:border-r">
          <div className="space-y-8 p-5">
            <Section title="Rehearsing for">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink p-1">
                {(["moon", "both", "mars"] as WorldFilter[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWorld(w)}
                    className={clsx(
                      "flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] capitalize transition-colors duration-150",
                      world === w ? "bg-white/[0.08] text-platinum" : "text-dim hover:text-chrome",
                    )}
                  >
                    {w !== "both" && <WorldDot world={w} />}
                    {w}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Mission task" hint={task ? "clear" : undefined} onHint={() => setTask(null)}>
              <div className="flex flex-wrap gap-1.5">
                {TASKS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTask((cur) => (cur === t.id ? null : t.id))}
                    title={t.question}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-[12px] transition-colors duration-150",
                      task === t.id ? "border-earth bg-earth/15 text-platinum" : "border-line-2 text-chrome hover:border-chrome",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                {task && (
                  <motion.div
                    key={task}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 rounded-xl border border-line bg-ink p-3"
                  >
                    <p className="text-[13px] leading-relaxed text-platinum">{TASKS.find((t) => t.id === task)!.question}</p>
                    <div className="mt-3 font-mono text-[10px] tracking-widest text-dim uppercase">Evidence that matters</div>
                    <ul className="mt-1.5 space-y-1">
                      {TASKS.find((t) => t.id === task)!.evidence.map((e) => (
                        <li key={e} className="flex items-center gap-2 text-[12px] text-chrome">
                          <ChevronRight size={12} className="text-earth" /> {e}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            <Section title={`${BODIES.find((b) => b.id === body)!.label} map layers`}>
              <div className="space-y-1.5">
                {LAYERS_BY_BODY[body]
                  .filter((l) => !l.overlay)
                  .map((l) => {
                    const on = view === "2d" && layerId === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => {
                          setLayerByBody((s) => ({ ...s, [body]: l.id }));
                          setView("2d");
                        }}
                        className={clsx(
                          "w-full rounded-xl border px-3 py-2.5 text-left transition-colors duration-150",
                          on ? "border-earth/60 bg-earth/[0.08]" : "border-line hover:border-line-2",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] text-platinum">{l.name}</span>
                          <span className="font-mono text-[10px] text-dim">{l.resolution}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-dim">{l.instrument}</div>
                      </button>
                    );
                  })}
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
              <p className="mt-3 text-[11px] leading-relaxed text-dim">
                The 3D globe uses a 4K NASA mosaic; choosing a layer opens the live 2D tile map.
              </p>
            </Section>

            {body === "earth" && (
              <Section title="New-analog screening">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
                  <input
                    type="checkbox"
                    checked={showScreening}
                    onChange={(e) => setShowScreening(e.target.checked)}
                    className="mt-0.5 size-4 accent-[#a197cf]"
                  />
                  <span>
                    <span className="block text-[13px] text-platinum">Show queued search regions</span>
                    <span className="block text-[11px] leading-relaxed text-dim">
                      {SCREENING_REGIONS.length} regions selected for screening at the hackathon. Not yet analysed.
                    </span>
                  </span>
                </label>
              </Section>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------ stage */}
        <main className="relative order-1 h-[62vh] min-h-[420px] overflow-hidden border-b border-line lg:order-2 lg:h-auto lg:border-b-0">
          {view === "3d" ? (
            <Suspense fallback={<StageLoading />}>
              <GlobeView body={body} markers={markers} activeId={sel?.id ?? null} onSelect={onSelect} focus={focus} />
            </Suspense>
          ) : (
            <BodyMap
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

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="pointer-events-auto flex gap-1 rounded-full border border-line bg-void/75 p-1 backdrop-blur-xl">
              {BODIES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBody(b.id)}
                  className={clsx(
                    "flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] transition-colors duration-150",
                    body === b.id ? "bg-white/[0.1] text-platinum" : "text-dim hover:text-chrome",
                  )}
                >
                  <WorldDot world={b.id} /> {b.label}
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex gap-1 rounded-full border border-line bg-void/75 p-1 backdrop-blur-xl">
              <ViewBtn on={view === "3d"} onClick={() => setView("3d")} icon={<Box size={14} />} label="3D globe" />
              <ViewBtn on={view === "2d"} onClick={() => setView("2d")} icon={<MapIcon size={14} />} label="2D map" />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-16 left-4 z-[600] hidden md:block">
            <Astronaut
              size={76}
              mood={sel ? "happy" : task ? "focused" : "thinking"}
              action={sel ? "sample" : task ? "scan" : "idle"}
              say={sel ? null : task ? "Dim pins don't fit this task." : "Pick a pin, or choose a mission task."}
            />
          </div>
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-[600] hidden -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-full border border-line bg-void/75 px-4 py-2 text-[11px] text-chrome backdrop-blur-xl md:flex">
            {body === "earth" ? (
              <>
                <Key color={WORLD_COLOR.moon} label="Moon analog" />
                <Key color={WORLD_COLOR.mars} label="Mars analog" />
                <Key color={WORLD_COLOR.earth} label="Both" />
                {showScreening && <Key color="#a197cf" label="Queued for screening" dashed />}
              </>
            ) : (
              <Key color="#edeae4" label={body === "moon" ? "Moon base & target regions" : "Mars targets"} />
            )}
            <span className="font-mono text-dim">{visibleCount} shown</span>
          </div>
        </main>

        {/* ------------------------------------------------ detail */}
        <aside className="scrollbar-thin order-3 border-line lg:overflow-y-auto lg:border-l">
          <AnimatePresence mode="wait">
            <motion.div
              key={sel ? `${sel.kind}:${sel.id}` : "none"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {!sel && <Overview body={body} world={world} task={task} onEarth={goEarth} onTarget={goTarget} />}
              {sel?.kind === "earth" && (
                <EarthDetail id={sel.id} world={world} onTarget={goTarget} onClose={() => setSel(null)} />
              )}
              {sel?.kind === "target" && <TargetDetail id={sel.id} onEarth={goEarth} onClose={() => setSel(null)} />}
              {sel?.kind === "screen" && <ScreenDetail id={sel.id} onClose={() => setSel(null)} />}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
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
      <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Atlas overview</div>
      <h2 className="mt-1.5 text-2xl leading-tight font-medium tracking-tight">
        {task ? TASKS.find((t) => t.id === task)!.label : "All mission tasks"}
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
        {earth.length === 0 && <li className="py-4 text-[13px] text-dim">No reference analog for this combination — a gap worth screening.</li>}
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
          <span className="text-chrome">Heritage — </span>
          {s.heritage}
        </p>

        <div>
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Characterization</div>
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
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Rehearses</div>
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
          <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Will not reproduce</div>
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
          Open in Analog Lab <ArrowRight size={15} />
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
        <span className="text-chrome">Source — </span>
        {t.source}
      </div>

      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Earth rehearsal grounds · {grounds.length}</div>
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
            <div className="rounded-xl border border-dashed border-line-2 p-4 text-[13px] text-chrome">
              No catalogued Earth analog yet — this target drives the new-analog screening.
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Reality gaps</div>
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
  const datasets = ["NASADEM / Copernicus DEM — slope & roughness", "HLS (Landsat + Sentinel-2) — surface cover", "EMIT — surface minerals (where covered)", "MODIS LST — thermal regime"];
  return (
    <div>
      <div className="relative h-44 overflow-hidden">
        <img src={`/thumbs/${r.id}.webp`} alt={`NASA Blue Marble regional view around ${r.name}`} className="size-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent" />
      </div>
    <div className="space-y-7 p-5">
      <PanelHeader eyebrow={`Search region · ${r.country}`} title={r.name} sub={formatCoord(r.lat, r.lon)} onClose={onClose} />
      <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-amethyst/60 px-3 py-1 text-[12px] text-amethyst">
        <CircleDashed size={13} /> Queued — not yet screened
      </span>
      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Terrain</div>
        <p className="mt-1.5 text-[14px] text-platinum">{r.terrain}</p>
      </div>
      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Hypothesis to test</div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-platinum">{r.hypothesis}</p>
      </div>
      <div className="flex gap-1.5">
        {r.worlds.map((w) => (
          <span key={w} className="flex items-center gap-1.5 rounded-full border border-line-2 px-2.5 py-1 text-[11px] capitalize text-chrome">
            <WorldDot world={w} /> {w}
          </span>
        ))}
      </div>
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
          <Layers size={12} /> Planned evidence
        </div>
        <ul className="mt-2 border-t border-line">
          {datasets.map((d) => (
            <li key={d} className="border-b border-line py-2 text-[13px] text-chrome">
              {d}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-line bg-ink p-4 text-[12px] leading-relaxed text-dim">
        <Radar size={14} className="mb-2 text-amethyst" />
        No score is shown until the screening pipeline runs on measured data. A region can still come back as{" "}
        <span className="text-chrome">“insufficient evidence”</span>.
      </div>
      <Link to="/methods" className="inline-flex items-center gap-1.5 text-sm text-chrome hover:text-platinum">
        How screening will work <ExternalLink size={13} />
      </Link>
    </div>
    </div>
  );
}
