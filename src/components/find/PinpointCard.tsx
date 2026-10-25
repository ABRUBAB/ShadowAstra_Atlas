import { Link } from "react-router-dom";
import { Crosshair } from "lucide-react";
import { formatCoord } from "../../lib/geo";
import { usePinpoint } from "../../lib/pinpoint";
import { useValidation } from "../../lib/validation";
import type { TaskId } from "../../data/sites";
import { KindBadge } from "../ui/kit";

/** What the 66-site test of the pinpoint found, in one plain sentence. */
export function pinpointVerdict(t: NonNullable<ReturnType<typeof useValidation>["v"]>["pinpoint"]) {
  if (!t) return null;
  const a = t.all;
  const pct = Math.round(a.median_rank * 100);
  return t.works
    ? `Tested on ${a.n} real field sites: the 10 km piece holding the site ranks in the best ${pct}% of the place's pieces on average (chance is 50%).`
    : `Tested on ${a.n} real field sites, the piece holding the site ranks at ${pct}% on average where chance is 50%: a slight lean, not a clear one (p = ${a.sign_test_p.toFixed(2)}). Treat it as a ground-shape hint, not a prediction.`;
}

/** The best 10 km spot inside a 55 km place, for the chosen target. */
export function PinpointCard({ lat, lon, targetHist, targetId, targetName, task }: { lat: number; lon: number; targetHist: number[]; targetId: string; targetName: string; task: TaskId }) {
  const pin = usePinpoint(lat, lon, targetHist);
  const { v } = useValidation();
  const verdict = pinpointVerdict(v?.pinpoint);
  return (
    <div className="surface mt-4 rounded-2xl p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] text-platinum">
          <Crosshair size={14} className="text-flare" /> Best 10 km spot <KindBadge kind="computed" />
        </span>
        <span className="font-mono text-[10px] tracking-wider text-dim uppercase">SRTM · 1.2 km grid</span>
      </div>
      {pin === null && <div className="shimmer mt-3 h-[58px] rounded-xl" />}
      {pin === "failed" && <p className="mt-2 text-[12px] text-dim">The terrain tiles for this place could not be loaded.</p>}
      {pin && pin !== "failed" && (
        <>
          <p className="mt-2 text-[12.5px] leading-relaxed text-chrome">
            Of the {pin.windows} pieces of 10 km inside this place, the one at <span className="font-mono text-platinum">{formatCoord(pin.best.lat, pin.best.lon)}</span> has slopes most like {targetName}: {Math.round(pin.best.score * 100)}% alike, against {Math.round(pin.mean * 100)}% for an average piece. It is drawn as a square on the close-up map.
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
            {[
              ["Slopes alike", `${Math.round(pin.best.score * 100)}%`],
              ["Average slope", `${pin.best.meanSlope.toFixed(1)}°`],
              ["Height range", `${Math.round(pin.best.relief)} m`],
            ].map(([a, b]) => (
              <div key={a} className="bg-panel px-2 py-2">
                <dt className="text-[10.5px] text-dim">{a}</dt>
                <dd className="font-mono text-[14px] text-platinum">{b}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Link to={`/lab?earth=@${pin.best.lat.toFixed(3)},${pin.best.lon.toFixed(3)}&target=${targetId}&task=${task}`} className="text-[12px] text-flare hover:underline">
              Compare this spot in 3D
            </Link>
            {pin.missing > 0.05 && <span className="text-[11px] text-dim">{Math.round(pin.missing * 100)}% of heights missing here</span>}
          </div>
        </>
      )}
      {verdict && <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-dim">{verdict}</p>}
    </div>
  );
}
