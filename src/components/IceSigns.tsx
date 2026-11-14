/**
 * "Signs of ice" for a Moon target on Compare: three LRO instruments, three different clues
 * (Diviner cold, LEND neutrons, Mini-RF radar). Measured facts from pipeline/s20 and s26; never scored.
 */
import { motion } from "motion/react";
import { EASE, KindBadge } from "./ui/kit";
import type { TargetResources } from "../lib/grid";
import { CPR_CAVEAT, CPR_PLAIN, LEND_CAVEAT, LEND_PLAIN, LEND_REF, LEND_VERDICT, cprCovered, cprRefLabel, lendTone, pctShort, signedPct, tempC, type LendTone } from "../lib/iceSigns";

const TONE: Record<LendTone, string> = {
  clear: "var(--color-strong)",
  slight: "var(--color-partial)",
  none: "var(--color-chrome)",
  more: "var(--color-chrome)",
  rock: "var(--color-chrome)",
};

function Tile({ k, i, children }: { k: string; i: number; children: React.ReactNode }) {
  return (
    <motion.div className="flex flex-col bg-panel p-5 sm:p-6" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.07 }}>
      <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">{k}</div>
      {children}
    </motion.div>
  );
}

function Big({ value, unit }: { value: string; unit?: string }) {
  return (
    <div className="mt-3 flex items-baseline gap-2">
      <span className="text-[28px] leading-none font-light tracking-tight text-platinum tabular-nums">{value}</span>
      {unit && <span className="font-mono text-[12px] text-chrome">{unit}</span>}
    </div>
  );
}

function Verdict({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-platinum">
      <span className="mt-[5px] size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

const Explain = ({ text, caveat }: { text: string; caveat: string }) => (
  <div className="mt-auto pt-4">
    <p className="text-[12px] leading-relaxed text-chrome">{text}</p>
    <p className="mt-1.5 text-[11px] leading-relaxed text-dim">{caveat}</p>
  </div>
);

export function IceSigns({ res, targetName, lat }: { res: TargetResources; targetName: string; lat: number }) {
  const tone = lendTone(res, lat);
  const polarIce = res.ice_surface_share !== undefined;
  const covered = cprCovered(res);
  const ratio = covered && res.cpr_ref_median ? res.cpr_median! / res.cpr_ref_median : null;
  const around = cprRefLabel(res);
  const iceShare = res.ice_surface_share ?? 0;
  return (
    <div className="surface rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Measured from orbit</div>
          <h3 className="mt-1 text-[19px] font-medium tracking-tight">Signs of ice at {targetName}</h3>
          <p className="mt-1 max-w-[680px] text-[13px] leading-relaxed text-chrome">
            Three instruments on NASA's Lunar Reconnaissance Orbiter, three different clues. Shown as facts: they do not change the score, and no place on Earth has ground like this.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <KindBadge kind="computed" />
          <KindBadge kind="gap" />
        </div>
      </div>

      <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        <Tile k="Diviner · cold enough?" i={0}>
          {polarIce ? (
            <>
              <Big value={pctShort(res.ice_surface_share!)} unit="of the ground" />
              <div className="mt-1.5 text-[12.5px] text-chrome">
                within {Math.round(res.radius_km ?? 10)} km could keep ice at the surface; {pctShort(res.ice_1m_share ?? 0)} within 1 m of it
              </div>
              <Verdict color={iceShare >= 0.5 ? "var(--color-strong)" : iceShare >= 0.1 ? "var(--color-partial)" : "var(--color-chrome)"}>
                {iceShare >= 0.5 ? "Cold enough for ice on most of this ground" : iceShare >= 0.1 ? "Cold enough for ice on part of this ground" : "Cold enough for ice on little of this ground"}
              </Verdict>
            </>
          ) : (
            <>
              <Big value={res.temp_max_c === undefined ? "n/a" : tempC(res.temp_max_c)} unit="at noon" />
              <div className="mt-1.5 text-[12.5px] text-chrome">{res.temp_min_c === undefined ? "" : `${tempC(res.temp_min_c)} before dawn.`}</div>
              <Verdict color="var(--color-chrome)">Far too warm for ice to last at the surface</Verdict>
            </>
          )}
          <Explain text="Ground temperature from LRO Diviner. Water ice lasts for ages only where the ground never warms above about −163 °C (110 K)." caveat="It tells where ice could survive, not whether ice is there." />
        </Tile>

        <Tile k="LEND · neutrons" i={1}>
          {res.lend_dip_pct !== undefined && tone ? (
            <>
              <Big value={signedPct(res.lend_dip_pct)} unit={`± ${res.lend_dip_err_pct!.toFixed(1)}%`} />
              <div className="mt-1.5 text-[12.5px] text-chrome">
                neutrons within {Math.round(res.lend_radius_km ?? 15)} km, against {LEND_REF}
              </div>
              <Verdict color={TONE[tone]}>{LEND_VERDICT[tone]}</Verdict>
            </>
          ) : (
            <div className="mt-3 text-[15px] text-chrome">not covered</div>
          )}
          <Explain text={LEND_PLAIN} caveat={LEND_CAVEAT} />
        </Tile>

        <Tile k="Mini-RF · radar" i={2}>
          {covered ? (
            <>
              <Big value={res.cpr_median!.toFixed(2)} unit="median CPR" />
              <div className="mt-1.5 text-[12.5px] text-chrome">
                within {Math.round(res.cpr_radius_km ?? 10)} km; {pctShort(res.cpr_above1_share ?? 0)} of the ground above 1
                {res.cpr_ref_median !== undefined ? `. For ${around}: ${res.cpr_ref_median.toFixed(2)} and ${pctShort(res.cpr_ref_above1_share ?? 0)}` : ""}
                {res.cpr_coverage !== undefined && res.cpr_coverage < 0.9 ? `. The radar map covers ${pctShort(res.cpr_coverage)} of this circle.` : ""}
              </div>
              {ratio !== null && (
                <Verdict color="var(--color-chrome)">{ratio >= 1.1 ? `A rougher radar echo than ${around}` : ratio <= 0.9 ? `A smoother radar echo than ${around}` : `Much like ${around}`}</Verdict>
              )}
            </>
          ) : (
            <div className="mt-3 text-[15px] text-chrome">not covered by the radar map here</div>
          )}
          <Explain text={CPR_PLAIN} caveat={CPR_CAVEAT} />
        </Tile>
      </div>
    </div>
  );
}
