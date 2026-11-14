import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Check, Minus } from "lucide-react";
import { WorldDot } from "../ui/Chrome";
import { EASE, Kicker } from "../ui/kit";
import { MINERAL_INFO, type Grid, type GridMeta, type MineralFamily } from "../../lib/grid";
import { CPR_CAVEAT, CPR_PLAIN, LEND_CAVEAT, LEND_PLAIN, LEND_VERDICT, cprCovered, lendTone, lendValue, pctShort, signedPct } from "../../lib/iceSigns";
import { useReview, type Validation } from "../../lib/validation";
import { REPO_URL } from "../ui/Chrome";

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
  const moon = grid.meta.targets.filter((t) => t.body === "moon" && t.resources?.temp_avg_c !== undefined).sort((a, b) => a.lat - b.lat);
  const mars = grid.meta.targets.filter((t) => t.body === "mars" && t.resources);
  const c = (x?: number) => (x === undefined ? "n/a" : `${Math.round(x)} °C`);
  const p = (x?: number) => (x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
  const w = (x?: number) => (x === undefined ? "n/a" : `${x.toFixed(x < 1 ? 1 : 0)}%`);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="surface overflow-x-auto rounded-3xl p-5 sm:p-6" tabIndex={0} role="region" aria-label="Moon measurements">
        <div className="flex items-center gap-2 text-[14px] text-platinum">
          <WorldDot world="moon" /> Moon · LRO Diviner and Lunar Prospector
        </div>
        <table className="mt-3 w-full min-w-[560px] text-left text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] tracking-wide text-dim uppercase">
              <th className="py-1.5 font-normal">Target</th>
              <th className="py-1.5 text-right font-normal">Average</th>
              <th className="py-1.5 text-right font-normal">Warmest</th>
              <th className="py-1.5 text-right font-normal">Coldest night</th>
              <th className="py-1.5 text-right font-normal">Ice in top 1 m</th>
              <th className="py-1.5 text-right font-normal">Iron oxide</th>
              <th className="py-1.5 text-right font-normal">Titanium oxide</th>
            </tr>
          </thead>
          <tbody>
            {moon.map((t) => {
              const r = t.resources!;
              return (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-2 text-chrome">{t.name}</td>
                  <td className="py-2 text-right font-mono text-platinum tabular-nums">{c(r.temp_avg_c)}</td>
                  <td className="py-2 text-right font-mono text-platinum tabular-nums">{c(r.temp_max_c)}</td>
                  <td className="py-2 text-right font-mono text-platinum tabular-nums">{r.temp_min_c === undefined ? <span className="text-dim">yearly only</span> : c(r.temp_min_c)}</td>
                  <td className="py-2 text-right font-mono text-platinum tabular-nums">{r.ice_1m_share === undefined ? <span className="text-dim">too warm</span> : p(r.ice_1m_share)}</td>
                  <td className="py-2 text-right font-mono text-platinum tabular-nums">{w(r.feo_wt_pct)}</td>
                  <td className="py-2 text-right font-mono text-platinum tabular-nums">{w(r.tio2_wt_pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-dim">
          South pole: yearly average and typical warmest ground within 10 km, and where water ice could survive for a billion years (Diviner polar resource product, Paige et al.). Away from the pole: the full day and night, from Diviner's global temperatures (Williams et al. 2017) over about 45 km; noon ground there is far too hot for ice. Iron and titanium oxide by weight from the Lunar Prospector gamma-ray spectrometer (Prettyman et al. 2006), which sees about 150 km at a time: high iron and titanium mean mare basalt, low means bright highland rock. Earth's coldest ground never gets near these temperatures.
        </p>
      </div>
      <div className="surface overflow-x-auto rounded-3xl p-5 sm:p-6" tabIndex={0} role="region" aria-label="Mars measurements">
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

/** LEND neutron dip (dot and ± 1 sigma line) and Mini-RF radar CPR at the ten Moon targets. */
function IceLooks({ rows }: { rows: GridMeta["targets"] }) {
  const S = 6; // axis from −6% to +6%
  const x = (v: number) => 50 + (Math.max(-S, Math.min(S, v)) / S) * 50;
  const ink = "var(--color-chart-2)";
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="LEND neutrons and Mini-RF radar at the ten Moon targets">
      <table className="w-full min-w-[300px] text-left text-[12.5px] sm:min-w-[600px]">
        <thead>
          <tr className="text-[10.5px] tracking-wide text-dim uppercase">
            <th className="py-1.5 font-normal">Target</th>
            <th className="hidden py-1.5 font-normal sm:table-cell">Neutrons against highland ground · LEND</th>
            <th className="py-1.5 pl-3 text-right font-normal">
              <span className="sm:hidden">Neutrons · LEND</span>
            </th>
            <th className="py-1.5 pl-4 text-right font-normal">
              Radar CPR<span className="hidden sm:inline"> · Mini-RF</span>
            </th>
            <th className="py-1.5 pl-3 text-right font-normal">Above 1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const r = t.resources!;
            const tone = lendTone(r, t.lat)!;
            const d = r.lend_dip_pct!;
            const e = r.lend_dip_err_pct!;
            const seen = r.cpr_coverage !== undefined && r.cpr_coverage < 0.9 ? r.cpr_coverage : null;
            const group = i === 0 || (rows[i - 1].lat < -60) !== (t.lat < -60) ? (t.lat < -60 ? "South pole" : "Near the equator") : null;
            return (
              <Fragment key={t.id}>
                {group && (
                  <tr>
                    <td colSpan={5} className={clsx("pb-1 font-mono text-[10px] tracking-[0.2em] text-dim uppercase", i === 0 ? "pt-2" : "pt-4")}>
                      {group}
                    </td>
                  </tr>
                )}
              <tr className="border-t border-line">
                <td className="py-2 pr-3 text-chrome">{t.name}</td>
                <td className="hidden w-[42%] py-2 sm:table-cell" title={`${t.name}: ${lendValue(r)}, ${r.lend_cells} map cells within ${r.lend_radius_km} km. ${LEND_VERDICT[tone]}.`}>
                  <div className="relative h-4">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
                    <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full" style={{ left: `${x(d - e)}%`, width: `${x(d + e) - x(d - e)}%`, background: ink }} />
                    <span
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                      style={{ left: `${x(d)}%`, borderColor: ink, background: tone === "clear" ? ink : "var(--color-panel)" }}
                    />
                  </div>
                </td>
                <td className="py-2 pl-3 text-right font-mono whitespace-nowrap text-platinum tabular-nums">{lendValue(r)}</td>
                <td className="py-2 pl-4 text-right font-mono whitespace-nowrap text-platinum tabular-nums">
                  {cprCovered(r) ? (
                    <>
                      {r.cpr_median!.toFixed(2)}
                      {seen !== null && <span className="ml-1.5 hidden text-[10.5px] text-dim sm:inline">({pctShort(seen)} mapped)</span>}
                    </>
                  ) : (
                    <span className="text-dim">not covered</span>
                  )}
                </td>
                <td className="py-2 pl-3 text-right font-mono text-platinum tabular-nums">{cprCovered(r) ? pctShort(r.cpr_above1_share ?? 0) : ""}</td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="hidden sm:table-footer-group">
          <tr>
            <td />
            <td className="pt-1.5">
              <div className="relative h-4 font-mono text-[10px] text-dim">
                {[-6, -3, 0, 3, 6].map((v) => (
                  <span key={v} className={clsx("absolute", v === -S ? "" : v === S ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${x(v)}%` }}>
                    {v === 0 ? "0" : signedPct(v, 0)}
                  </span>
                ))}
              </div>
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
      <div className="mt-3 hidden flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-chrome sm:flex">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full border-2" style={{ borderColor: ink, background: ink }} /> clear dip, at least 3 times its counting error
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full border-2" style={{ borderColor: ink, background: "var(--color-panel)" }} /> smaller, or near the equator
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-[2px] w-4 rounded-full" style={{ background: ink }} /> ± counting error
        </span>
      </div>
    </div>
  );
}

/** The LEND and Mini-RF row: what they measure, what the ten targets show (written from the data), the caveats. */
function IceRow({ grid }: { grid: Grid | null }) {
  const rows = grid ? grid.meta.targets.filter((t) => t.body === "moon" && t.resources?.lend_dip_pct !== undefined).sort((a, b) => a.lat - b.lat) : [];
  const polar = rows.filter((t) => lendTone(t.resources!, t.lat) !== "rock");
  const clear = polar.filter((t) => lendTone(t.resources!, t.lat) === "clear");
  const deepest = polar.length ? polar.reduce((a, b) => (b.resources!.lend_dip_pct! < a.resources!.lend_dip_pct! ? b : a)) : null;
  const radar = polar.filter((t) => cprCovered(t.resources!));
  const meds = radar.map((t) => t.resources!.cpr_median!);
  const most = radar.length ? radar.reduce((a, b) => ((b.resources!.cpr_above1_share ?? 0) > (a.resources!.cpr_above1_share ?? 0) ? b : a)) : null;
  const ref = radar[0]?.resources;
  const short = (name: string) => name.replace(/\s*\(.*\)$/, "");
  const word = (n: number) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
  return (
    <div className={ROW}>
      <div className="min-w-0">
        <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">Looking for the ice itself: LEND and Mini-RF</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-chrome">
          Diviner shows where ice could survive. Two more instruments on NASA's Lunar Reconnaissance Orbiter, both in the 2026 challenge resources, look for the ice itself. We read them straight from the Planetary Data System, only the ground near each target.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-chrome">
          <span className="text-platinum">LEND counts neutrons.</span> {LEND_PLAIN}{" "}
          {deepest
            ? `${word(clear.length).replace(/^./, (c) => c.toUpperCase())} of the ${word(polar.length)} south-pole targets show a clear dip against typical highland ground; the deepest is ${short(deepest.name)} (${signedPct(deepest.resources!.lend_dip_pct!)})${deepest.id === "cabeus" ? ", where NASA's LCROSS probe found water in 2009" : ""}. `
            : ""}
          Near the equator the kind of rock moves the count by a few percent (dark mare lava sends more neutrons than bright highland rock), so those three numbers say little about water.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-chrome">
          <span className="text-platinum">Mini-RF is a radar.</span> {CPR_PLAIN} {CPR_CAVEAT}{" "}
          {meds.length && ref?.cpr_ref_median !== undefined
            ? `Around the south-pole targets the median CPR is ${Math.min(...meds).toFixed(2)} to ${Math.max(...meds).toFixed(2)}, against ${ref.cpr_ref_median.toFixed(2)} for the whole polar region${most && (most.resources!.cpr_above1_share ?? 0) > 0 ? `; the most ground above 1 is at ${short(most.name)} (${pctShort(most.resources!.cpr_above1_share!)})` : ""}.`
            : ""}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-dim">
          {LEND_CAVEAT} PDS publishes LEND counts, not a water map, so we do not turn the dip into an amount of water. Both are shown as measured facts on Compare and in the printable site report.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Decision ok={false}>Shown as facts, not scored</Decision>
          <Link to="/lab?earth=dry-valleys&target=cabeus&task=polar#gaps" className="link-wipe inline-flex items-center gap-1.5 text-[13px] text-chrome">
            See the three clues for Cabeus <ArrowRight size={13} />
          </Link>
        </div>
      </div>
      <div className="surface min-w-0 rounded-3xl p-5 sm:p-6">
        {rows.length ? (
          <>
            <IceLooks rows={rows} />
            <p className="mt-4 text-[11px] leading-relaxed text-dim">
              LEND: collimated epithermal neutron counts, averaged map from 15 Sep 2009 to 11 Dec 2011 (PDS LRO-L-LEND-4/5-RDR-V1.0), map cells within 15 km of a south-pole target and 30 km elsewhere, against highland ground between 50°S and 50°N
              (Lunar Prospector iron oxide below 8%). The ± is counting noise only. Mini-RF: S-band radar circular polarization ratio within 10 km, from the south polar mosaic (118 m pixels) or the global mosaic (237 m), which saw only part of the
              three equatorial circles and is grainier, so its shares above 1 run higher; compare shares within one mosaic.
            </p>
          </>
        ) : (
          <Wait h={200} />
        )}
      </div>
    </div>
  );
}

/** How it works: the October additions (terrain AI, EMIT minerals, Moon and Mars measurements), each with its test. */
/** Where the window holding each real field site ranked among its place's 10 km windows (0 = best). */
function PinpointStrip({ t }: { t: NonNullable<Validation["pinpoint"]> }) {
  const W = 560;
  const x = (r: number) => 24 + r * (W - 48);
  const rows = [...t.rows].sort((a, b) => a.rank - b.rank);
  const lane = { known: 46, independent: 92 } as const;
  return (
    <div>
      <svg viewBox={`0 0 ${W} 150`} className="w-full" role="img" aria-label={`Rank of the window holding each of ${t.all.n} field sites: median ${Math.round(t.all.median_rank * 100)}%, chance is 50%`}>
        <line x1={x(0.5)} x2={x(0.5)} y1={18} y2={118} style={{ stroke: "var(--color-line-2)", strokeDasharray: "4 4" }} />
        <text x={x(0.5)} y={12} textAnchor="middle" style={{ fill: "var(--color-dim)", fontSize: 10.5 }}>
          chance
        </text>
        {(["known", "independent"] as const).map((g) => (
          <g key={g}>
            <text x={24} y={lane[g] - 16} style={{ fill: "var(--color-chrome)", fontSize: 11 }}>
              {g === "known" ? `Known sites (${t.known.n})` : `Independent sites (${t.independent.n})`}
            </text>
            {rows
              .filter((r) => r.group === g)
              .map((r, i) => (
                <circle key={r.id} cx={x(r.rank)} cy={lane[g] + ((i % 3) - 1) * 5} r={4} style={{ fill: g === "known" ? "var(--color-chart-1)" : "var(--color-chart-2)", fillOpacity: 0.85 }}>
                  <title>{`${r.name}: rank ${Math.round(r.rank * 100)}% of ${r.windows} windows, best window ${r.best_km_from_site} km from the site`}</title>
                </circle>
              ))}
            <line x1={x(t[g].median_rank)} x2={x(t[g].median_rank)} y1={lane[g] - 10} y2={lane[g] + 10} style={{ stroke: "var(--color-flare)", strokeWidth: 2 }} />
          </g>
        ))}
        <line x1={x(0)} x2={x(1)} y1={124} y2={124} style={{ stroke: "var(--color-line)" }} />
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <text key={r} x={x(r)} y={140} textAnchor={r === 0 ? "start" : r === 1 ? "end" : "middle"} style={{ fill: "var(--color-dim)", fontSize: 10.5 }}>
            {r === 0 ? "best window" : r === 1 ? "worst" : `${r * 100}%`}
          </text>
        ))}
      </svg>
      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
        {[
          ["Median rank", `${Math.round(t.all.median_rank * 100)}%`, "50% is chance"],
          ["In the best quarter", `${Math.round(t.all.top_quarter * 100)}%`, "25% is chance"],
          ["Sign test", `p = ${t.all.sign_test_p < 0.001 ? "< 0.001" : t.all.sign_test_p.toFixed(3)}`, `${t.all.better_half} of ${t.all.n} in the better half`],
        ].map(([a, b, c]) => (
          <div key={a} className="bg-panel px-2 py-2.5">
            <dt className="text-[10.5px] text-dim">{a}</dt>
            <dd className="font-mono text-[16px] text-platinum">{b}</dd>
            <dd className="text-[10.5px] text-dim">{c}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ExpertReview() {
  const r = useReview();
  if (!r) return null;
  const done = r.status === "done";
  return (
    <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(320px,0.55fr)_1fr] lg:gap-12">
      <div>
        <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">A geologist checks our top picks</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-chrome">
          {r.reviewer}, our scientific validation lead, rates the {r.candidates.length} strongest new candidates: every target's best new place and the two strongest runners-up. Five questions each: ground shape, rocks, cold and dryness, access, and whether he would recommend it.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-dim">
          {done ? "His verdict is shown as it came back. It does not change any score." : "Waiting for his ratings, which will be published here as they come back, good or bad. They will not change any score."}{" "}
          <a href={`${REPO_URL}/blob/main/docs/review/EXPERT_REVIEW_KIT.md`} target="_blank" rel="noreferrer" className="text-chrome underline underline-offset-2 hover:text-platinum">
            The review kit and rubric
          </a>
        </p>
      </div>
      <div className="surface rounded-3xl p-5 sm:p-6">
        {done && r.mean ? (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-center sm:grid-cols-4">
              {r.rubric
                .filter((q) => q.id !== "overall" && r.mean![q.id] !== undefined)
                .map((q) => (
                  <div key={q.id} className="bg-panel px-2 py-2.5">
                    <dt className="text-[10.5px] text-dim">{q.label}</dt>
                    <dd className="font-mono text-[18px] text-platinum">{r.mean![q.id].toFixed(1)} / 5</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-4 text-[13px] text-chrome">
              Would he recommend it? Yes for {r.overall?.yes ?? 0}, maybe for {r.overall?.maybe ?? 0}, no for {r.overall?.no ?? 0} of {r.reviewed} places.
            </p>
          </>
        ) : (
          <ol className="grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
            {r.candidates.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 border-b border-line py-1">
                <span className="font-mono text-[10.5px] text-dim">{c.id}</span>
                <span className="truncate text-chrome">{c.place}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function NewEvidence({ v, grid }: { v: Validation | null; grid: Grid | null }) {
  const ai = v?.terrain_ai;
  const fs = ai?.full_score;
  const m = v?.minerals;
  const pin = v?.pinpoint;
  return (
    <section id="new-evidence" className="relative border-t border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="04">New evidence</Kicker>
        <h2 className="mt-6 max-w-[980px] text-[clamp(32px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.04em]">
          New data, new checks. <span className="font-serif font-normal text-flare italic">Each one tested before it counts.</span>
        </h2>
        <p className="mt-5 max-w-[720px] text-[15px] leading-relaxed text-chrome">
          A rule we keep: new data only changes the score if it ranks the known sites better. Otherwise we show it as a fact and say so here.
        </p>

        <div className={ROW}>
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">A terrain AI that reads the ground</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              On two Kaggle T4 GPUs we trained a vision transformer (DINO, self-supervised) on 50 km height maps from Earth, the Moon and Mars, with an extra part that discourages it from simply telling the worlds apart (70% of its nearest neighbours still come from the same world, against 33% by chance).{" "}
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
              {m && !m.shipped && m.model?.decision !== "with" ? " As a model input they helped a little overall (1.19% to 1.14%) but made things worse where EMIT can see the ground (1.63% to 1.83%); in Rocks & craters they made the known Mars sites slightly worse (22.4% to 22.8%). So minerals are shown as measured facts and do not change any score." : ""}
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-dim">Every place report now shows its EMIT minerals next to the target's.</p>
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{m ? <Minerals m={m} /> : <Wait />}</div>
        </div>

        <div className="mt-16">
          <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">Measured on the Moon and Mars side too</h3>
          <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-chrome">
            Reports used to say "water ice: likely nearby". Now they show NASA measurements for the target itself, for all 18 targets. We read only the ground around each target from Diviner's large tables (605 MB at the pole, 156 MB per band elsewhere), straight from NASA's Planetary Data System.
          </p>
          <div className="mt-6">{grid ? <OtherSide grid={grid} /> : <Wait h={200} />}</div>
        </div>

        <IceRow grid={grid} />

        <div className={ROW}>
          <div>
            <h3 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">The best 10 km spot inside each place</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-chrome">
              A place on this site is about 55 km across; a field team works in a few kilometres. So every place report now marks the 10 km piece whose slopes are most like the target's, measured on the same 1.2 km grid as everything else. Height range is shown, not scored, because it grows with the size of the piece.
            </p>
            {pin && (
              <p className="mt-3 text-[13px] leading-relaxed text-dim">
                We tested it on the {pin.all.n} real field sites: in each one's place, where does the piece that holds the actual site rank among the {Math.round(pin.rows.reduce((a, r) => a + r.windows, 0) / pin.rows.length)} pieces?{" "}
                {pin.works
                  ? `Typically (median) in the best ${Math.round(pin.all.median_rank * 100)}%, better than chance (p = ${pin.all.sign_test_p < 0.001 ? "< 0.001" : pin.all.sign_test_p.toFixed(3)}). It still only looks at slopes, so read it as where to start looking.`
                  : `At ${Math.round(pin.all.median_rank * 100)}% typically (median), where chance is 50%: a slight lean that is not statistically clear (sign test p = ${pin.all.sign_test_p.toFixed(2)}), and the best piece is no closer to the real site than a random one (${pin.all.best_km_median} against ${pin.all.random_km_median} km). Teams pick their exact spots for reasons slopes do not show, such as a crater rim, a lava tube or a road. So the square stays a ground-shape hint, not a prediction, and it changes no score.`}
              </p>
            )}
          </div>
          <div className="surface rounded-3xl p-5 sm:p-6">{pin ? <PinpointStrip t={pin} /> : <Wait />}</div>
        </div>

        <ExpertReview />
      </div>
    </section>
  );
}
