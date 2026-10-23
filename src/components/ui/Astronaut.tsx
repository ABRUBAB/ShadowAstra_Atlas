import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";

/**
 * "Astra", the ShadowAstra field-test astronaut.
 *
 * One hand-built SVG. Expressions appear on the visor as a HUD read-out (so the
 * character stays a crewed suit, not a cartoon face). Actions swap the tool in the
 * right hand and drive calm CSS motion; every loop respects prefers-reduced-motion.
 */
export type Mood = "neutral" | "happy" | "sad" | "focused" | "thinking" | "wow" | "cold" | "hot";
export type Action = "idle" | "wave" | "scan" | "drill" | "flag" | "sample" | "celebrate" | "walk" | "slump" | "shiver" | "fan" | "point" | "binoculars";

/** Types the line out quickly, so Astra feels like he is talking. */
function useTyped(text: string | null | undefined) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!text || reduce) return;
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 2)), 16);
    return () => clearInterval(id);
  }, [text, reduce]);
  if (!text) return "";
  return reduce ? text : text.slice(0, n);
}

interface Props {
  mood?: Mood;
  action?: Action;
  say?: string | null;
  size?: number;
  className?: string;
  sayAlign?: "left" | "right" | "side";
}

export function Astronaut({ mood = "neutral", action = "idle", say, size = 160, className, sayAlign = "right" }: Props) {
  const typed = useTyped(say);
  return (
    <div className={clsx("astro-wrap relative inline-block select-none", className)} style={{ width: size }} aria-hidden={!say}>
      <AnimatePresence mode="wait">
        {say && (
          <motion.div
            key={say}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-label={say}
            className={clsx(
              "absolute z-10 w-max max-w-[220px] rounded-2xl border border-line-2 bg-panel/95 px-3 py-2 text-[12px] leading-snug text-platinum backdrop-blur",
              sayAlign === "side"
                ? "top-[18%] left-[88%] rounded-tl-sm"
                : sayAlign === "right"
                  ? "bottom-[86%] left-[58%] rounded-bl-sm"
                  : "right-[58%] bottom-[86%] rounded-br-sm",
            )}
          >
            <span aria-hidden>{typed}</span>
            <span aria-hidden className="invisible">{say.slice(typed.length)}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <svg viewBox="0 0 160 200" className="astro w-full overflow-visible" data-action={action} data-mood={mood}>
        <defs>
          <linearGradient id="astro-visor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1d2742" />
            <stop offset="1" stopColor="#090c16" />
          </linearGradient>
          <linearGradient id="astro-suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3f0ea" />
            <stop offset="1" stopColor="#cfcac0" />
          </linearGradient>
          <linearGradient id="astro-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2c879" stopOpacity="0.75" />
            <stop offset="1" stopColor="#f2c879" stopOpacity="0" />
          </linearGradient>
          <filter id="astro-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse className="astro-shadow" cx="80" cy="192" rx="30" ry="3.6" fill="#000" opacity="0.45" />

        <g className="astro-body">
          {/* backpack */}
          <rect x="50" y="76" width="60" height="58" rx="12" fill="#bdb7ac" stroke="#2f3035" strokeWidth="1.4" />
          <rect x="58" y="70" width="10" height="10" rx="3" fill="#a9a398" stroke="#2f3035" strokeWidth="1.2" />

          {/* legs */}
          <g className="astro-leg-l">
            <rect x="62" y="124" width="16" height="44" rx="7" fill="url(#astro-suit)" stroke="#2f3035" strokeWidth="1.4" />
            <rect x="58" y="162" width="22" height="13" rx="6" fill="#8d887e" stroke="#2f3035" strokeWidth="1.4" />
          </g>
          <g className="astro-leg-r">
            <rect x="82" y="124" width="16" height="44" rx="7" fill="url(#astro-suit)" stroke="#2f3035" strokeWidth="1.4" />
            <rect x="80" y="162" width="22" height="13" rx="6" fill="#8d887e" stroke="#2f3035" strokeWidth="1.4" />
          </g>

          {/* left arm (behind torso) */}
          <g className="astro-arm-l">
            <rect x="50" y="86" width="14" height="42" rx="7" fill="url(#astro-suit)" stroke="#2f3035" strokeWidth="1.4" />
            <circle cx="57" cy="131" r="6.5" fill="#8d887e" stroke="#2f3035" strokeWidth="1.4" />
            {action === "sample" && <rect x="48" y="133" width="18" height="16" rx="3" fill="#2a2b30" stroke="#3a3b40" />}
          </g>

          {/* right arm + tool */}
          <g className="astro-arm-r">
            {action === "scan" && (
              <>
                <polygon className="astro-beam" points="103,147 84,198 122,198" fill="url(#astro-beam)" />
                <rect x="96" y="128" width="14" height="18" rx="3" fill="#23242a" stroke="#3a3b40" />
                <circle cx="103" cy="145" r="2.4" fill="#f2c879" filter="url(#astro-glow)" />
              </>
            )}
            {action === "flag" && (
              <>
                <line x1="103" y1="116" x2="103" y2="190" stroke="#cfcac0" strokeWidth="2" />
                <path className="astro-flag" d="M103 168 L130 172 L128 188 L103 186 Z" fill="#edeae4" stroke="#2f3035" strokeWidth="1" />
                <circle cx="114" cy="178" r="3.4" fill="none" stroke="#07080a" strokeWidth="1.2" />
              </>
            )}
            {action === "drill" && (
              <g className="astro-drill">
                <rect x="97" y="128" width="12" height="14" rx="3" fill="#23242a" stroke="#3a3b40" />
                <line x1="103" y1="142" x2="103" y2="176" stroke="#a8a59e" strokeWidth="2.4" strokeDasharray="3 2" />
              </g>
            )}
            {action === "sample" && (
              <path d="M96 134 L104 128 L113 133 L111 142 L100 144 Z" fill="#6c6a65" stroke="#2f3035" strokeWidth="1.2" />
            )}
            {action === "point" && <circle cx="103" cy="140" r="2.6" fill="#f2c879" filter="url(#astro-glow)" className="astro-led" />}
            <rect x="96" y="86" width="14" height="42" rx="7" fill="url(#astro-suit)" stroke="#2f3035" strokeWidth="1.4" />
            <circle cx="103" cy="131" r="6.5" fill="#8d887e" stroke="#2f3035" strokeWidth="1.4" />
          </g>

          {/* binoculars, held up to the visor */}
          {action === "binoculars" && (
            <g className="astro-binos">
              <rect x="64" y="46" width="14" height="12" rx="4" fill="#23242a" stroke="#3a3b40" />
              <rect x="82" y="46" width="14" height="12" rx="4" fill="#23242a" stroke="#3a3b40" />
              <rect x="77" y="49" width="6" height="5" fill="#3a3b40" />
              <circle cx="71" cy="52" r="3" fill="#8fb4ea" opacity="0.7" />
              <circle cx="89" cy="52" r="3" fill="#8fb4ea" opacity="0.7" />
            </g>
          )}

          {/* torso */}
          <rect x="56" y="80" width="48" height="52" rx="16" fill="url(#astro-suit)" stroke="#2f3035" strokeWidth="1.4" />
          <rect x="67" y="95" width="26" height="17" rx="4" fill="#16171b" stroke="#2f3035" />
          <circle className="astro-led astro-led-1" cx="73" cy="103.5" r="2" fill="#f2c879" />
          <circle className="astro-led astro-led-2" cx="80" cy="103.5" r="2" fill="#8fb4ea" />
          <circle className="astro-led astro-led-3" cx="87" cy="103.5" r="2" fill="#7cc8a0" />
          <line x1="58" y1="120" x2="102" y2="120" stroke="#b3ada2" strokeWidth="1.2" />

          {/* helmet */}
          <g className="astro-head">
            <circle cx="80" cy="56" r="30" fill="url(#astro-suit)" stroke="#2f3035" strokeWidth="1.5" />
            <rect x="106" y="46" width="6" height="16" rx="3" fill="#bdb7ac" stroke="#2f3035" strokeWidth="1.2" />
            <circle cx="62" cy="34" r="2.2" fill="#f2c879" className="astro-lamp" />
            <rect x="57" y="40" width="46" height="32" rx="15" fill="url(#astro-visor)" stroke="#2f3035" strokeWidth="1.4" />
            <path d="M63 47 Q70 42 80 42" stroke="#fff" strokeOpacity="0.28" strokeWidth="2.4" fill="none" strokeLinecap="round" />

            {/* HUD expressions */}
            <g className="astro-face" stroke="#f2c879" fill="none" strokeWidth="2.2" strokeLinecap="round" filter="url(#astro-glow)">
              <g className="face face-neutral">
                <g className="astro-eyes">
                  <circle cx="71" cy="56" r="2.1" fill="#f2c879" stroke="none" />
                  <circle cx="89" cy="56" r="2.1" fill="#f2c879" stroke="none" />
                </g>
                <path d="M76 64 L84 64" />
              </g>
              <g className="face face-happy">
                <path d="M67 57 Q71 52 75 57" />
                <path d="M85 57 Q89 52 93 57" />
                <path d="M72 62 Q80 69 88 62" />
              </g>
              <g className="face face-sad">
                <path d="M67 54 Q71 58 75 56" />
                <path d="M85 56 Q89 58 93 54" />
                <path d="M74 66 Q80 61 86 66" />
              </g>
              <g className="face face-focused">
                <path d="M67 56 L75 56" />
                <path d="M85 56 L93 56" />
                <path d="M77 64 L83 64" />
              </g>
              <g className="face face-thinking">
                <circle cx="73" cy="54" r="2" fill="#f2c879" stroke="none" />
                <circle cx="91" cy="54" r="2" fill="#f2c879" stroke="none" />
                <path d="M78 64 Q82 62 86 64" />
              </g>
              <g className="face face-cold">
                <path d="M67 55 L75 57" />
                <path d="M85 57 L93 55" />
                <path d="M72 65 L75 62 L78 65 L81 62 L84 65 L87 62" strokeWidth="1.6" />
              </g>
              <g className="face face-hot">
                <path d="M67 55 Q71 59 75 55" />
                <path d="M85 55 Q89 59 93 55" />
                <ellipse cx="80" cy="65" rx="3.4" ry="2.4" />
              </g>
              <g className="face face-wow">
                <circle cx="71" cy="55" r="3" />
                <circle cx="89" cy="55" r="3" />
                <circle cx="80" cy="64" r="2.4" />
              </g>
            </g>
          </g>

          {/* frost creeping over the visor */}
          <g className="astro-frost" fill="none" stroke="#cfe3ff" strokeWidth="1" strokeLinecap="round">
            <path d="M58 66 l4 -3 M60 70 l5 -2 M62 62 l3 -4" />
            <path d="M102 66 l-4 -3 M100 70 l-5 -2 M98 62 l-3 -4" />
          </g>
          <g className="astro-flakes" fill="#cfe3ff">
            <circle cx="30" cy="30" r="1.6" />
            <circle cx="132" cy="44" r="1.3" />
            <circle cx="40" cy="70" r="1.1" />
            <circle cx="124" cy="80" r="1.6" />
          </g>
          {/* sweat */}
          <g className="astro-sweat" fill="#8fb4ea">
            <path d="M112 34 q3 5 0 7 q-3 -2 0 -7 Z" />
            <path d="M48 40 q3 5 0 7 q-3 -2 0 -7 Z" />
          </g>
          {/* heat shimmer */}
          <g className="astro-heat" fill="none" stroke="#e08a5f" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
            <path d="M30 120 q4 -4 0 -8 q-4 -4 0 -8" />
            <path d="M132 120 q4 -4 0 -8 q-4 -4 0 -8" />
          </g>

          {/* thought dots */}
          <g className="astro-thought" fill="#a8a59e">
            <circle cx="114" cy="26" r="2" />
            <circle cx="122" cy="18" r="2.6" />
            <circle cx="132" cy="10" r="3.2" />
          </g>
          {/* celebration sparks */}
          <g className="astro-sparks" stroke="#f2c879" strokeWidth="1.6" strokeLinecap="round">
            <path d="M34 40 L28 34" />
            <path d="M30 56 L22 56" />
            <path d="M126 40 L132 34" />
            <path d="M130 56 L138 56" />
          </g>
        </g>
      </svg>
      <style>{ASTRO_CSS}</style>
    </div>
  );
}

const ASTRO_CSS = `
.astro * { transform-box: view-box; }
.astro .astro-body { transform-origin: 80px 190px; animation: astro-float 4.2s cubic-bezier(.45,0,.55,1) infinite alternate; }
.astro .astro-shadow { transform-origin: 80px 192px; animation: astro-shadow 4.2s cubic-bezier(.45,0,.55,1) infinite alternate; }
.astro .astro-arm-l { transform-origin: 57px 90px; transform: rotate(10deg); transition: transform .8s cubic-bezier(.22,1,.36,1); }
.astro .astro-arm-r { transform-origin: 103px 90px; transform: rotate(-10deg); transition: transform .8s cubic-bezier(.22,1,.36,1); }
.astro .astro-head { transform-origin: 80px 84px; transition: transform .8s cubic-bezier(.22,1,.36,1); }
.astro .astro-leg-l { transform-origin: 70px 126px; }
.astro .astro-leg-r { transform-origin: 90px 126px; }
.astro .face { opacity: 0; transition: opacity .35s ease-out; }
.astro .astro-eyes { transform-origin: 80px 56px; animation: astro-blink 5s infinite; }
.astro .astro-thought, .astro .astro-sparks { opacity: 0; transition: opacity .4s ease-out; }
.astro .astro-led { animation: astro-led 2.4s steps(1) infinite; }
.astro .astro-led-2 { animation-delay: .8s; } .astro .astro-led-3 { animation-delay: 1.6s; }
.astro .astro-lamp { animation: astro-led 3s ease-in-out infinite; }

.astro[data-mood="neutral"] .face-neutral,
.astro[data-mood="happy"] .face-happy,
.astro[data-mood="sad"] .face-sad,
.astro[data-mood="focused"] .face-focused,
.astro[data-mood="thinking"] .face-thinking,
.astro[data-mood="wow"] .face-wow { opacity: 1; }
.astro[data-mood="thinking"] .astro-thought { opacity: 1; animation: astro-think 2.4s ease-in-out infinite; }
.astro[data-mood="thinking"] .astro-head { transform: rotate(-6deg); }
.astro[data-mood="sad"] .astro-head { transform: rotate(7deg) translateY(2px); }

.astro[data-action="wave"] .astro-arm-r { animation: astro-wave 1.6s cubic-bezier(.45,0,.55,1) infinite; }
.astro[data-action="scan"] .astro-arm-r { transform: rotate(-72deg); }
.astro[data-action="scan"] .astro-beam { animation: astro-beam 1.8s ease-in-out infinite; transform-origin: 103px 147px; }
.astro[data-action="sample"] .astro-arm-r { transform: rotate(-58deg); }
.astro[data-action="sample"] .astro-arm-l { transform: rotate(22deg); }
.astro[data-action="flag"] .astro-arm-r { transform: rotate(-168deg); }
.astro[data-action="flag"] .astro-flag { transform-origin: 103px 177px; animation: astro-flag 1.4s ease-in-out infinite; }
.astro[data-action="drill"] .astro-arm-r { transform: rotate(-14deg); }
.astro[data-action="drill"] .astro-arm-l { transform: rotate(-12deg); }
.astro[data-action="drill"] .astro-drill { animation: astro-vibe .12s linear infinite; }
.astro[data-action="celebrate"] .astro-arm-r { transform: rotate(-150deg); }
.astro[data-action="celebrate"] .astro-arm-l { transform: rotate(150deg); }
.astro[data-action="celebrate"] .astro-body { animation: astro-jump .9s cubic-bezier(.33,0,.2,1) infinite; }
.astro[data-action="celebrate"] .astro-shadow { animation: astro-jump-shadow .9s cubic-bezier(.33,0,.2,1) infinite; }
.astro[data-action="celebrate"] .astro-sparks { opacity: 1; animation: astro-spark .9s ease-out infinite; }
.astro[data-action="walk"] .astro-leg-l { animation: astro-step 1.1s ease-in-out infinite; }
.astro[data-action="walk"] .astro-leg-r { animation: astro-step 1.1s ease-in-out infinite reverse; }
.astro[data-action="walk"] .astro-arm-l { animation: astro-swing 1.1s ease-in-out infinite reverse; }
.astro[data-action="walk"] .astro-arm-r { animation: astro-swing-r 1.1s ease-in-out infinite; }
.astro[data-action="slump"] .astro-arm-r { transform: rotate(-2deg); }
.astro[data-action="slump"] .astro-arm-l { transform: rotate(2deg); }
.astro[data-action="slump"] .astro-body { animation-duration: 6s; }

@keyframes astro-float { from { transform: translateY(0); } to { transform: translateY(-5px); } }
@keyframes astro-shadow { from { transform: scaleX(1); opacity: .45; } to { transform: scaleX(.86); opacity: .3; } }
@keyframes astro-blink { 0%, 94%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
@keyframes astro-wave { 0%,100% { transform: rotate(-150deg); } 50% { transform: rotate(-118deg); } }
@keyframes astro-beam { 0%,100% { opacity: .35; transform: scaleX(.85); } 50% { opacity: .9; transform: scaleX(1.1); } }
@keyframes astro-flag { 0%,100% { transform: skewY(0deg); } 50% { transform: skewY(-7deg); } }
@keyframes astro-vibe { 0% { transform: translateX(-.5px); } 50% { transform: translateX(.5px); } 100% { transform: translateX(-.5px); } }
@keyframes astro-jump { 0%,100% { transform: translateY(0) scaleY(1); } 15% { transform: translateY(0) scaleY(.95); } 50% { transform: translateY(-16px) scaleY(1.02); } }
@keyframes astro-jump-shadow { 0%,100% { transform: scaleX(1); opacity: .45; } 50% { transform: scaleX(.65); opacity: .18; } }
@keyframes astro-spark { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
@keyframes astro-step { 0%,100% { transform: rotate(10deg); } 50% { transform: rotate(-10deg); } }
@keyframes astro-swing { 0%,100% { transform: rotate(18deg); } 50% { transform: rotate(-4deg); } }
@keyframes astro-swing-r { 0%,100% { transform: rotate(-18deg); } 50% { transform: rotate(4deg); } }
@keyframes astro-led { 0%, 60% { opacity: 1; } 61%, 100% { opacity: .25; } }
@keyframes astro-think { 0%,100% { opacity: .4; } 50% { opacity: 1; } }

.astro .astro-frost, .astro .astro-flakes, .astro .astro-sweat, .astro .astro-heat { opacity: 0; transition: opacity .5s ease-out; }
.astro[data-mood="cold"] .face-cold, .astro[data-mood="hot"] .face-hot { opacity: 1; }
.astro[data-mood="cold"] .astro-frost { opacity: .9; }
.astro[data-mood="cold"] .astro-flakes { opacity: 1; animation: astro-snow 2.6s linear infinite; }
.astro[data-mood="hot"] .astro-sweat { opacity: 1; animation: astro-drip 1.4s ease-in infinite; }
.astro[data-mood="hot"] .astro-heat { opacity: .7; animation: astro-shimmer 1.2s ease-in-out infinite; }
.astro[data-action="shiver"] .astro-body { animation: astro-shiver .1s linear infinite; }
.astro[data-action="shiver"] .astro-arm-l { transform: rotate(-32deg) translateX(6px); }
.astro[data-action="shiver"] .astro-arm-r { transform: rotate(32deg) translateX(-6px); }
.astro[data-action="fan"] .astro-arm-l { animation: astro-fan .35s ease-in-out infinite; }
.astro[data-action="point"] .astro-arm-r { transform: rotate(-96deg); }
.astro[data-action="point"] .astro-head { transform: rotate(-4deg); }
.astro[data-action="binoculars"] .astro-arm-r { transform: rotate(-150deg) translate(6px, 0); }
.astro[data-action="binoculars"] .astro-arm-l { transform: rotate(150deg) translate(-6px, 0); }
.astro[data-action="binoculars"] .astro-head { animation: astro-look 3.2s ease-in-out infinite; }
@keyframes astro-shiver { 0%,100% { transform: translateX(-.8px); } 50% { transform: translateX(.8px); } }
@keyframes astro-fan { 0%,100% { transform: rotate(150deg); } 50% { transform: rotate(118deg); } }
@keyframes astro-look { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
@keyframes astro-snow { from { transform: translateY(-6px); } to { transform: translateY(10px); } }
@keyframes astro-drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(12px); opacity: 0; } }
@keyframes astro-shimmer { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .astro *, .astro { animation: none !important; } }
`;

export interface Reaction {
  mood: Mood;
  action: Action;
  say: string;
}

/** Map a match score to Astra's reaction. */
export function reactionFor(score: number | null, loading: boolean): Reaction {
  if (loading || score === null) return { mood: "focused", action: "scan", say: "Scanning the ground…" };
  if (score >= 0.75) return { mood: "happy", action: "celebrate", say: `${score.toFixed(2)}! A strong place to practise.` };
  if (score >= 0.5) return { mood: "thinking", action: "sample", say: `${score.toFixed(2)}. Good for some tests. Check what Earth can't copy.` };
  return { mood: "sad", action: "slump", say: `${score.toFixed(2)}. This place won't copy the mission well.` };
}

/** Astra feels the weather: shivers in deep cold, sweats in strong heat. */
export function climateReaction(nightMinC: number | null, dayMaxC: number | null): Reaction | null {
  if (nightMinC !== null && nightMinC <= -25) return { mood: "cold", action: "shiver", say: `Brr! Nights here drop to ${Math.round(nightMinC)} °C. Good practice for the cold.` };
  if (dayMaxC !== null && dayMaxC >= 48) return { mood: "hot", action: "fan", say: `Phew, the ground hits ${Math.round(dayMaxC)} °C. Great for testing gear in heat.` };
  return null;
}
