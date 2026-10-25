import { useEffect, type RefObject } from "react";
import { useMotionValue, type MotionValue } from "motion/react";

type Edge = "start" | "center" | "end" | `${number}%`;
/** "<element edge> <viewport edge>", like Motion's useScroll offsets: ["start start", "end start"]. */
export type Offset = `${"start" | "center" | "end"} ${Edge}`;

const frac = (e: string) => (e === "start" ? 0 : e === "center" ? 0.5 : e === "end" ? 1 : parseFloat(e) / 100);

/**
 * How far the page has scrolled through an element, 0 to 1, as a MotionValue (drop-in for
 * `useScroll({ target, offset }).scrollYProgress`).
 *
 * Why not useScroll: Motion 14.1 to 14.6 caches one timeline per target element in a module-level
 * Map that is never cleared, so every visit to a page that used it kept the whole page's detached
 * DOM alive (about 3 MB per visit to How it works, measured with heap snapshots). This keeps nothing.
 */
export function useSectionProgress(ref: RefObject<HTMLElement | null>, offset: [Offset, Offset]): MotionValue<number> {
  const progress = useMotionValue(0);
  const [a, b] = offset;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const [t0, v0] = a.split(" ").map(frac);
    const [t1, v1] = b.split(" ").map(frac);
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const y = -r.top; // grows as the page scrolls down
      const y0 = t0 * r.height - v0 * vh;
      const y1 = t1 * r.height - v1 * vh;
      const p = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      progress.set(Math.min(1, Math.max(0, p)));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, [ref, a, b, progress]);
  return progress;
}
