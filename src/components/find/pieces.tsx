/** Small shared pieces for the mission builder. */
import { motion } from "motion/react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { Flame, Microscope, Pickaxe, PlaneLanding, Route, Snowflake, SunDim, Target, Tent } from "lucide-react";
import type { TargetSite, TaskId } from "../../data/sites";
import { POLAR_IMAGE_SIZE, polarPixel } from "../../lib/geo";
import { EASE } from "../ui/kit";

export const TASK_ICON: Record<TaskId, typeof Tent> = {
  base: Tent,
  landing: PlaneLanding,
  traverse: Route,
  isru: Pickaxe,
  ice: Snowflake,
  caves: Flame,
  astrobio: Microscope,
  impact: Target,
  polar: SunDim,
};

export const TASK_LINE: Record<TaskId, string> = {
  base: "Live and work for weeks far from help",
  landing: "Find a safe spot and touch down",
  traverse: "Drive a rover or walk over rough ground",
  isru: "Dig up soil and rock to make water, oxygen or bricks",
  ice: "Find and drill frozen water",
  caves: "Explore lava tubes and caves for shelter",
  astrobio: "Look for signs of past or present life",
  impact: "Learn to read craters and impact rocks",
  polar: "Work in long shadows, deep cold and a low Sun",
};

/** A real NASA image crop centred on a Moon or Mars target. */
export function TargetImage({ t, className, span = 24 }: { t: TargetSite; className?: string; span?: number }) {
  if (t.body === "moon" && t.lat < -78) {
    const [x, y] = polarPixel(t.lat, t.lon);
    const crop = 360;
    const pos = (v: number) => `${((v - crop / 2) / (POLAR_IMAGE_SIZE - crop)) * 100}%`;
    return (
      <div
        className={clsx("polar-image bg-ink", className)}
        style={{ backgroundImage: "url(/textures/moon_south_pole_lola.webp)", backgroundSize: `${(POLAR_IMAGE_SIZE / crop) * 100}%`, backgroundPosition: `${pos(x)} ${pos(y)}` }}
        role="img"
        aria-label={`${t.name}, LRO LOLA shaded relief`}
      />
    );
  }
  const tex = t.body === "moon" ? "/textures/moon_lroc_2k.webp" : "/textures/mars_viking_2k.webp";
  const half = span / 2;
  const px = ((t.lon + 180 - half) / (360 - span)) * 100;
  const py = ((90 - t.lat - half) / (180 - span)) * 100;
  return (
    <div
      className={clsx("bg-ink", className)}
      style={{ backgroundImage: `url(${tex})`, backgroundSize: `${(360 / span) * 100}% ${(180 / span) * 100}%`, backgroundPosition: `${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%` }}
      role="img"
      aria-label={`${t.name}, ${t.body === "moon" ? "LRO" : "Viking"} global mosaic`}
    />
  );
}

export const STEPS = [
  { id: "destination", label: "Destination" },
  { id: "job", label: "The job" },
  { id: "needs", label: "Your needs" },
  { id: "results", label: "Results" },
] as const;
export type StepId = "start" | (typeof STEPS)[number]["id"];

export function StepRail({ step, onStep, done }: { step: StepId; onStep: (s: StepId) => void; done: Record<string, boolean> }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-1" aria-label="Mission steps">
      {STEPS.map((s, i) => {
        const on = s.id === step;
        const ok = i < idx || done[s.id];
        const can = i <= idx || ok;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              disabled={!can}
              onClick={() => onStep(s.id)}
              aria-current={on ? "step" : undefined}
              className={clsx("relative flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] whitespace-nowrap transition-colors", on ? "text-void" : can ? "text-chrome hover:text-platinum" : "text-dim")}
            >
              {on && <motion.span layoutId="step-pill" className="absolute inset-0 rounded-full bg-platinum" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className={clsx("relative grid size-5 place-items-center rounded-full font-mono text-[10px]", on ? "bg-void text-platinum" : ok ? "bg-flare text-void" : "border border-line-2")}>
                {ok && !on ? <Check size={11} /> : i + 1}
              </span>
              <span className="relative hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-2 bg-line-2 sm:w-3" />}
          </li>
        );
      })}
    </ol>
  );
}

export function StepTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
      <div className="font-mono text-[10px] tracking-[0.24em] text-flare uppercase">{kicker}</div>
      <h2 className="mt-2 text-[clamp(24px,2.4vw,32px)] leading-[1.08] font-medium tracking-[-0.03em]">{title}</h2>
      {text && <p className="mt-2 text-[13.5px] leading-relaxed text-chrome">{text}</p>}
    </motion.div>
  );
}

/** Option button used for the sentence-style requirement form. */
export function Pick<T extends string | number | null>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="relative inline-flex align-baseline">
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.v) === e.target.value);
          if (o) onChange(o.v);
        }}
        className="cursor-pointer appearance-none rounded-lg border-b-2 border-flare/60 bg-flare/[0.08] px-2 py-0.5 font-medium text-flare outline-none hover:bg-flare/[0.14] focus:border-flare"
      >
        {options.map((o) => (
          <option key={String(o.v)} value={String(o.v)} className="bg-panel text-platinum">
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
