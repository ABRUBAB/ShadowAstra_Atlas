import { motion } from "motion/react";
import { Gem } from "lucide-react";
import { MINERAL_FAMILIES, MINERAL_INFO, USE_MINERALS, type Grid, type GridTarget } from "../../lib/grid";
import { EASE, KindBadge, Meter } from "../ui/kit";

/** A mineral share as a readable percent: traces keep two decimals, nothing is "0%". */
export function sharePct(x: number) {
  if (x <= 0) return "0%";
  if (x < 0.0001) return "<0.01%";
  return `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
}

/** What NASA EMIT (on the ISS) sees in the ground of one place, next to the target's own minerals. */
export function MineralCard({ grid, k, target, targetName, compact = false }: { grid: Grid; k: number; target: GridTarget; targetName: string; compact?: boolean }) {
  if (!grid.has("f_min_clay")) return null;
  const share = grid.minerals(k);
  const fams = target.minerals?.families ?? [];
  const match = grid.mineralMatch(k, target);
  const seenCount = grid.mineralPct("clay").reduce((a, v) => a + (Number.isFinite(v) ? 1 : 0), 0);
  const moon = target.body === "moon";

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] text-platinum">
          <Gem size={14} className="text-flare" /> Minerals from orbit <KindBadge kind="computed" />
        </span>
        <span className="font-mono text-[10px] tracking-wider text-dim uppercase">NASA EMIT · ISS</span>
      </div>

      {share ? (
        <>
          {match !== null && (
            <Meter
              className="mt-3"
              value={match}
              label={<span className="text-[12.5px] text-chrome">Match with {targetName}'s minerals</span>}
              hint={`Shows ${targetName}'s ${fams.map((f) => MINERAL_INFO[f].label.toLowerCase()).join(", ")} more strongly than ${Math.round(match * 100)}% of the dry land EMIT measured.`}
            />
          )}
          <ul className="mt-3 space-y-2.5">
            {MINERAL_FAMILIES.map((f, i) => {
              const pct = grid.mineralPct(f)[k];
              const hit = fams.includes(f);
              return (
                <li key={f}>
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className={hit ? "text-platinum" : "text-chrome"}>
                      {MINERAL_INFO[f].label}
                      {!compact && <span className="ml-1.5 text-[10.5px] text-dim">{MINERAL_INFO[f].plain}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {hit && <span className="rounded-full border border-flare/40 bg-flare/10 px-1.5 py-px font-mono text-[9px] tracking-wider text-flare uppercase">at {targetName.split(" ")[0]}</span>}
                      <span className="font-mono text-platinum tabular">{sharePct(share[f])}</span>
                    </span>
                  </div>
                  <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: hit ? "var(--color-flare)" : "var(--color-chrome)", opacity: hit ? 1 : 0.55 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(pct * 100)}%` }}
                      transition={{ duration: 0.9, ease: EASE, delay: 0.05 * i }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-dim">
            Percent is the share of the ground. Bars show how this place ranks among the {seenCount.toLocaleString()} dry, bare places EMIT measured.{" "}
            {moon
              ? "The Moon never had liquid water, so it has none of these minerals: here they describe your field site, not the match."
              : fams.length
                ? `${targetName}: ${target.minerals!.source}.`
                : `No water-made minerals are mapped at ${targetName}, so they are shown, not scored.`}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-chrome">
          EMIT has no clear view of this place: plants, water, snow, cloud or towns hide the ground, or it lies beyond 52° north or south. We don't guess minerals here
          {match !== null && USE_MINERALS ? ", so the mineral match counts as neutral." : "."}
        </p>
      )}
    </div>
  );
}
