/**
 * "Run a field test" on the 3D land slices (Compare). A team (rover or walkers) crosses the same
 * route on the Earth block and the target block in sync. On the 3D stage: the team, a live readout
 * per block, Astra calling out the key moments and the run buttons. In the panel: the team, the
 * slope limit, the Sun, the route profile and, at the end, the field log.
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
  allDayShadow,
  checkTests,
  compass,
  dayTop,
  earthDay,
  earthSun,
  fieldEvents,
  formatHours,
  groupEvents,
  ROVER_KMH,
  routeCells,
  runGaps,
  sampleRoute,
  shadowMask,
  SLOPE_LIMITS,
  startHour,
  startMonth,
  stopIndexes,
  summarize,
  targetDay,
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

/** The month whose light is most like the target's (the Light section's best season) and the start hour. */
function defaultsFor(earthLat: number, body: "moon" | "mars", targetLat: number) {
  const month = startMonth(earthLat, lightTwin(earthLat, body, targetLat).months.map((m) => m.score));
  return { month, hour: startHour(earthLat, body, targetLat, month) };
}

/* ===================================================================== state */

export function useFieldTest(inp: FieldInput) {
  const { open, earth, target, earthLat, targetLat, targetBody, task, snowice, earthName, targetName } = inp;
  const reduce = useMotionReduced();

  // the month and hour start from the best light match for this pair; the visitor's own picks
  // last until the place or the target changes
  const pair = `${earthLat}|${targetBody}|${targetLat}`;
  const defaults = useMemo(() => (open ? defaultsFor(earthLat, targetBody, targetLat) : null), [open, earthLat, targetBody, targetLat]);
  const [picked, setPicked] = useState<{ pair: string; month: number; hour: number } | null>(null);
  const month = picked?.pair === pair ? picked.month : (defaults?.month ?? 0);
  const hour = picked?.pair === pair ? picked.hour : (defaults?.hour ?? 10);
  const setMonth = useCallback((m: number) => setPicked({ pair, month: m, hour }), [pair, hour]);
  const setHour = useCallback((h: number) => setPicked({ pair, month, hour: h }), [pair, month]);
  const [mode, setMode] = useState<TeamMode>("rover");
  const [limit, setLimit] = useState(15);

  const sunE = useMemo(() => earthSun(earthLat, month, hour), [earthLat, month, hour]);
  const sunT = useMemo(() => targetSun(targetBody, targetLat, month, hour), [targetBody, targetLat, month, hour]);
  const dayE = useMemo(() => earthDay(earthLat, month), [earthLat, month]);
  const dayT = useMemo(() => targetDay(targetBody, targetLat, month), [targetBody, targetLat, month]);
  // shadows take a few milliseconds per block: let the slider stay responsive
  const dSunE = useDeferredValue(sunE);
  const dSunT = useDeferredValue(sunT);
  const shadeE = useMemo(() => (open && earth ? shadowMask(earth, dSunE) : null), [open, earth, dSunE]);
  const shadeT = useMemo(() => (open && target ? shadowMask(target, dSunT) : null), [open, target, dSunT]);
  const allE = useMemo(() => (open && earth ? allDayShadow(earth, routeCells(earth.n), dayE) : null), [open, earth, dayE]);
  const allT = useMemo(() => (open && target ? allDayShadow(target, routeCells(target.n), dayT) : null), [open, target, dayT]);

  const data = useMemo(() => {
    if (!earth || !target || !shadeE || !shadeT || !allE || !allT) return null;
    const routeE = sampleRoute(earth, shadeE, limit, allE);
    const routeT = sampleRoute(target, shadeT, limit, allT);
    const n = Math.min(routeE.length, routeT.length);
    const night = { earth: dSunE.elev <= 0, target: dSunT.elev <= 0 };
    const events = fieldEvents(routeE, routeT, night);
    return {
      routeE,
      routeT,
      n,
      night,
      sumE: summarize(routeE),
      sumT: summarize(routeT),
      events,
      groups: groupEvents(events, n),
      stops: stopIndexes(events, n),
      spacingKm: earth.spacingKm,
      sunE: dSunE,
      sunT: dSunT,
      topE: dayTop(dayE),
      topT: dayTop(dayT),
    };
  }, [earth, target, shadeE, shadeT, allE, allT, limit, dSunE, dSunT, dayE, dayT]);

  const checks = useMemo(
    () =>
      data
        ? checkTests({ task, earth: data.sumE, target: data.sumT, earthSun: data.sunE, targetSun: data.sunT, earthTop: data.topE, targetTop: data.topT, targetGrazing: data.sunT.grazing, month, earthName, targetName, snowice })
        : [],
    [data, task, month, earthName, targetName, snowice],
  );
  const gaps = useMemo(
    () => (data ? runGaps({ body: targetBody, targetLat, targetName, earthName, earth: data.sumE, target: data.sumT, spacingKm: data.spacingKm }) : []),
    [data, targetBody, targetLat, targetName, earthName],
  );

  /* ------------------------------------------------------------- playback */
  // progress is read by the 3D view every frame, so the team moves without a React render
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
      // step by step: "Run again" goes back to the start, then each press moves to the next stop
      if (status === "done") return setStatus("paused");
      return step();
    }
    setStatus("running");
  }, [data, status, reduce, jump, step]);

  const skip = useCallback(() => {
    if (!data) return;
    jump(n - 1);
    setStatus("done");
  }, [data, n, jump]);

  const scene = useMemo<FieldScene | null>(
    () => (open && data && shadeE && shadeT ? { progress, mode, earth: { route: data.routeE, shade: shadeE }, target: { route: data.routeT, shade: shadeT } } : null),
    [open, data, shadeE, shadeT, mode],
  );

  return { open, reduce, mode, setMode, limit, setLimit, month, setMonth, hour, setHour, sunE, sunT, data, checks, gaps, status, index, scene, primary, step, skip };
}

export type FieldTest = ReturnType<typeof useFieldTest>;
type RunData = NonNullable<FieldTest["data"]>;

/* ================================================================= helpers */

const deg = (v: number) => `${v.toFixed(1)}°`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const metres = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString("en-US")} m`;
const km = (v: number) => `${v >= 10 ? Math.round(v) : v.toFixed(1)} km`;
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:00`;
const MONO = "font-mono text-[10px] tracking-[0.2em] text-dim uppercase";

function sunLine(s: SunPosition) {
  return s.elev > 0 ? `Sun ${deg(s.elev)} up, in the ${compass(s.az)}` : `Night: the Sun is ${deg(-s.elev)} below the horizon`;
}

function targetSunLine(s: TargetSun) {
  if (s.grazing) return `Low grazing Sun, ${deg(s.elev)} up (its usual daylight height), now in the ${compass(s.az)}. It circles the sky once a lunar day.`;
  return `${sunLine(s)}. Same season and the same time of its own day.`;
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

/* ============================================================ on the stage */

/** Slope, height and light under the team, one per block, shown on the 3D stage. */
export function FieldReadout({ point, limit, night, name, right }: { point: RoutePoint | undefined; limit: number; night: boolean; name: string; right?: boolean }) {
  if (!point) return null;
  const light = night ? "Night" : point.shadow ? "In shadow" : "Sunlit";
  const dt = "font-mono text-[9px] tracking-[0.18em] text-dim uppercase sm:text-[9.5px]";
  const dd = "text-[11.5px] sm:text-[12.5px]";
  return (
    <dl
      aria-label={`Under the team at ${name}`}
      className={clsx("mt-2.5 grid w-fit grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-0.5 rounded-xl border border-line-2 bg-void/80 px-2.5 py-1.5 text-left sm:mt-3 sm:gap-y-1 sm:px-3 sm:py-2", right && "ml-auto")}
    >
      <dt className={dt}>Slope</dt>
      <dd className={clsx(dd, "tabular", point.over ? "text-weak" : "text-platinum")}>
        {deg(point.slope)}
        {point.over && <span className="ml-1.5 text-[10.5px]">over {limit}°</span>}
      </dd>
      <dt className={dt}>Height</dt>
      <dd className={clsx(dd, "text-platinum tabular")}>{metres(point.height)}</dd>
      <dt className={dt}>Light</dt>
      <dd className={clsx(dd, "flex items-center gap-1.5 text-platinum")}>
        <span aria-hidden className="inline-block size-2 rounded-full" style={point.shadow || night ? { border: "1px solid var(--color-chrome)" } : { background: "var(--color-flare)" }} />
        {light}
      </dd>
    </dl>
  );
}

interface LineCtx {
  mode: TeamMode;
  limit: number;
  earthName: string;
  targetName: string;
  checks: TestCheck[];
  where: string;
}

/** One line for a group of moments; the same moment on both worlds is said once. */
function groupLine(g: FieldEvent[], p: LineCtx) {
  if (g.some((e) => e.kind === "done")) {
    const count = (v: Verdict) => p.checks.filter((c) => c.verdict === v).length;
    const part = count("partly");
    return `Done. Field tests supported: ${count("yes")} of ${p.checks.length}${part ? `, ${part} in part` : ""}. The log is ${p.where}.`;
  }
  const name = (e: FieldEvent) => (e.side === "earth" ? p.earthName : p.targetName);
  const of = (kind: FieldEvent["kind"]) => g.filter((e) => e.kind === kind);
  const out: string[] = [];
  if (of("start").length) out.push(p.mode === "rover" ? "Rover rolling out on both worlds: same route, same scale." : "Team walking out on both worlds: same route, same scale.");
  const night = of("night");
  if (night.length === 2) out.push("It is night on both worlds, so both routes are dark all the way.");
  else if (night.length) out.push(`It is night at ${name(night[0])}, so that route is dark all the way.`);
  const shadow = of("shadow");
  if (shadow.length === 2) out.push("Entering shadow on both worlds. Lights on.");
  else if (shadow.length) out.push(`Entering shadow at ${name(shadow[0])}. Lights on.`);
  const steep = of("steep");
  const top = (e: FieldEvent | undefined) => Math.round(e?.slope ?? 0);
  if (steep.length === 2)
    out.push(`Too steep on both worlds: up to ${top(steep.find((e) => e.side === "earth"))}° at ${p.earthName} and ${top(steep.find((e) => e.side === "target"))}° at ${p.targetName}, over your ${p.limit}° limit.`);
  else if (steep.length) out.push(`Too steep at ${name(steep[0])}: up to ${top(steep[0])}°, over your ${p.limit}° limit.`);
  return out.join(" ");
}

/** Astra's face for a group: a slope warning matters most, then shadow, then night. */
const FACE: [FieldEvent["kind"], Mood, Action][] = [
  ["steep", "wow", "point"],
  ["shadow", "cold", "binoculars"],
  ["night", "cold", "shiver"],
  ["start", "focused", "walk"],
];

/** What Astra says and how he looks at the team's current position. */
function callout(ft: FieldTest, earthName: string, targetName: string, where: string): { say: string; face: [Mood, Action] } {
  const { data, status, index } = ft;
  if (!data) return { say: "Working out the light on both blocks…", face: ["focused", "scan"] };
  if (status === "ready") {
    const who = ft.mode === "rover" ? "Rover" : "Walking team";
    return { say: `${who} ready at the west edge of both blocks. Set the team and the Sun ${where}, then press Start.`, face: ["thinking", "point"] };
  }
  const groups = data.groups.filter((g) => g[0].at <= index && (g[0].kind !== "done" || status === "done"));
  const g = groups[groups.length - 1];
  if (!g) return { say: "", face: ["focused", "walk"] };
  const say = groupLine(g, { mode: ft.mode, limit: ft.limit, earthName, targetName, checks: ft.checks, where });
  if (g.some((e) => e.kind === "done")) {
    const has = (v: Verdict) => ft.checks.some((c) => c.verdict === v);
    return { say, face: has("yes") ? ["happy", "flag"] : has("partly") ? ["thinking", "point"] : has("no") ? ["sad", "slump"] : ["focused", "scan"] };
  }
  const f = FACE.find(([kind]) => g.some((e) => e.kind === kind)) ?? FACE[FACE.length - 1];
  return { say, face: [f[1], f[2]] };
}

/** Astra on the stage, calling out the key moments of the run (a polite live region). */
export function FieldCallout({ ft, earthName, targetName, where }: { ft: FieldTest; earthName: string; targetName: string; where: string }) {
  const { say, face } = callout(ft, earthName, targetName, where);
  return (
    <div className="flex items-end gap-1.5">
      <Astronaut size={50} mood={face[0]} action={face[1]} className="shrink-0" />
      <p role="status" className="pointer-events-auto mb-2.5 max-w-[min(380px,calc(100%-64px))] rounded-2xl rounded-bl-sm border border-line-2 bg-void/85 px-3 py-2 text-[12.5px] leading-snug text-platinum">
        {say}
      </p>
    </div>
  );
}

const ghost = "flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[12px] text-chrome transition-colors hover:text-platinum disabled:opacity-40";

/** Start, pause, step and skip: the run buttons in the stage's toolbar. */
export function FieldControls({ ft, primaryRef }: { ft: FieldTest; primaryRef?: React.Ref<HTMLButtonElement> }) {
  const { status, reduce, data } = ft;
  const label = status === "running" ? "Pause" : status === "done" ? "Run again" : reduce ? (status === "paused" ? "Next stop" : "Start, step by step") : status === "paused" ? "Resume" : "Start the run";
  const Icon = status === "running" ? Pause : status === "done" ? RotateCcw : reduce && status === "paused" ? StepForward : Play;
  return (
    <>
      <button ref={primaryRef} type="button" onClick={ft.primary} disabled={!data} className="flex items-center gap-1.5 rounded-full bg-flare px-3.5 py-1.5 text-[12px] font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40">
        <Icon size={13} aria-hidden /> {label}
      </button>
      {!reduce && (status === "running" || status === "paused") && (
        <button type="button" onClick={ft.step} className={clsx(ghost, "max-sm:hidden")}>
          <StepForward size={13} aria-hidden /> Next stop
        </button>
      )}
      <button type="button" onClick={ft.skip} disabled={!data || status === "done"} className={ghost}>
        <SkipForward size={13} aria-hidden />
        <span>
          Skip<span className="max-sm:sr-only"> to end</span>
        </span>
      </button>
    </>
  );
}

/* ================================================================== panel */

interface PanelProps {
  ft: FieldTest;
  earthName: string;
  targetName: string;
  targetBody: "moon" | "mars";
  /** Full-screen side panel: one column. */
  compact: boolean;
  className?: string;
  onClose: () => void;
}

export function FieldPanel({ ft, earthName, targetName, targetBody, compact, className, onClose }: PanelProps) {
  const { data, index } = ft;
  const travelled = data ? (index / Math.max(1, data.n - 1)) * data.sumE.lengthKm : 0;
  const monthId = `field-month-${compact ? "full" : "page"}`;
  const box = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  // in full screen the panel scrolls on its own: bring the log into view when the run ends
  useEffect(() => {
    if (!compact || ft.status !== "done" || !box.current || !log.current) return;
    box.current.scrollTo({ top: log.current.offsetTop - 8, behavior: ft.reduce ? "auto" : "smooth" });
  }, [compact, ft.status, ft.reduce]);
  return (
    <section ref={box} aria-label="Field test" className={clsx("relative bg-panel", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="font-mono text-[11px] tracking-[0.24em] text-flare uppercase">Field test</h3>
          <Badge />
          <span className="text-[12.5px] text-chrome">One straight route across both blocks, west to east along the gold line, at the same scale.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the field test" className="grid size-8 shrink-0 place-items-center rounded-full border border-line-2 text-chrome transition-colors hover:text-platinum">
          <X size={14} aria-hidden />
        </button>
      </div>

      <div className={clsx("grid gap-x-10 gap-y-6 p-5", !compact && "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]")}>
        {/* ----------------------------------------------------------- setup */}
        <div className="space-y-5">
          <div>
            <div className={clsx(MONO, "mb-2")}>Team</div>
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
            <div className={clsx(MONO, "mb-2")}>Slope limit</div>
            <Choice label="Slope limit" value={ft.limit} onChange={ft.setLimit} options={SLOPE_LIMITS.map((s) => ({ id: s, label: `${s}°` }))} />
            <p className="mt-2 text-[12px] leading-relaxed text-dim">Ground steeper than this turns red on the route. The steps are the slope chart's own.</p>
          </div>
          <div>
            <label htmlFor={monthId} className={clsx(MONO, "mb-2 block")}>
              Sun at {earthName}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <select id={monthId} value={ft.month} onChange={(e) => ft.setMonth(+e.target.value)} className="cursor-pointer rounded-full border border-line-2 bg-ink px-3 py-1.5 text-[12.5px] text-platinum outline-none">
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
              {sunLine(ft.sunE)}. <span className="text-dim">Local Sun time: at 12:00 the Sun stands highest.</span>
            </p>
          </div>
          <div>
            <div className={clsx(MONO, "mb-2")}>Sun at {targetName}</div>
            <p className="text-[12.5px] leading-relaxed text-chrome">{targetSunLine(ft.sunT)}</p>
          </div>
        </div>

        {/* ------------------------------------------------------- the route */}
        <div className="min-w-0 space-y-3">
          {data ? (
            <>
              <div>
                <div className="mb-1.5 flex justify-between gap-3 font-mono text-[10px] text-dim tabular">
                  <span>
                    {km(travelled)} of {km(data.sumE.lengthKm)}
                  </span>
                  <span>{ft.reduce ? "Motion paused: step through" : `${RUN_SECONDS} s run`}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Route travelled"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(data.sumE.lengthKm)}
                  aria-valuenow={Math.round(travelled)}
                  aria-valuetext={`${km(travelled)} of ${km(data.sumE.lengthKm)}`}
                  className="h-px w-full bg-line-2"
                >
                  <div className="h-px bg-flare" style={{ width: `${(index / Math.max(1, data.n - 1)) * 100}%` }} />
                </div>
              </div>
              <FieldProfile data={data} index={index} earthName={earthName} targetName={targetName} targetBody={targetBody} limit={ft.limit} />
              <p className="text-[11.5px] leading-relaxed text-dim">
                Slopes come from elevation grid points {data.spacingKm.toFixed(2)} km apart, so they are kilometre-scale averages. A real rover meets steeper ground over a few metres.
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-chrome">Working out the light on both blocks…</p>
          )}
        </div>
      </div>

      {data && ft.status === "done" && <FieldLog ft={ft} data={data} earthName={earthName} targetName={targetName} targetBody={targetBody} compact={compact} logRef={log} />}
    </section>
  );
}

/* ========================================================= route profile */

const STATE_FILL = { over: "var(--color-weak)", shadow: "color-mix(in oklab, var(--color-cobalt) 55%, var(--color-panel))", sun: "var(--color-flare)" };
const fillOf = (p: RoutePoint) => (p.over ? STATE_FILL.over : p.shadow ? STATE_FILL.shadow : STATE_FILL.sun);

/** Height along the route on both worlds (same metres scale), with sunlit, shadowed and too-steep stretches. */
function FieldProfile({ data, index, earthName, targetName, targetBody, limit }: { data: RunData; index: number; earthName: string; targetName: string; targetBody: "moon" | "mars"; limit: number }) {
  const W = 600;
  const H = 112;
  const PX = 132; // drawn height in pixels; the width stretches
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
  // the team's dots are HTML so they stay round while the chart stretches to the panel's width
  const left = `${(k / (data.n - 1)) * 100}%`;
  const dot = (y: number, world: "earth" | "moon" | "mars") => (
    <span aria-hidden className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--color-panel)]" style={{ left, top: (y / H) * PX, background: `var(--color-${world})` }} />
  );
  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height: PX }}
          role="img"
          aria-label={`Height along the ${km(data.sumE.lengthKm)} route at ${earthName} and ${targetName}, at the same scale (plus or minus ${Math.round(geo.lim)} m), with sunlit, shadowed and too-steep stretches.`}
        >
          <line x1={0} x2={W} y1={(LINE_TOP + LINE_BOTTOM) / 2} y2={(LINE_TOP + LINE_BOTTOM) / 2} style={{ stroke: "var(--color-line-2)", strokeWidth: 1, strokeDasharray: "3 4" }} vectorEffect="non-scaling-stroke" />
          <path d={geo.pathE} style={{ fill: "none", stroke: "var(--color-earth)", strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
          <path d={geo.pathT} style={{ fill: "none", stroke: `var(--color-${targetBody})`, strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
          <g>{strip(data.routeE, 92)}</g>
          <g>{strip(data.routeT, 102)}</g>
          <line x1={geo.x(k)} x2={geo.x(k)} y1={0} y2={H} style={{ stroke: "var(--color-platinum)", strokeWidth: 1, opacity: 0.7 }} vectorEffect="non-scaling-stroke" />
        </svg>
        {dot(geo.y(pE.height - geo.mE), "earth")}
        {dot(geo.y(pT.height - geo.mT), targetBody)}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-dim">
        <span>West</span>
        <span>±{Math.round(geo.lim).toLocaleString("en-US")} m, same scale</span>
        <span>East</span>
      </div>
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

function FieldLog({
  ft,
  data,
  earthName,
  targetName,
  targetBody,
  compact,
  logRef,
}: {
  ft: FieldTest;
  data: RunData;
  earthName: string;
  targetName: string;
  targetBody: "moon" | "mars";
  compact: boolean;
  logRef: React.Ref<HTMLDivElement>;
}) {
  const e = data.sumE;
  const t = data.sumT;
  const time = (s: RouteSummary) => (ft.mode === "rover" ? `at least ${formatHours(travelHours(s, "rover"))}` : formatHours(travelHours(s, "walk")));
  const dark = (s: RouteSummary, night: boolean) => (night ? "100% (night)" : pct(s.shadowShare));
  const allDay = (s: RouteSummary, top: number) => (top <= 0 ? "100% (no sunrise)" : pct(s.allDayShare));
  const rows: [string, string, string][] = [
    ["Route length", km(e.lengthKm), km(t.lengthKm)],
    ["Steepest slope", `${deg(e.steepest)} at ${km(e.steepestKm)}`, `${deg(t.steepest)} at ${km(t.steepestKm)}`],
    ["Average slope", deg(e.meanSlope), deg(t.meanSlope)],
    [`Over the ${ft.limit}° limit`, `${pct(e.overShare)} (${km(e.overKm)})`, `${pct(t.overShare)} (${km(t.overKm)})`],
    [`In shadow at ${clock(ft.hour)}`, dark(e, data.night.earth), dark(t, data.night.target)],
    ["In shadow all day", allDay(e, data.topE), allDay(t, data.topT)],
    ["Climb up, down", `${metres(e.climb)}, ${metres(e.descent)}`, `${metres(t.climb)}, ${metres(t.descent)}`],
    [ft.mode === "rover" ? "Rough drive time" : "Rough walking time", time(e), time(t)],
  ];
  const sunT = data.sunT.grazing ? `low grazing Sun, ${deg(data.sunT.elev)} up` : sunLine(data.sunT).toLowerCase();
  return (
    <div ref={logRef} className="border-t border-line p-5" role="region" aria-label="Field test log">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[16px] font-medium tracking-[-0.01em] text-platinum">Field test log</h3>
        <Badge />
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-chrome">
        {ft.mode === "rover" ? "Rover drive" : "Walking team"} · slope limit {ft.limit}° · {earthName}: {MONTHS_LONG[ft.month]}, {clock(ft.hour)} local Sun time, {sunLine(data.sunE).toLowerCase()} · {targetName}: {sunT}
      </p>

      <div className={clsx("mt-4 grid gap-x-10 gap-y-6", !compact && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <div className="min-w-0">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">Measured along the route on both worlds</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-3 font-normal">
                  <span className="sr-only">Measure</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-medium text-platinum">
                  <span className="flex items-center gap-1.5">
                    <WorldDot world="earth" /> {earthName}
                  </span>
                </th>
                <th scope="col" className="py-2 font-medium text-platinum">
                  <span className="flex items-center gap-1.5">
                    <WorldDot world={targetBody} /> {targetName}
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
              ? `Drive time uses the Apollo rover's top speed, about ${ROVER_KMH} km/h (NASA), so the real time is longer, and steep stretches would need a detour.`
              : `Walking time uses Naismith's rule for hill walkers on Earth: ${WALK_KMH} km/h plus one hour for every ${WALK_CLIMB_M_PER_H} m climbed.`}{" "}
            Shadow comes from the ground inside each block, checked once an hour through the day. Heights: Earth above sea level; the Moon and Mars from NASA's 8-bit preview elevation, so
            theirs are preview-grade. The team markers are not to scale.
          </p>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <h4 className={MONO}>What this run supports</h4>
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
            <h4 className={clsx(MONO, "flex flex-wrap items-center gap-2")}>
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
