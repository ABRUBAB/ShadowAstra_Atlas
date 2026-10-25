import { useSyncExternalStore } from "react";

/**
 * Less motion, site-wide: on when the visitor's system asks for reduced motion, or when they press
 * "Pause motion" in the footer (remembered in this browser). Spinning globes, loops, cycling text
 * and scroll effects all read this, and `html.reduce-motion` stops CSS animations (styles.css).
 * WCAG 2.2.2 asks for a way to pause anything that moves on its own for more than five seconds.
 */
const KEY = "sa-motion";
const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
let paused = (() => {
  try {
    return localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
})();
const subs = new Set<() => void>();
// Read once, then only through the change event: the browser fires "change" only if the value
// moved since the page last read `matches`, so reading it on every render (as a React snapshot
// does) could swallow the event and leave the page ignoring the new setting.
let system = !!query?.matches;

export const motionReduced = () => paused || system;
export const motionPaused = () => paused;

function apply() {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("reduce-motion", motionReduced());
  subs.forEach((f) => f());
}
query?.addEventListener("change", (e) => {
  system = e.matches;
  apply();
});
apply();

export function setMotionPaused(v: boolean) {
  paused = v;
  try {
    localStorage.setItem(KEY, v ? "paused" : "on");
  } catch {
    /* private mode: still applies for this visit */
  }
  apply();
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

/** True when motion should be kept to a minimum (system setting or the site's pause switch). */
export const useMotionReduced = () => useSyncExternalStore(subscribe, motionReduced, () => false);
/** True only when the visitor paused motion on the site. */
export const useMotionPaused = () => useSyncExternalStore(subscribe, motionPaused, () => false);
