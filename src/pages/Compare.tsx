import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { CircleDashed, Columns2, Link2, Link2Off, SplitSquareHorizontal } from "lucide-react";
import { Nav, FitBadge, WorldDot, WORLD_COLOR } from "../components/ui/Chrome";
import { BodyMap, type BodyMapHandle, type MapView } from "../components/map/BodyMap";
import { EARTH_BY_ID, EARTH_SITES, FIT_KEYS, REALITY_GAPS, TARGETS, TARGET_BY_ID, TASKS } from "../data/sites";
import { LAYERS_BY_BODY } from "../data/layers";
import { formatCoord } from "../lib/geo";

const GlobeView = lazy(() => import("../components/three/GlobeView"));

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const [earthId, setEarthId] = useState(() => (EARTH_BY_ID[params.get("earth") ?? ""] ? params.get("earth")! : "haughton"));
  const [targetId, setTargetId] = useState(() => (TARGET_BY_ID[params.get("target") ?? ""] ? params.get("target")! : "jezero"));
  const [mode, setMode] = useState<"split" | "swipe">("split");
  const [locked, setLocked] = useState(true);
  const [swipe, setSwipe] = useState(0.5);
  const earth = EARTH_BY_ID[earthId];
  const target = TARGET_BY_ID[targetId];
  const polar = target.body === "moon" && target.lat < -80;

  const targetLayers = LAYERS_BY_BODY[target.body].filter((l) => (polar ? true : l.projection !== "polar-south"));
  const [earthLayer, setEarthLayer] = useState("earth-aster");
  const [targetLayer, setTargetLayer] = useState(polar ? "moon-south-pole" : LAYERS_BY_BODY[target.body][0].id);
  useEffect(() => {
    setTargetLayer(polar ? "moon-south-pole" : target.body === "moon" ? "moon-lola-shade" : "mars-viking");
  }, [targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setParams({ earth: earthId, target: targetId }, { replace: true });
  }, [earthId, targetId, setParams]);

  const eRef = useRef<BodyMapHandle>(null);
  const tRef = useRef<BodyMapHandle>(null);
  const [eView, setEView] = useState<MapView | null>(null);
  const [tView, setTView] = useState<MapView | null>(null);

  const onEarthView = useCallback(
    (v: MapView) => {
      setEView(v);
      if (locked) tRef.current?.setMetresPerPixel(v.metresPerPixel);
    },
    [locked],
  );
  const onTargetView = useCallback(
    (v: MapView) => {
      setTView(v);
      if (locked) eRef.current?.setMetresPerPixel(v.metresPerPixel);
    },
    [locked],
  );

  // Recentre both maps whenever the pair changes.
  useEffect(() => {
    const t = setTimeout(() => {
      eRef.current?.flyTo(earth.lat, earth.lon, 7);
      tRef.current?.flyTo(target.lat, target.lon, polar ? 1.2 : 5);
    }, 120);
    return () => clearTimeout(t);
  }, [earthId, targetId, targetLayer, earthLayer, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sharedTasks = TASKS.filter((t) => earth.tasks.includes(t.id) && target.tasks.includes(t.id));
  const pairedTargets = useMemo(() => [...earth.pairs.map((p) => TARGET_BY_ID[p]), ...TARGETS.filter((t) => !earth.pairs.includes(t.id))], [earth]);

  const earthMap = (
    <BodyMap
      ref={eRef}
      body="earth"
      layerId={earthLayer}
      markers={[{ id: earth.id, lat: earth.lat, lon: earth.lon, color: WORLD_COLOR.earth, label: earth.name }]}
      activeId={earth.id}
      onViewChange={onEarthView}
      initial={{ lat: earth.lat, lon: earth.lon, zoom: 7 }}
    />
  );
  const targetMap = (
    <BodyMap
      ref={tRef}
      body={target.body}
      layerId={targetLayer}
      markers={[{ id: target.id, lat: target.lat, lon: target.lon, color: target.body === "moon" ? "#75bbff" : "#ffd2b0", label: target.name }]}
      activeId={target.id}
      onViewChange={onTargetView}
      initial={{ lat: target.lat, lon: target.lon, zoom: 5 }}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-void lg:h-dvh">
      <Nav />
      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <PairSelect
              label="Earth"
              world="earth"
              value={earthId}
              onChange={setEarthId}
              options={EARTH_SITES.map((s) => ({ id: s.id, label: `${s.name} — ${s.country}` }))}
            />
            <span className="font-mono text-[11px] text-dim">rehearses</span>
            <PairSelect
              label={target.body === "moon" ? "Moon" : "Mars"}
              world={target.body}
              value={targetId}
              onChange={setTargetId}
              options={pairedTargets.map((t) => ({
                id: t.id,
                label: `${earth.pairs.includes(t.id) ? "★ " : ""}${t.name} (${t.body === "moon" ? "Moon" : "Mars"})`,
              }))}
            />
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-1 rounded-full border border-line bg-ink p-1">
                <ModeBtn on={mode === "split"} onClick={() => setMode("split")} icon={<Columns2 size={14} />} label="Side by side" />
                <ModeBtn on={mode === "swipe"} onClick={() => setMode("swipe")} icon={<SplitSquareHorizontal size={14} />} label="Swipe" />
              </div>
              <button
                onClick={() => setLocked((l) => !l)}
                aria-pressed={locked}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] transition-colors",
                  locked ? "border-earth/60 bg-earth/10 text-earth" : "border-line-2 text-chrome",
                )}
              >
                {locked ? <Link2 size={14} /> : <Link2Off size={14} />} Matched scale
              </button>
            </div>
          </div>

          {/* stage */}
          {mode === "split" ? (
            <div className="grid min-h-0 flex-1 md:grid-cols-2">
              <MapPane title={earth.name} world="earth" coord={formatCoord(earth.lat, earth.lon)} layer={earthLayer} onLayer={setEarthLayer} layers={LAYERS_BY_BODY.earth.filter((l) => !l.overlay)}>
                {earthMap}
              </MapPane>
              <MapPane title={target.name} world={target.body} coord={formatCoord(target.lat, target.lon)} layer={targetLayer} onLayer={setTargetLayer} layers={targetLayers} border>
                {targetMap}
              </MapPane>
            </div>
          ) : (
            <SwipeStage
              value={swipe}
              onChange={setSwipe}
              left={earthMap}
              right={targetMap}
              leftLabel={earth.name}
              rightLabel={target.name}
              rightWorld={target.body}
            />
          )}
        </div>

        {/* evidence panel */}
        <aside className="scrollbar-thin space-y-7 border-line p-5 lg:overflow-y-auto lg:border-l">
          <div className="grid grid-cols-2 gap-2">
            <MiniGlobe body="earth" lat={earth.lat} lon={earth.lon} id={earth.id} label={earth.name} />
            <MiniGlobe body={target.body} lat={target.lat} lon={target.lon} id={target.id} label={target.name} />
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Scale check</div>
            <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              <ScaleCell world="earth" v={eView} />
              <ScaleCell world={target.body} v={tView} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-dim">
              {locked
                ? "Locked: both maps show the same metres per pixel, computed with each body's own radius."
                : "Unlocked: scales differ — comparisons of relief are not valid."}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">{earth.name.split(",")[0]} characterization</div>
              <span className="text-[10px] text-dim">prototype</span>
            </div>
            <ul className="mt-2 border-t border-line">
              {FIT_KEYS.map((k) => (
                <li key={k.key} className="flex items-center justify-between border-b border-line py-2 text-[13px]">
                  <span className="text-chrome">{k.label}</span>
                  <FitBadge fit={earth.fit[k.key]} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Shared rehearsal tasks</div>
            {sharedTasks.length ? (
              <div className="mt-2 space-y-2">
                {sharedTasks.map((t) => (
                  <div key={t.id} className="rounded-xl border border-line p-3">
                    <div className="text-[13px] text-platinum">{t.label}</div>
                    <ul className="mt-2 space-y-1">
                      {t.evidence.map((e) => (
                        <li key={e} className="flex items-center justify-between text-[12px]">
                          <span className="text-chrome">{e}</span>
                          <span className="flex items-center gap-1 text-[10px] text-dim">
                            <CircleDashed size={11} /> to measure
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-line-2 p-3 text-[13px] text-chrome">
                These two places share no catalogued task. A visual match alone is not a rehearsal.
              </p>
            )}
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">What Earth cannot reproduce</div>
            <ul className="mt-2 space-y-1.5">
              {[...earth.gaps, ...REALITY_GAPS[target.body]].map((g) => (
                <li key={g} className="flex gap-2 text-[13px] text-chrome">
                  <span className="text-weak">✕</span> {g}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

function PairSelect({
  label,
  world,
  value,
  onChange,
  options,
}: {
  label: string;
  world: "earth" | "moon" | "mars";
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-line-2 bg-ink py-1 pr-1 pl-3">
      <WorldDot world={world} />
      <span className="font-mono text-[10px] tracking-widest text-dim uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[240px] cursor-pointer rounded-full bg-transparent py-1.5 pr-2 text-[13px] text-platinum outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-panel">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors", on ? "bg-platinum text-void" : "text-chrome hover:text-platinum")}
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MapPane({
  title,
  world,
  coord,
  layer,
  onLayer,
  layers,
  children,
  border,
}: {
  title: string;
  world: "earth" | "moon" | "mars";
  coord: string;
  layer: string;
  onLayer: (id: string) => void;
  layers: { id: string; name: string }[];
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={clsx("relative h-[48vh] min-h-[340px] md:h-auto", border && "border-t border-line md:border-t-0 md:border-l")}>
      {children}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-start justify-between gap-2 p-3">
        <div className="panel pointer-events-auto rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <WorldDot world={world} /> {title}
          </div>
          <div className="font-mono text-[10px] text-dim tabular">{coord}</div>
        </div>
        <select
          value={layer}
          onChange={(e) => onLayer(e.target.value)}
          className="panel pointer-events-auto max-w-[190px] cursor-pointer rounded-full px-3 py-1.5 text-[12px] text-platinum outline-none"
          aria-label={`${title} map layer`}
        >
          {layers.map((l) => (
            <option key={l.id} value={l.id} className="bg-panel">
              {l.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SwipeStage({
  value,
  onChange,
  left,
  right,
  leftLabel,
  rightLabel,
  rightWorld,
}: {
  value: number;
  onChange: (v: number) => void;
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
  rightWorld: "moon" | "mars";
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    onChange(Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width)));
  };
  return (
    <div
      ref={box}
      className="relative h-[70vh] min-h-[420px] flex-1 overflow-hidden lg:h-auto"
      onPointerMove={(e) => drag.current && move(e.clientX)}
      onPointerUp={() => (drag.current = false)}
      onPointerLeave={() => (drag.current = false)}
    >
      <div className="absolute inset-0">{right}</div>
      <div className="absolute inset-0 z-[400]" style={{ clipPath: `inset(0 ${(1 - value) * 100}% 0 0)` }}>
        {left}
      </div>
      <div className="absolute inset-y-0 z-[700] w-px bg-platinum/80" style={{ left: `${value * 100}%` }}>
        <button
          aria-label="Drag to compare"
          role="slider"
          aria-valuenow={Math.round(value * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            drag.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => drag.current && move(e.clientX)}
          onPointerUp={() => (drag.current = false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") onChange(Math.max(0.03, value - 0.05));
            if (e.key === "ArrowRight") onChange(Math.min(0.97, value + 0.05));
          }}
          className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-platinum/80 bg-void/80 text-platinum backdrop-blur"
        >
          ⟷
        </button>
      </div>
      <div className="pointer-events-none absolute top-3 left-3 z-[700] flex items-center gap-2 rounded-full bg-void/75 px-3 py-1.5 text-[12px] backdrop-blur">
        <WorldDot world="earth" /> {leftLabel}
      </div>
      <div className="pointer-events-none absolute top-3 right-3 z-[700] flex items-center gap-2 rounded-full bg-void/75 px-3 py-1.5 text-[12px] backdrop-blur">
        <WorldDot world={rightWorld} /> {rightLabel}
      </div>
    </div>
  );
}

function ScaleCell({ world, v }: { world: "earth" | "moon" | "mars"; v: MapView | null }) {
  return (
    <div className="bg-panel p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-dim capitalize">
        <WorldDot world={world} /> {world}
      </div>
      <div className="mt-1 font-mono text-[15px] text-platinum tabular">
        {v ? (v.metresPerPixel >= 1000 ? `${(v.metresPerPixel / 1000).toFixed(2)} km` : `${v.metresPerPixel.toFixed(0)} m`) : "—"}
        <span className="text-[11px] text-dim"> /px</span>
      </div>
    </div>
  );
}

function MiniGlobe({ body, lat, lon, id }: { body: "earth" | "moon" | "mars"; lat: number; lon: number; id: string; label?: string }) {
  const markers = useMemo(() => [{ id, lat, lon, color: body === "earth" ? "#75bbff" : "#ffffff" }], [id, lat, lon, body]);
  const focus = useMemo(() => ({ lat, lon }), [lat, lon]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-void">
      <Suspense fallback={null}>
        <GlobeView body={body} markers={markers} activeId={id} onSelect={() => {}} focus={focus} />
      </Suspense>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-void to-transparent p-2 text-[10px] font-mono tracking-widest text-chrome uppercase">
        {body} · 3D
      </div>
    </div>
  );
}
