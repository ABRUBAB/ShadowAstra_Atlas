/**
 * Small SVG charts for the How it works page. Marks follow one spec: 2px lines, dots
 * with a 2px surface ring, hairline axes, text in text colours (never the series colour),
 * a legend for two or more series, and hover targets of at least 24px.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { Table2 } from "lucide-react";
import { EASE } from "../ui/kit";

export const SERIES = {
  model: { label: "Learned model", color: "var(--color-chart-1)" },
  blend: { label: "What the site shows (60% model)", color: "var(--color-chart-2)" },
  formula: { label: "Mission factors only", color: "var(--color-chart-3)" },
  baseline: { label: "Simple rule", color: "var(--color-chart-4)" },
} as const;
export type SeriesId = keyof typeof SERIES;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** "top X%" on a log scale: 0.1% on the left (best), all land on the right. */
const LO = Math.log10(0.1);
const HI = Math.log10(100);
const logX = (pct: number, x0: number, x1: number) => x0 + ((Math.log10(Math.min(100, Math.max(0.1, pct))) - LO) / (HI - LO)) * (x1 - x0);
const TICKS = [0.1, 1, 10, 100];
const tickLabel = (t: number) => (t === 100 ? "all land" : `top ${t}%`);

export function Tooltip({ x, y, children, w }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(8, x - 110), Math.max(8, w - 228));
  return (
    <div className="pointer-events-none absolute z-20 w-[220px] rounded-xl border border-line-2 bg-panel px-3 py-2.5 text-[12px] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]" style={{ left, top: y }}>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "dot" | "line" }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-chrome">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          {it.kind === "line" ? <span className="h-0.5 w-4 rounded-full" style={{ background: it.color }} /> : <span className="size-2.5 rounded-full" style={{ background: it.color }} />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-pressed={open} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-chrome transition-colors hover:border-chrome hover:text-platinum">
      <Table2 size={12} /> {open ? "Show chart" : "Show table"}
    </button>
  );
}

/* ------------------------------------------------------------------ rank strip */

export interface StripPoint {
  id: string;
  name: string;
  sub?: string;
  values: Partial<Record<SeriesId, number>>;
}

/**
 * One row per method, one dot per site, on the shared "top X% of land" scale.
 * A vertical tick marks each row's median; a thin bar its 95% interval.
 */
export function RankStrip({ points, rows, medians }: { points: StripPoint[]; rows: SeriesId[]; medians: Partial<Record<SeriesId, { median: number; ci?: [number | null, number | null] }>> }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ row: SeriesId; i: number } | null>(null);
  const [table, setTable] = useState(false);
  const rowH = 64;
  const padL = w < 640 ? 12 : 196;
  const padR = 24;
  const top = 18;
  const H = top + rows.length * rowH + 34;
  const x = (v: number) => logX(v, padL, Math.max(padL + 10, w - padR));
  // deterministic jitter so dots with equal values stay readable
  const jit = useMemo(() => points.map((_, i) => (((i * 7919) % 13) / 12 - 0.5) * 22), [points]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const ri = Math.floor((py - top) / rowH);
    if (ri < 0 || ri >= rows.length) return setHover(null);
    const row = rows[ri];
    let best = -1;
    let bd = 26;
    points.forEach((p, i) => {
      const v = p.values[row];
      if (v === undefined) return;
      const d = Math.hypot(x(v) - px, top + ri * rowH + rowH / 2 + jit[i] - py);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best >= 0 ? { row, i: best } : null);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend items={rows.map((r) => ({ label: SERIES[r].label, color: SERIES[r].color }))} />
        <TableToggle open={table} onToggle={() => setTable((t) => !t)} />
      </div>
      {table ? (
        <div className="max-h-[420px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 bg-panel text-[10.5px] tracking-wide text-dim uppercase">
              <tr>
                <th className="px-3 py-2 font-normal">Site</th>
                {rows.map((r) => (
                  <th key={r} className="px-3 py-2 text-right font-normal">
                    {SERIES[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-3 py-1.5 text-platinum">{p.name}</td>
                  {rows.map((r) => (
                    <td key={r} className="px-3 py-1.5 text-right font-mono text-chrome tabular-nums">
                      {p.values[r] === undefined ? "–" : `${p.values[r]!.toFixed(1)}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          {w > 0 && (
            <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Where each test site ranks among all land, per method">
              {TICKS.map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={top - 6} y2={top + rows.length * rowH} style={{ stroke: "var(--color-line)" }} />
                  <text x={x(t)} y={H - 10} textAnchor="middle" className="font-mono" style={{ fill: "var(--color-dim)", fontSize: 10.5 }}>
                    {tickLabel(t)}
                  </text>
                </g>
              ))}
              {rows.map((r, ri) => {
                const cy = top + ri * rowH + rowH / 2;
                const m = medians[r];
                return (
                  <g key={r}>
                    {w >= 640 && (
                      <text x={0} y={cy + 4} style={{ fill: "var(--color-chrome)", fontSize: 12.5 }}>
                        {SERIES[r].label.replace(" (60% model)", "")}
                      </text>
                    )}
                    {m?.ci && m.ci[0] !== null && m.ci[1] !== null && (
                      <motion.rect initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 + ri * 0.12 }} x={x(m.ci[0]!)} y={cy - 2} width={Math.max(2, x(m.ci[1]!) - x(m.ci[0]!))} height={4} rx={2} style={{ fill: SERIES[r].color, opacity: 0.28 }} />
                    )}
                    {points.map((p, i) => {
                      const v = p.values[r];
                      if (v === undefined) return null;
                      const on = hover?.i === i;
                      return (
                        <motion.circle
                          key={p.id}
                          initial={{ cx: x(100), opacity: 0 }}
                          whileInView={{ cx: x(v), opacity: 1 }}
                          viewport={{ once: true, margin: "-40px" }}
                          transition={{ duration: 1.1, ease: EASE, delay: ri * 0.12 + (i % 10) * 0.02 }}
                          cy={cy + jit[i]}
                          r={on ? 6.5 : 4.5}
                          style={{ fill: SERIES[r].color, stroke: "var(--color-panel)", strokeWidth: 2, opacity: hover && !on ? 0.35 : 1 }}
                        />
                      );
                    })}
                    {m && (
                      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 + ri * 0.12 }}>
                        <line x1={x(m.median)} x2={x(m.median)} y1={cy - 18} y2={cy + 18} style={{ stroke: "var(--color-platinum)", strokeWidth: 2 }} />
                        <text x={x(m.median)} y={cy - 22} textAnchor="middle" className="font-mono" style={{ fill: "var(--color-platinum)", fontSize: 11 }}>
                          {m.median < 10 ? m.median.toFixed(1) : Math.round(m.median)}%
                        </text>
                      </motion.g>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
          {hover && w > 0 && (
            <Tooltip x={x(points[hover.i].values[hover.row]!)} y={top + rows.indexOf(hover.row) * rowH + rowH} w={w}>
              <div className="font-mono text-[15px] text-platinum">top {points[hover.i].values[hover.row]!.toFixed(1)}%</div>
              <div className="mt-0.5 text-platinum">{points[hover.i].name}</div>
              {points[hover.i].sub && <div className="mt-1 text-[11px] leading-snug text-dim">{points[hover.i].sub}</div>}
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-chrome">
                <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[hover.row].color }} /> {SERIES[hover.row].label}
              </div>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ slope chart */

export interface SlopeRow {
  id: string;
  name: string;
  own: number;
  other: number;
}

/** Each line is a site: its rank under other jobs (left) and under its own job (right). */
export function JobSlope({ rows }: { rows: SlopeRow[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const H = 340;
  const x0 = 92;
  const x1 = Math.max(x0 + 80, w - 100);
  const y = (pct: number) => 16 + ((Math.log10(Math.min(100, Math.max(0.1, pct))) - LO) / (HI - LO)) * (H - 48);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const f = Math.min(1, Math.max(0, (px - x0) / (x1 - x0)));
    let best = -1;
    let bd = 14;
    rows.forEach((row, i) => {
      const yy = y(row.other) + (y(row.own) - y(row.other)) * f;
      const d = Math.abs(yy - py);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best >= 0 ? best : null);
  };
  const up = "var(--color-chart-1)";
  const down = "var(--color-dim)";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={[
            { label: "Ranks higher with its own job", color: up, kind: "line" },
            { label: "Ranks lower", color: down, kind: "line" },
          ]}
        />
        <TableToggle open={table} onToggle={() => setTable((t) => !t)} />
      </div>
      {table ? (
        <div className="max-h-[360px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 bg-panel text-[10.5px] tracking-wide text-dim uppercase">
              <tr>
                <th className="px-3 py-2 font-normal">Site</th>
                <th className="px-3 py-2 text-right font-normal">Other jobs</th>
                <th className="px-3 py-2 text-right font-normal">Its own job</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-1.5 text-platinum">{r.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-chrome tabular-nums">{r.other.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono text-chrome tabular-nums">{r.own.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          {w > 0 && (
            <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Rank of each site under other jobs and under its own job">
              {TICKS.map((t) => (
                <g key={t}>
                  <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} style={{ stroke: "var(--color-line)" }} />
                  <text x={x0 - 10} y={y(t) + 4} textAnchor="end" className="font-mono" style={{ fill: "var(--color-dim)", fontSize: 10.5 }}>
                    {tickLabel(t)}
                  </text>
                </g>
              ))}
              <text x={x0} y={H - 6} textAnchor="middle" style={{ fill: "var(--color-chrome)", fontSize: 12 }}>
                Other jobs
              </text>
              <text x={x1} y={H - 6} textAnchor="middle" style={{ fill: "var(--color-chrome)", fontSize: 12 }}>
                Its own job
              </text>
              {rows.map((r, i) => {
                const better = r.own < r.other;
                const on = hover === i;
                return (
                  <motion.g key={r.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.015 }} style={{ opacity: hover !== null && !on ? 0.18 : 1 }}>
                    <motion.line
                      x1={x0}
                      y1={y(r.other)}
                      initial={{ x2: x0, y2: y(r.other) }}
                      whileInView={{ x2: x1, y2: y(r.own) }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, ease: EASE, delay: 0.2 + i * 0.015 }}
                      style={{ stroke: better ? up : down, strokeWidth: on ? 3 : 2, strokeLinecap: "round" }}
                    />
                    <circle cx={x0} cy={y(r.other)} r={4} style={{ fill: better ? up : down, stroke: "var(--color-panel)", strokeWidth: 2 }} />
                    <motion.circle initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.1 + i * 0.015 }} cx={x1} cy={y(r.own)} r={4} style={{ fill: better ? up : down, stroke: "var(--color-panel)", strokeWidth: 2 }} />
                  </motion.g>
                );
              })}
            </svg>
          )}
          {hover !== null && w > 0 && (
            <Tooltip x={(x0 + x1) / 2} y={Math.min(H - 90, (y(rows[hover].own) + y(rows[hover].other)) / 2 + 12)} w={w}>
              <div className="text-platinum">{rows[hover].name}</div>
              <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[12px]">
                <span className="text-dim">
                  other <span className="text-chrome">{rows[hover].other.toFixed(1)}%</span>
                </span>
                <span className="text-dim">
                  own <span className="text-platinum">{rows[hover].own.toFixed(1)}%</span>
                </span>
              </div>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ line chart (model share) */

export function MixCurve({ curve, shipped }: { curve: { mix: number; known_median: number; independent_median?: number }[]; shipped: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 280;
  const x0 = 64;
  const x1 = Math.max(x0 + 100, w - 20);
  const yTop = 14;
  const yBot = H - 40;
  const y = (pct: number) => yTop + ((Math.log10(Math.min(100, Math.max(1, pct))) - 0) / 2) * (yBot - yTop);
  const x = (m: number) => x0 + m * (x1 - x0);
  const line = (key: "known_median" | "independent_median") =>
    curve
      .filter((c) => c[key] !== undefined)
      .map((c, i) => `${i ? "L" : "M"}${x(c.mix).toFixed(1)},${y(c[key]!).toFixed(1)}`)
      .join(" ");
  const hasIndep = curve.some((c) => c.independent_median !== undefined);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = (e.clientX - r.left - x0) / (x1 - x0);
    const i = Math.round(Math.min(1, Math.max(0, m)) * (curve.length - 1));
    setHover(i);
  };
  return (
    <div>
      <div className="mb-3">
        <Legend
          items={[
            { label: "Hidden known sites (chooses the setting)", color: "var(--color-chart-1)", kind: "line" },
            ...(hasIndep ? [{ label: "New test sites (only checked)", color: "var(--color-chart-2)", kind: "line" as const }] : []),
          ]}
        />
      </div>
      <div ref={ref} className="relative">
        {w > 0 && (
          <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Typical rank of test sites against the share of the learned model">
            {[1, 10, 100].map((t) => (
              <g key={t}>
                <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} style={{ stroke: "var(--color-line)" }} />
                <text x={x0 - 10} y={y(t) + 4} textAnchor="end" className="font-mono" style={{ fill: "var(--color-dim)", fontSize: 10.5 }}>
                  {t === 100 ? "all" : `top ${t}%`}
                </text>
              </g>
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <text key={t} x={x(t)} y={H - 18} textAnchor="middle" className="font-mono" style={{ fill: "var(--color-dim)", fontSize: 10.5 }}>
                {Math.round(t * 100)}%
              </text>
            ))}
            <text x={(x0 + x1) / 2} y={H - 2} textAnchor="middle" style={{ fill: "var(--color-chrome)", fontSize: 11.5 }}>
              Share of the learned model in the score
            </text>
            <line x1={x(shipped)} x2={x(shipped)} y1={yTop} y2={yBot} style={{ stroke: "var(--color-platinum)", strokeWidth: 1 }} />
            <text x={x(shipped) + 6} y={yTop + 10} style={{ fill: "var(--color-platinum)", fontSize: 11 }}>
              our default
            </text>
            <motion.path d={line("known_median")} fill="none" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} style={{ stroke: "var(--color-chart-1)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} />
            {hasIndep && <motion.path d={line("independent_median")} fill="none" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE, delay: 0.3 }} style={{ stroke: "var(--color-chart-2)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} />}
            {hover !== null && (
              <g>
                <line x1={x(curve[hover].mix)} x2={x(curve[hover].mix)} y1={yTop} y2={yBot} style={{ stroke: "var(--color-line-2)" }} />
                <circle cx={x(curve[hover].mix)} cy={y(curve[hover].known_median)} r={4.5} style={{ fill: "var(--color-chart-1)", stroke: "var(--color-panel)", strokeWidth: 2 }} />
                {curve[hover].independent_median !== undefined && <circle cx={x(curve[hover].mix)} cy={y(curve[hover].independent_median!)} r={4.5} style={{ fill: "var(--color-chart-2)", stroke: "var(--color-panel)", strokeWidth: 2 }} />}
              </g>
            )}
          </svg>
        )}
        {hover !== null && w > 0 && (
          <Tooltip x={x(curve[hover].mix)} y={yTop + 20} w={w}>
            <div className="text-[11px] text-dim">Model share {Math.round(curve[hover].mix * 100)}%</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-chrome">
                <span className="h-0.5 w-3 rounded-full bg-[var(--color-chart-1)]" /> known
              </span>
              <span className="font-mono text-platinum">top {curve[hover].known_median}%</span>
            </div>
            {curve[hover].independent_median !== undefined && (
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-chrome">
                  <span className="h-0.5 w-3 rounded-full bg-[var(--color-chart-2)]" /> new
                </span>
                <span className="font-mono text-platinum">top {curve[hover].independent_median}%</span>
              </div>
            )}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ablation */

/** How much worse (or better) the typical rank gets when one factor is removed. */
export function Ablation({ rows }: { rows: { label: string; delta: number; detail: string }[] }) {
  const max = Math.max(5, ...rows.map((r) => Math.abs(r.delta)));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="mb-4">
        <Legend
          items={[
            { label: "Removing it makes ranks worse (it helps)", color: "var(--color-chart-2)" },
            { label: "Removing it makes ranks better", color: "var(--color-chart-3)" },
          ]}
        />
      </div>
      <ul className="space-y-3">
        {rows.map((r, i) => {
          const helps = r.delta > 0;
          const pct = (Math.abs(r.delta) / max) * 50;
          return (
            <li key={r.label} className="grid grid-cols-[minmax(110px,150px)_1fr_64px] items-center gap-3" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <span className="text-[12.5px] text-platinum">{r.label}</span>
              <span className="relative h-6">
                <span className="absolute top-0 bottom-0 left-1/2 w-px bg-line-2" />
                <motion.span
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: EASE, delay: i * 0.06 }}
                  className={clsx("absolute top-1/2 h-3 -translate-y-1/2", helps ? "left-1/2 rounded-r-[4px]" : "right-1/2 rounded-l-[4px]")}
                  style={{ background: helps ? "var(--color-chart-2)" : "var(--color-chart-3)", opacity: hover !== null && hover !== i ? 0.4 : 1 }}
                />
              </span>
              <span className="text-right font-mono text-[12px] text-chrome tabular-nums">
                {r.delta > 0 ? "+" : ""}
                {r.delta.toFixed(1)}
              </span>
              {hover === i && <span className="col-span-3 -mt-1 text-[11.5px] leading-snug text-dim">{r.detail}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
