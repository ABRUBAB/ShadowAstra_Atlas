import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The ShadowAstra mark inside its orbit: a ring, a travelling moon and a sunlight sweep. */
export function OrbitMark({ size = 132, speed = 3.2 }: { size?: number; speed?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-[-30%] rounded-full opacity-70 blur-2xl" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-flare) 22%, transparent), transparent 65%)" }} />
      <img src="/brand/shadowastra-logo.webp" alt="" className="logo-mark relative size-full rounded-full mix-blend-screen" />
      <svg viewBox="-60 -60 120 120" className="absolute inset-[-22%] overflow-visible" aria-hidden>
        <g transform="rotate(-18)">
          <ellipse cx="0" cy="0" rx="56" ry="20" fill="none" style={{ stroke: "var(--color-chrome)" }} strokeOpacity="0.35" strokeWidth="0.6" />
          <motion.ellipse
            cx="0"
            cy="0"
            rx="56"
            ry="20"
            fill="none"
            style={{ stroke: "var(--color-flare)" }}
            strokeWidth="1"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.22 0.78"
            animate={{ strokeDashoffset: [0, -1] }}
            transition={{ duration: speed, ease: "linear", repeat: Infinity }}
          />
          <motion.circle
            r="2.6"
            style={{ fill: "var(--color-platinum)" }}
            animate={{ cx: [56, 0, -56, 0, 56], cy: [0, 20, 0, -20, 0] }}
            transition={{ duration: speed, ease: "linear", repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1] }}
          />
        </g>
      </svg>
    </div>
  );
}

/** Compact loader for route changes. */
export function MiniLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-void">
      <div className="flex flex-col items-center gap-8">
        <OrbitMark size={72} speed={2.4} />
        <div className="font-mono text-[11px] tracking-[0.3em] text-chrome uppercase">{label}</div>
      </div>
    </div>
  );
}

const NAME = "SHADOWASTRA";

/** First-visit splash. Shows once per session; never blocks longer than ~2.6 s. */
export function Splash() {
  const [show, setShow] = useState(() => {
    try {
      if (new URLSearchParams(location.search).get("splash") === "0") return false;
      return sessionStorage.getItem("sa-splash") !== "seen";
    } catch {
      return true;
    }
  });
  const [progress, setProgress] = useState(0.08);

  useEffect(() => {
    if (!show) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start) / 2200;
      const ready = document.readyState === "complete" ? 1 : 0.85;
      setProgress(Math.min(ready, 0.08 + t));
      if (t < 1.2) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = () =>
      setTimeout(() => {
        setShow(false);
        try {
          sessionStorage.setItem("sa-splash", "seen");
        } catch {
          /* private mode */
        }
      }, Math.max(0, 2200 - (performance.now() - start)));
    let t2: ReturnType<typeof setTimeout> | undefined;
    if (document.readyState === "complete") t2 = done();
    else window.addEventListener("load", () => (t2 = done()), { once: true });
    const failsafe = setTimeout(() => setShow(false), 4200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
      if (t2) clearTimeout(t2);
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          data-theme="dark"
          className="fixed inset-0 z-[9998] grid place-items-center bg-void"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          aria-label="Loading ShadowAstra Atlas"
          role="status"
        >
          <motion.div className="flex flex-col items-center" exit={{ y: -40, opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.1, ease: EASE }}>
              <OrbitMark size={132} />
            </motion.div>
            <div className="mt-14 flex font-wide text-[15px] tracking-[0.42em] text-platinum">
              {NAME.split("").map((ch, i) => (
                <motion.span key={i} initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.7, ease: EASE, delay: 0.35 + i * 0.045 }}>
                  {ch}
                </motion.span>
              ))}
            </div>
            <motion.div initial={{ opacity: 0, letterSpacing: "0.2em" }} animate={{ opacity: 1, letterSpacing: "0.6em" }} transition={{ duration: 1.2, ease: EASE, delay: 0.9 }} className="mt-3 font-wide text-[11px] text-flare">
              ATLAS
            </motion.div>
            <div className="mt-10 h-px w-56 overflow-hidden bg-line">
              <motion.div className="h-px bg-flare" animate={{ width: `${progress * 100}%` }} transition={{ ease: "easeOut", duration: 0.3 }} />
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }} className="mt-5 font-serif text-[17px] text-chrome italic">
              Rehearse other worlds on this one.
            </motion.p>
          </motion.div>
          <div className="absolute bottom-8 font-mono text-[10px] tracking-[0.3em] text-dim uppercase">NASA Space Apps 2026 · Dhaka</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
