import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Check, Minus } from "lucide-react";
import { WorldDot } from "../ui/Chrome";
import { EASE, Kicker } from "../ui/kit";
import { MINERAL_INFO, type Grid, type MineralFamily } from "../../lib/grid";
import type { Validation } from "../../lib/validation";

const ROW = "mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12";
const SERIES = [
  { id: "formula", label: "Our formula", color: "var(--color-chart-1)" },
  { id: "learned", label: "Terrain AI", color: "var(--color-chart-2)" },
  { id: "both", label: "Half and half", color: "var(--color-chart-3)" },
] as const;

function Wait({ h = 240 }: { h?: number }) {
  return <div className="grid place-items-center text-[12px] text-dim" style={{ height: h }}>Loading the test results…</div>;
}

function Decision({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]", ok ? "border-strong/40 bg-strong/10 text-strong" : "border-line-2 text-chrome")}>
      {ok ? <Check size={12} /> : <Minus size={12} />} {children}
    </span>
  );
}

/** Grouped horizontal bars: ground shape alone, formula vs terrain AI vs both, on three tests. */
function ShapeBars({ ai }: { ai: NonNullable<Validation["terrain_ai"]> }) {
  const groups = [
    { label: "Known sites", sub: `${ai.known?.n ?? 0} site and world pairs`, d: ai.known },
    { label: "New test sites", sub: `${ai.independent?.n ?? 0} sites never used for training`, d: ai.independent },
    { label: "Expert pairs", sub: `${ai.pairs?.n ?? 0} Earth site and target pairs`, d: ai.pairs },
  ];
  const max = 80;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-chrome">
        {SERIES.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="text-dim">ground shape alone · typical rank, top % of land · shorter is better</span>
      </div>
      <div className="space-y-5">
        {groups.map((g, gi) =>
          g.d ? (
            <div key={g.label}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-platinum">{g.label}</span>
                <span className="text-[11px] text-dim">{g.sub}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {SERIES.map((s, si) => {
                  const val = g.d![s.id];
                  const best = val === Math.min(g.d!.formula, g.d!.learned, g.d!.both);
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                        <motion.span
                          className="block h-full rounded-r-[4px]"
                          style={{ background: s.color }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${Math.min(100, (val / max) * 100)}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, ease: EASE, delay: gi * 0.1 + si * 0.05 }}
                        />
                      </span>
                      <span className={clsx("w-14 text-right font-mono text-[12px] tabular-nums", best ? "text-platinum" : "text-dim")}>{val.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Before and after for one comparison: a dot for "without", an arrow to "with". */
function Dumbbell({ label, sub, without, withV }: { label: string; sub: string; without: number; withV: number }) {
  const max = Math.max(without, withV) * 1.3 || 1;
  const better = withV < without - 0.05;
  const worse = withV > without + 0.05;
  const tone = better ? "var(--color-strong)" : worse ? "var(--color-weak)" : "var(--color-chrome)";
  const a = (without / max) * 100;
  const b = (withV / max) * 100;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,1.1fr)_92px] items-center gap-3 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-platinum">{label}</div>
        <div className="truncate text-[11px] text-dim">{sub}</div>
      </div>
      <div className="relative h-3">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <motion.span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full" style={{ background: tone, left: `${Math.min(a, b)}%` }} initial={{ width: 0 }} whileInView={{ width: `${Math.abs(b - a)}%` }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }} />
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-chrome bg-void" style={{ left: `${a}%` }} />
        <motion.span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: tone }} initial={{ left: `${a}%` }} whileInView={{ left: `${b}%` }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }} />
      </div>
      <div className="text-right font-mono text-[11.5px] tabular-nums">
        <span className="text-dim">{without.toFixed(1)}</span>
        <span className="text-dim"> → </span>
        <span style={{ color: tone }}>{withV.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function Minerals({ m }: { m: NonNullable<Validation["minerals"]> }) {
  const md = m.model;
  const rows: { label: string; sub: string; without?: number; withV?: number }[] = [];
  if (md) {
    rows.push(
      { label: "Learned model · hidden known sites", sub: `${md.hidden.all.n} pairs · ${md.hidden.all.with_better} better, ${md.hidden.all.with_worse} worse`, without: md.hidden.all.without.median, withV: md.hidden.all.with.median },
      { label: "Learned model · where EMIT can see", sub: `${md.hidden.emit_seen.n} known sites in dry, bare land`, without: md.hidden.emit_seen.without.median, withV: md.hidden.emit_seen.with.median },
      { label: "Learned model · 28 new sites", sub: `${md.independent.all.with_better} better, ${md.independent.all.with_worse} worse`, without: md.independent.all.without.median, withV: md.independent.all.with.median },
    );
  }
  rows.push(
    { label: "Rocks & craters · known Mars sites", sub: `${m.known.n} sites, their own jobs · ${m.known.better ?? 0} better, ${m.known.worse ?? 0} worse`, without: m.known.without, withV: m.known.with },
    { label: "Rocks & craters · new Mars sites", sub: `${m.independent.n} sites · ${m.independent.better ?? 0} better, ${m.independent.worse ?? 0} worse`, without: m.independent.without, withV: m.independent.with },
  );
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-chrome">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full border border-chrome" /> without minerals
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-strong" /> with, better
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-weak" /> with, worse
        </span>
        <span className="text-dim">typical rank, top % of land</span>
      </div>
      {rows.filter((r) => r.without !== undefined && r.withV !== undefined).map((r) => (
        <Dumbbell key={r.label} label={r.label} sub={r.sub} without={r.without!} withV={r.withV!} />
      ))}
      <div className="mt-4 flex flex-wrap gap-2">
        {md && <Decision ok={md.decision === "with"}>{md.decision === "with" ? "Minerals help the model" : "Left out of the learned model"}</Decision>}
        <Decision ok={m.shipped}>{m.shipped ? "Counted in Rocks & craters for Jezero, Gale, Meridiani and Mawrth" : "Shown as facts, not scored"}</Decision>
      </div>
    </div>
  );
}

function OtherSide({ grid }: { grid: Grid }) {
  const moon = grid.meta.targets.filter((t) => t.body === "moon" && t.resources?.temp_avg_c !== undefined);
  const mars = grid.meta.targets.filter((t) => t.body === "mars" && t.resources);
  const c = (x?: number) => (x === undefined ? "n/a" : `${Math.round(x)} °C`);
  const p = (x?: number) => (x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="surface overflow-x-auto rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[14px] text-platinum">
          <WorldDot world="moon" /> Moon south pole · LRO Diviner
        </div>
        <table className="mt-3 w-full min-w-[420px] text-left text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] tracking-wide text-dim uppercase">
              <th className="py-1.5 font-normal">Within 10 km of</th>
              <th className="py-1.5 text-right font-normal">Average</th>
              <th className="py-1.5 text-right font-normal">Warmest</th>
              <th className="py-1.5 text-right font-normal">Ice at surface</th>
              <th className="py-1.5 text-right font-normal">Ice in top 1 m</th>
            </tr>
          </thead>
          <tbody>
            {moon.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="py-2 text-chrome">{t.name}</td>
                <td className="py-2 text-right font-mono text-platinum tabular-nums">{c(t.resources!.temp_avg_c)}</td>
                <td className="py-2 text-right font-mono text-platinum tabular-nums">{c(t.resources!.temp_max_c)}</td>
                <td className="py-2 text-right font-mono text-platinum tabular-nums">{p(t.resources!.ice_surface_share)}</td>
                <td className="py-2 text-right font-mono text-platinum tabular-nums">{p(t.resources!.ice_1m_share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-dim">Yearly average and typical warmest ground temperature, and where water ice could survive for a billion years, from Diviner's polar resource product (Paige et al.). Earth's coldest ground never gets near this.</p>
      </div>
      <div className="surface overflow-x-auto rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[14px] text-platinum">
          <WorldDot world="mars" /> Mars · Odyssey GRS and published minerals
        </div>
        <table className="mt-3 w-full min-w-[420px] text-left text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] tracking-wide text-dim uppercase">
              <th className="py-1.5 font-normal">Target</th>
              <th className="py-1.5 text-right font-normal">Water in topsoil</th>
              <th className="py-1.5 pl-4 font-normal">Water-made minerals</th>
            </tr>
          </thead>
          <tbody>
            {mars.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="py-2 text-chrome">{t.name}</td>
                <td className="py-2 text-right font-mono text-platinum tabular-nums">{t.resources?.h2o_wt_pct == null ? "n/a" : `${t.resources.h2o_wt_pct.toFixed(1)}%`}</td>
                <td className="py-2 pl-4 text-platinum">{t.minerals ? t.minerals.families.map((f) => MINERAL_INFO[f as MineralFamily].label).join(", ") : <span className="text-dim">none mapped</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-dim">Water-equivalent hydrogen by weight in the top tens of centimetres, 5° map (Boynton et al. 2007). Minerals from CRISM, OMEGA, TES and the rovers, as published.</p>
      </div>
    </div>
  );
}

/** How it works: the October additions (terrain AI, EMIT minerals, Moon and Mars measurements), each with its test. */
export function NewEvidence({ v, grid }: { v: Validation | null; grid: Grid | null }) {
  const ai = v?.terrain_ai;
  const fs = ai?.full_score;
  const m = v?.minerals;
  return (
    <section id="new-evidence" className="relative border-t border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="04">New evidence</Kicker>
        <h2 className="mt-6 max-w-[980px] text-[clamp(32px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.04em]">
          Three new kinds of data. <span className="font-serif font-normal text-flare italic">Each one tested before it counts.</span>
        </h2>
        <p className="mt-5 max-w-[720px] text-[15px] leading-relaxed text-chrome">
          A rule we keep: new data only changes the score if it ranks the known sites better. Otherwise we show it as a fact and say so here.
        </p>

        <div className={ROW}>
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">A terrain AI that reads the ground</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              On two Kaggle T4 GPUs we trained a vision transformer (DINO, self-supervised) on 50 km height maps from Earth, the Moon and Mars, with an extra part that stops it from simply telling the worlds apart.{" "}
              {ai?.minutes ? `${ai.minutes} minutes of training, ${ai.steps?.toLocaleString()} steps.` : ""}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              For ground shape alone it ranks the known and the new test sites higher than our formula, and ties on the pairs experts chose. It now powers the AI twin finder.
            </p>
            {fs && (
              <p className="mt-3 text-[13px] leading-relaxed text-dim">
                In the full score, where the learned model already counts for most, the AI does not add more: known sites top {fs.formula.known_median.toFixed(1)}% with the formula, {fs.learned.known_median.toFixed(1)}% with the AI and {fs.both.known_median.toFixed(1)}% with both; new sites {fs.formula.independent_median.toFixed(1)}%, {fs.learned.independent_median.toFixed(1)}% and {fs.both.independent_median.toFixed(1)}%.{" "}
                {fs.best_on_known === "formula" ? "So the formula stays the default, and you can pick the terrain AI in step 3 of Find new sites." : "So the site now uses it by default."}
              </p>
            )}
            <Link to="/atlas?body=mars&spot=18.40,77.60" className="link-wipe mt-5 inline-flex items-center gap-1.5 text-[13px] text-chrome">
              Try AI twins for Jezero crater <ArrowRight size={13} />
            </Link>
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{ai?.known ? <ShapeBars ai={ai} /> : <Wait />}</div>
        </div>

        <div className={ROW}>
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">Minerals from orbit, with NASA EMIT</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              EMIT, a spectrometer on the space station, maps the minerals of Earth's dry, bare land. We grouped them the way Mars scientists do: clays, sulfates, carbonates and iron oxides, the minerals water leaves behind.{" "}
              {m ? `${m.emit_places.toLocaleString()} of our land areas have a clear view.` : ""}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              A good sign: the strongest gypsum EMIT sees is the Qaidam basin and the strongest hematite the Pilbara, both well-known Mars analogs. We tested minerals twice, as an input to the learned model and as part of Rocks & craters for the Mars targets where orbiters found these minerals.
              {m && !m.shipped && m.model?.decision !== "with" ? " Neither ranked the known test sites better, so minerals are shown as measured facts and do not change any score." : ""}
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-dim">Every place report now shows its EMIT minerals next to the target's.</p>
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{m ? <Minerals m={m} /> : <Wait />}</div>
        </div>

        <div className="mt-16">
          <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">Measured on the Moon and Mars side too</h3>
          <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-chrome">
            Reports used to say "water ice: likely nearby". Now they show NASA measurements for the target itself. We read only the few kilometres around each target from Diviner's 605 MB table, straight from NASA's Planetary Data System.
          </p>
          <div className="mt-6">{grid ? <OtherSide grid={grid} /> : <Wait h={200} />}</div>
        </div>
      </div>
    </section>
  );
}
