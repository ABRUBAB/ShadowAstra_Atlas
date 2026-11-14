/**
 * "Run a field test" on the 3D land slices (Compare). A team (rover or walkers) crosses the same
 * route on the Earth block and the target block in sync; Astra calls out the key moments, a live
 * readout shows slope, height and light on both sides, and the run ends with a field log.
 * Logic: lib/fieldtest.ts. Drawing: components/three/TerrainTwins.tsx.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Footprints, Pause, Play, RotateCcw, SkipForward, StepForward, Truck, X } from "lucide-react";
import { Astronaut, type Action, type Mood } from "../ui/Astronaut";
import { WorldDot } from "../ui/Chrome";
import { useMotionReduced } from "../../lib/motionPref";
import { lightTwin, type SunPosition } from "../../lib/sun";
import { MONTHS_LONG } from "../../lib/mission";
import type { TaskId } from "../../data/sites";
import type { TerrainGrid } from "../../lib/terrain";
import type { FieldScene } from "../three/TerrainTwins";
import {
  checkTests,
  closestHour,
  compass,
  earthSun,
  fieldEvents,
  formatHours,
  groupEvents,
  ROVER_KMH,
  runGaps,
  sampleRoute,
  shadowMask,
  SLOPE_LIMITS,
  stopIndexes,
  summarize,
  targetSun,
  travelHours,
  WALK_CLIMB_M_PER_H,
  WALK_KMH,
  type FieldEvent,
  type RoutePoint,
  type RouteSummary,
  type TargetSun,
  type TeamMode,
  type TestCheck,
  type Verdict,
} from "../../lib/fieldtest";

/** Seconds for one run across the block when motion is on. */
const RUN_SECONDS = 24;

export type RunStatus = "ready" | "running" | "paused" | "done";

export interface FieldInput {
  open: boolean;
  earth: TerrainGrid | null;
  target: TerrainGrid | null;
  earthLat: number;
  targetLat: number;
  targetBody: "moon" | "mars";
  task: TaskId;
  snowice: number | null;
  earthName: string;
  targetName: string;
}

/* ===================================================================== state */

export function useFieldTest(inp: FieldInput) {
  const { open, earth, target, earthLat, targetLat, targetBody, task, snowice, earthName, targetName } = inp;
  const reduce = useMotionReduced();

  // start in the month whose light is most like the target's (the Light section's best season),
  // at the hour when Earth's Sun is closest in height to the target's
  const startMonth = useMemo(() => {
    const lt = lightTwin(earthLat, targetBody, targetLat);
    const k = lt.months.findIndex((m) => m.month === lt.best[0]);
    return k >= 0 ? k : new Date().getMonth();
  }, [earthLat, targetBody, targetLat]);
  const [mode, setMode] = useState<TeamMode>("rover");
  const [limit, setLimit] = useState(15);
  const [month, setMonth] = useState(startMonth);
  const [hour, setHour] = useState(() => closestHour(earthLat, targetBody, targetLat, startMonth));
  useEffect(() => {
    setMonth(startMonth);
    setHour(closestHour(earthLat, targetBody, targetLat, startMonth));
  }, [startMonth, earthLat, targetBody, targetLat]);

  const sunE = useMemo(() => earthSun(earthLat, month, hour), [earthLat, month, hour]);
  const sunT = useMemo(() => targetSun(targetBody, targetLat, month, hour), [targetBody, targetLat, month, hour]);
  // shadows take a few milliseconds per block: let the sliders stay responsive
  const dSunE = useDeferredValue(sunE);
  const dSunT = useDeferredValue(sunT);
  const shadeE = useMemo(() => (open && earth ? shadowMask(earth, dSunE) : null), [open, earth, dSunE]);
  const shadeT = useMemo(() => (open && target ? shadowMask(target, dSunT) : null), [open, target, dSunT]);

  const data = useMemo(() => {
    if (!earth || !target || !shadeE || !shadeT) return null;
    const routeE = sampleRoute(earth, shadeE, limit);
    const routeT = sampleRoute(target, shadeT, limit);
    const n = Math.min(routeE.length, routeT.length);
    const night = { earth: dSunE.elev <= 0, target: dSunT.elev <= 0 };
    const events = fieldEvents(routeE, routeT, night);
    return { routeE, routeT, n, night, sumE: summarize(routeE), sumT: summarize(routeT), events, groups: groupEvents(events, n), stops: stopIndexes(events, n), spacingKm: earth.spacingKm, sunE: dSunE, sunT: dSunT };
  }, [earth, target, shadeE, shadeT, limit, dSunE, dSunT]);

  const checks = useMemo(
    () => (data ? checkTests({ task, earth: data.sumE, target: data.sumT, earthSun: data.sunE, targetSun: data.sunT, earthName, targetName, snowice }) : []),
    [data, task, earthName, targetName, snowice],
  );
  const gaps = useMemo(
    () => (data ? runGaps({ body: targetBody, targetLat, targetName, earthName, earth: data.sumE, target: data.sumT, spacingKm: data.spacingKm }) : []),
    [data, targetBody, targetLat, targetName, earthName],
  );

  /* ------------------------------------------------------------- playback */
  const progress = useRef(0);
  const shown = useRef(0);
  const [status, setStatus] = useState<RunStatus>("ready");
  const [index, setIndex] = useState(0);
  const n = data?.n ?? 0;

  const jump = useCallback(
    (k: number) => {
      progress.current = n > 1 ? k / (n - 1) : 0;
      shown.current = k;
      setIndex(k);
    },
    [n],
  );

  // a new route (other settings, place or target) starts over
  useEffect(() => {
    jump(0);
    setStatus("ready");
  }, [data, mode, jump]);

  useEffect(() => {
    if (status !== "running" || n < 2) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      progress.current = Math.min(1, progress.current + dt / RUN_SECONDS);
      const k = Math.round(progress.current * (n - 1));
      if (k !== shown.current) {
        shown.current = k;
        setIndex(k);
      }
      if (progress.current >= 1) {
        setStatus("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, n]);

  // "Pause motion" (or the system setting) stops a moving run; the visitor steps through instead
  useEffect(() => {
    if (reduce && status === "running") setStatus("paused");
  }, [reduce, status]);

  const step = useCallback(() => {
    if (!data) return;
    const from = status === "done" ? 0 : shown.current;
    const next = data.stops.find((s) => s > from) ?? n - 1;
    jump(next);
    setStatus(next >= n - 1 ? "done" : "paused");
  }, [data, status, n, jump]);

  const primary = useCallback(() => {
    if (!data) return;
    if (status === "running") return setStatus("paused");
    if (status === "done" || status === "ready") jump(0);
    if (reduce) {
      if (status === "done") {
        jump(0);
        setStatus("paused");
        return;
      }
      return step();
    }
    setStatus("running");
  }, [data, status, reduce, jump, step]);

  const skip = useCallback(() => {
    if (!data) return;
    jump(n - 1);
    setStatus("done");
  }, [data, n, jump]);

  const reset = useCallback(() => {
    jump(0);
    setStatus("ready");
  }, [jump]);

  const scene = useMemo<FieldScene | null>(
    () => (open && data && shadeE && shadeT ? { progress, mode, earth: { route: data.routeE, shade: shadeE }, target: { route: data.routeT, shade: shadeT } } : null),
    [open, data, shadeE, shadeT, mode],
  );

  return { open, reduce, mode, setMode, limit, setLimit, month, setMonth, hour, setHour, sunE, sunT, data, checks, gaps, status, index, scene, primary, step, skip, reset };
}

export type FieldTest = ReturnType<typeof useFieldTest>;

/* ================================================================= helpers */

const deg = (v: number) => `${v.toFixed(1)}°`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const metres = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString("en-US")} m`;
const km = (v: number) => `${v >= 10 ? Math.round(v) : v.toFixed(1)} km`;
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:00`;

function sunLine(s: SunPosition) {
  return s.elev > 0 ? `Sun ${deg(s.elev)} up, in the ${compass(s.az)}` : `Night: the Sun is ${deg(-s.elev)} below the horizon`;
}

function targetSunLine(s: TargetSun) {
  if (s.grazing) return `Low grazing Sun, ${deg(s.elev)} up (its usual daylight height), now in the ${compass(s.az)}. It circles the sky once a lunar day.`;
  return `${sunLine(s)}. Same season and same time of its own day.`;
}

function Badge() {
  return <span className="rounded-full border border-strong/40 bg-strong/10 px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-strong uppercase">Computed</span>;
}

function Choice<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { id: T; label: React.ReactNode }[] }) {
  return (
    <div role="group" aria-label={label} className="flex w-fit flex-wrap gap-0.5 rounded-full border border-line bg-ink p-0.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={clsx("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-colors duration-200", value === o.id ? "bg-platinum text-void" : "text-chrome hover:text-platinum")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  const cls = "mb-2 block font-mono text-[10px] tracking-[0.2em] text-dim uppercase";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/* ============================================================ live readout */

/** Slope, height and light at the team's position, one per block, shown on the 3D stage. */
export function FieldReadout({ point, limit, night, world, right }: { point: RoutePoint | undefined; limit: number; night: boolean; world: "earth" | "moon" | "mars"; right?: boolean }) {
  if (!point) return null;
  const light = night ? "Night" : point.shadow ? "In shadow" : "Sunlit";
  return (
    <dl className={clsx("grid w-fit grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-1 rounded-xl border border-line-2 bg-void/75 px-3 py-2 backdrop-blur", right && "ml-auto")}>
      <dt className="font-mono text-[9.5px] tracking-[0.18em] text-dim uppercase">Slope</dt>
      <dd className={clsx("text-[12.5px] tabular", point.over ? "text-weak" : "text-platinum")}>
        {deg(point.slope)}
        {point.over && <span className="ml-1.5 text-[10.5px]">over {limit}°</span>}
      </dd>
      <dt className="font-mono text-[9.5px] tracking-[0.18em] text-dim uppercase">Height</dt>
      <dd className="text-[12.5px] text-platinum tabular">{metres(point.height)}</dd>
      <dt className="font-mono text-[9.5px] tracking-[0.18em] text-dim uppercase">Light</dt>
      <dd className="flex items-center gap-1.5 text-[12.5px] text-platinum">
        <span className="inline-block size-2 rounded-full" style={point.shadow || night ? { border: "1px solid var(--color-chrome)" } : { background: "var(--color-flare)" }} />
        {light}
        <span className="sr-only">{world === "earth" ? "on Earth" : `on the ${world === "moon" ? "Moon" : "Mars"} side`}</span>
      </dd>
    </dl>
  );
}

/* ================================================================== panel */

interface PanelProps {
  ft: FieldTest;
  id: string;
  earthName: string;
  targetName: string;
  targetBody: "moon" | "mars";
  /** Full-screen side panel: one column. */
  compact: boolean;
  className?: string;
  onClose: () => void;
}

function eventLine(e: FieldEvent, p: { mode: TeamMode; limit: number; earthName: string; targetName: string; checks: TestCheck[]; compact: boolean }) {
  const name = e.side === "earth" ? p.earthName : p.targetName;
  switch (e.kind) {
    case "start":
      return p.mode === "rover" ? "Rover rolling out on both worlds: same route, same scale." : "Team walking out on both worlds: same route, same scale.";
    case "steep":
      return `Too steep at ${name}: up to ${Math.round(e.slope ?? 0)}°, over your ${p.limit}° limit.`;
    case "shadow":
      return `Entering shadow at ${name}. Lights on.`;
    case "night":
      return `It is night at ${name}, so that route is dark all the way.`;
    case "done": {
      const yes = p.checks.filter((c) => c.verdict === "yes").length;
      const part = p.checks.filter((c) => c.verdict === "partly").length;
      return `Done. This run supports ${yes} of ${p.checks.length} field tests for this job${part ? `, and ${part} in part` : ""}. The log is ${p.compact ? "in this panel" : "below"}.`;
    }
  }
}

const FACE: Record<FieldEvent["kind"], [Mood, Action]> = {
  start: ["focused", "walk"],
  steep: ["wow", "point"],
  shadow: ["cold", "binoculars"],
  night: ["cold", "shiver"],
  done: ["happy", "flag"],
};

export function FieldPanel({ ft, id, earthName, targetName, targetBody, compact, className, onClose }: PanelProps) {
  const { data, status, index, reduce } = ft;
  const ctx = { mode: ft.mode, limit: ft.limit, earthName, targetName, checks: ft.checks, compact };

  // Astra speaks the latest moment the team has reached
  let say = "Pick the team, the slope limit and the time on Earth, then start the run.";
  let face: [Mood, Action] = ["thinking", "point"];
  if (data && status !== "ready") {
    const groups = data.groups.filter((g) => g[0].at <= index && (g[0].kind !== "done" || status === "done"));
    const g = groups[groups.length - 1];
    if (g) {
      say = g.map((e) => eventLine(e, ctx)).join(" ");
      const lead = [...g].sort((a, b) => (a.kind === "done" ? -1 : b.kind === "done" ? 1 : 0))[0];
      face = FACE[lead.kind];
      if (lead.kind === "done" && !ft.checks.some((c) => c.verdict === "yes")) face = ["sad", "slump"];
    }
  }

  const primaryLabel = status === "running" ? "Pause" : reduce ? (status === "paused" ? "Next stop" : "Start, step by step") : status === "paused" ? "Resume" : status === "done" ? "Run again" : "Start the run";
  const PrimaryIcon = status === "running" ? Pause : reduce && status === "paused" ? StepForward : Play;
  const done = data ? (index / Math.max(1, data.n - 1)) * data.sumE.lengthKm : 0;

  return (
    <section id={id} aria-label="Field test" className={clsx("bg-panel", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-mono text-[11px] tracking-[0.24em] text-flare uppercase">Field test</h3>
          <Badge />
          <span className="text-[12px] text-chrome">Same route across both blocks, west to east along the gold line.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the field test" className="grid size-8 shrink-0 place-items-center rounded-full border border-line-2 text-chrome transition-colors hover:text-platinum">
          <X size={14} />
        </button>
      </div>

      <div className={clsx("grid gap-x-8 gap-y-6 p-5", !compact && "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]")}>
        {/* ----------------------------------------------------------- setup */}
        <div className="space-y-5">
          <div>
            <Label>Team</Label>
            <Choice
              label="Team"
              value={ft.mode}
              onChange={ft.setMode}
              options={[
                { id: "rover", label: <><Truck size={13} aria-hidden /> Rover drive</> },
                { id: "walk", label: <><Footprints size={13} aria-hidden /> Walking team</> },
              ]}
            />
          </div>
          <div>
            <Label>Slope limit</Label>
            <Choice label="Slope limit" value={ft.limit} onChange={ft.setLimit} options={SLOPE_LIMITS.map((s) => ({ id: s, label: `${s}°` }))} />
            <p className="mt-2 text-[12px] leading-relaxed text-dim">Ground steeper than this is marked on the route. The steps are the slope chart's own.</p>
          </div>
          <div>
            <Label htmlFor={`${id}-month`}>
              Sun at {earthName}
            </Label>
            <div className="flex flex-wrap items-center gap-3">
              <select id={`${id}-month`} value={ft.month} onChange={(e) => ft.setMonth(+e.target.value)} className="cursor-pointer rounded-full border border-line-2 bg-ink px-3 py-1.5 text-[12.5px] text-platinum outline-none">
                {MONTHS_LONG.map((m, k) => (
                  <option key={m} value={k} className="bg-panel">
                    {m}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[12px] text-chrome">
                <input
                  type="range"
                  min={0}
                  max={23}
                  step={1}
                  value={ft.hour}
                  onChange={(e) => ft.setHour(+e.target.value)}
                  aria-label="Time of day, local Sun time"
                  aria-valuetext={`${clock(ft.hour)} local Sun time`}
                  className="w-32 accent-[#f2c879]"
                />
                <span className="w-11 font-mono text-platinum tabular">{clock(ft.hour)}</span>
              </label>
            </div>
            <p className="mt-2 text-[12.5px] text-chrome">
              {sunLine(ft.sunE)}. <span className="text-dim">Local Sun time: 12:00 is when the Sun stands highest.</span>
            </p>
          </div>
          <div>
            <Label>Sun at {targetName}</Label>
            <p className="text-[12.5px] leading-relaxed text-chrome">{targetSunLine(ft.sunT)}</p>
          </div>
        </div>

        {/* ------------------------------------------------------------- run */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-start gap-3">
            <Astronaut size={58} mood={face[0]} action={face[1]} className="shrink-0" />
            <p role="status" className="mt-1 rounded-2xl rounded-tl-sm border border-line-2 bg-ink px-3.5 py-2.5 text-[13px] leading-snug text-platinum">
              {say}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={ft.primary} disabled={!data} className="flex items-center gap-1.5 rounded-full bg-flare px-4 py-2 text-[12.5px] font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40">
              <PrimaryIcon size={13} aria-hidden /> {primaryLabel}
            </button>
            {!reduce && status !== "ready" && status !== "done" && (
              <button type="button" onClick={ft.step} disabled={!data} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-2 text-[12px] text-chrome transition-colors hover:text-platinum">
                <StepForward size={13} aria-hidden /> Next stop
              </button>
            )}
            <button type="button" onClick={ft.skip} disabled={!data || status === "done"} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-2 text-[12px] text-chrome transition-colors hover:text-platinum disabled:opacity-40">
              <SkipForward size={13} aria-hidden /> Skip to end
            </button>
            {status !== "ready" && (
              <button type="button" onClick={ft.reset} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] text-dim transition-colors hover:text-chrome">
                <RotateCcw size={12} aria-hidden /> Reset
              </button>
            )}
          </div>

          {data ? (
            <>
              <div>
                <div className="mb-1.5 flex justify-between font-mono text-[10px] text-dim tabular">
                  <span>{km(done)} of {km(data.sumE.lengthKm)}</span>
                  <span>{reduce ? "Motion paused: step through" : `${RUN_SECONDS} s run`}</span>
                </div>
                <div role="progressbar" aria-label="Route travelled" aria-valuemin={0} aria-valuemax={Math.round(data.sumE.lengthKm)} aria-valuenow={Math.round(done)} aria-valuetext={`${km(done)} of ${km(data.sumE.lengthKm)}`} className="h-px w-full bg-line-2">
                  <div className="h-px bg-flare" style={{ width: `${(index / Math.max(1, data.n - 1)) * 100}%` }} />
                </div>
              </div>
              <FieldProfile data={data} index={index} earthName={earthName} targetName={targetName} targetBody={targetBody} limit={ft.limit} />
            </>
          ) : (
            <p className="text-[12.5px] text-chrome">Working out the light on both blocks…</p>
          )}
        </div>
      </div>

      {data && status === "done" && <FieldLog ft={ft} earthName={earthName} targetName={targetName} compact={compact} />}
    </section>
  );
}

/* ========================================================= route profile */

type RunData = NonNullable<FieldTest["data"]>;

const STATE_FILL = { over: "var(--color-weak)", shadow: "#3b4560", sun: "var(--color-flare)" };
const fillOf = (p: RoutePoint) => (p.over ? STATE_FILL.over : p.shadow ? STATE_FILL.shadow : STATE_FILL.sun);

/** Height along the route on both worlds (same metres scale), with sunlit, shadowed and too-steep stretches. */
function FieldProfile({ data, index, earthName, targetName, targetBody, limit }: { data: RunData; index: number; earthName: string; targetName: string; targetBody: "moon" | "mars"; limit: number }) {
  const W = 600;
  const LINE_TOP = 6;
  const LINE_BOTTOM = 84;
  const geo = useMemo(() => {
    const n = data.n;
    const mean = (r: RoutePoint[]) => r.reduce((s, p) => s + p.height, 0) / r.length;
    const mE = mean(data.routeE);
    const mT = mean(data.routeT);
    const lim = Math.max(30, ...data.routeE.map((p) => Math.abs(p.height - mE)), ...data.routeT.map((p) => Math.abs(p.height - mT))) * 1.08;
    const x = (k: number) => (k / (n - 1)) * W;
    const mid = (LINE_TOP + LINE_BOTTOM) / 2;
    const y = (m: number) => mid - (m / lim) * ((LINE_BOTTOM - LINE_TOP) / 2);
    const path = (r: RoutePoint[], m: number) => r.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.height - m).toFixed(1)}`).join("");
    const w = W / (n - 1) + 0.6;
    return { x, y, mE, mT, lim, w, pathE: path(data.routeE, mE), pathT: path(data.routeT, mT) };
  }, [data]);
  const k = Math.min(index, data.n - 1);
  const pE = data.routeE[k];
  const pT = data.routeT[k];
  const strip = (r: RoutePoint[], y: number) => r.map((p, i) => <rect key={i} x={geo.x(i) - geo.w / 2} y={y} width={geo.w} height={7} style={{ fill: fillOf(p), opacity: p.over || p.shadow ? 1 : 0.75 }} />);
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} 112`}
        preserveAspectRatio="none"
        className="block h-[132px] w-full"
        role="img"
        aria-label={`Height along the ${km(data.sumE.lengthKm)} route at ${earthName} and ${targetName}, at the same scale (±${Math.round(geo.lim)} m), with sunlit, shadowed and too-steep stretches.`}
      >
        <line x1={0} x2={W} y1={(LINE_TOP + LINE_BOTTOM) / 2} y2={(LINE_TOP + LINE_BOTTOM) / 2} style={{ stroke: "var(--color-line-2)", strokeWidth: 1, strokeDasharray: "3 4" }} vectorEffect="non-scaling-stroke" />
        <path d={geo.pathE} style={{ fill: "none", stroke: "var(--color-earth)", strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
        <path d={geo.pathT} style={{ fill: "none", stroke: `var(--color-${targetBody})`, strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
        <g>{strip(data.routeE, 92)}</g>
        <g>{strip(data.routeT, 102)}</g>
        <line x1={geo.x(k)} x2={geo.x(k)} y1={0} y2={112} style={{ stroke: "var(--color-platinum)", strokeWidth: 1, opacity: 0.8 }} vectorEffect="non-scaling-stroke" />
        <circle cx={geo.x(k)} cy={geo.y(pE.height - geo.mE)} r={3.2} style={{ fill: "var(--color-earth)" }} />
        <circle cx={geo.x(k)} cy={geo.y(pT.height - geo.mT)} r={3.2} style={{ fill: `var(--color-${targetBody})` }} />
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-chrome">
        <span className="flex items-center gap-1.5">
          <WorldDot world="earth" /> {earthName} (upper strip)
        </span>
        <span className="flex items-center gap-1.5">
          <WorldDot world={targetBody} /> {targetName} (lower strip)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: STATE_FILL.sun, opacity: 0.75 }} /> Sunlit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: STATE_FILL.shadow }} /> In shadow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: STATE_FILL.over }} /> Over {limit}°
        </span>
      </figcaption>
    </figure>
  );
}

/* ===================================================================== log */

const VERDICT: Record<Verdict, { word: string; cls: string }> = {
  yes: { word: "Supported", cls: "border-strong/40 bg-strong/10 text-strong" },
  partly: { word: "Partly", cls: "border-partial/40 bg-partial/10 text-partial" },
  no: { word: "Not this run", cls: "border-weak/40 bg-weak/10 text-weak" },
  other: { word: "Needs another test", cls: "border-dashed border-line-2 text-chrome" },
};

function FieldLog({ ft, earthName, targetName, compact }: { ft: FieldTest; earthName: string; targetName: string; compact: boolean }) {
  const data = ft.data!;
  const e = data.sumE;
  const t = data.sumT;
  const time = (s: RouteSummary) => (ft.mode === "rover" ? `at least ${formatHours(travelHours(s, "rover"))}` : formatHours(travelHours(s, "walk")));
  const rows: [string, string, string][] = [
    ["Route length", km(e.lengthKm), km(t.lengthKm)],
    ["Steepest slope", `${deg(e.steepest)} at ${km(e.steepestKm)}`, `${deg(t.steepest)} at ${km(t.steepestKm)}`],
    ["Average slope", deg(e.meanSlope), deg(t.meanSlope)],
    [`Over the ${ft.limit}° limit`, `${pct(e.overShare)} (${km(e.overKm)})`, `${pct(t.overShare)} (${km(t.overKm)})`],
    ["In shadow", data.night.earth ? "100% (night)" : pct(e.shadowShare), data.night.target ? "100% (night)" : pct(t.shadowShare)],
    ["Climb up, down", `${metres(e.climb)}, ${metres(e.descent)}`, `${metres(t.climb)}, ${metres(t.descent)}`],
    [ft.mode === "rover" ? "Rough drive time" : "Rough walking time", time(e), time(t)],
  ];
  return (
    <div className="border-t border-line p-5" role="region" aria-label="Field test log">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[16px] font-medium tracking-[-0.01em] text-platinum">Field test log</h3>
        <Badge />
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-chrome">
        {ft.mode === "rover" ? "Rover drive" : "Walking team"} · slope limit {ft.limit}° · {earthName}: {MONTHS_LONG[ft.month]}, {clock(ft.hour)} local Sun time ({sunLine(data.sunE).toLowerCase()}) · {targetName}:{" "}
        {data.sunT.elev > 0 ? `Sun ${deg(data.sunT.elev)} up` : "night"}
      </p>

      <div className={clsx("mt-4 grid gap-6", !compact && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <div className="min-w-0">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">Measured along the route on both worlds</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-3 font-normal text-dim">
                  <span className="sr-only">Measure</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-medium text-platinum">
                  <span className="flex items-center gap-1.5">
                    <WorldDot world="earth" /> {earthName}
                  </span>
                </th>
                <th scope="col" className="py-2 font-medium text-platinum">
                  <span className="flex items-center gap-1.5">
                    <WorldDot world={data.routeT.length ? (ft.sunT.grazing ? "moon" : undefined) ?? "moon" : "moon"} className="hidden" />
                    {targetName}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label} className="border-b border-line/70">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-chrome">
                    {label}
                  </th>
                  <td className="py-2 pr-3 text-platinum tabular">{a}</td>
                  <td className="py-2 text-platinum tabular">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] leading-relaxed text-dim">
            {ft.mode === "rover"
              ? `Drive time uses the Apollo rover's top speed, about ${ROVER_KMH} km/h (NASA), so the real time is longer. Steep stretches would need a detour.`
              : `Walking time uses Naismith's rule for hill walkers on Earth: ${WALK_KMH} km/h plus one hour for every ${WALK_CLIMB_M_PER_H} m climbed.`}{" "}
            Slopes are kilometre-scale averages from grid points {data.spacingKm.toFixed(2)} km apart; real ground is rougher. Heights: Earth above sea level; the Moon and Mars from NASA's 8-bit preview elevation, so theirs are preview-grade. The team markers are not to scale.
          </p>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <h4 className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">What this run supports</h4>
            <ul className="mt-2 space-y-2.5">
              {ft.checks.map((c) => (
                <li key={c.test} className="text-[12.5px] leading-snug">
                  <span className={clsx("mr-2 inline-block rounded-full border px-2 py-0.5 align-middle font-mono text-[9.5px] tracking-wider uppercase", VERDICT[c.verdict].cls)}>{VERDICT[c.verdict].word}</span>
                  <span className="text-platinum">{c.test}.</span> <span className="text-chrome">{c.why}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
              Where the analogy still breaks
              <span className="rounded-full border border-weak/40 bg-weak/10 px-2 py-0.5 text-[9px] tracking-wider text-weak">Earth can't copy</span>
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] leading-snug text-chrome marker:text-dim">
              {ft.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
