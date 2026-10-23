import { toast } from "../components/ui/kit";

/**
 * Maps and 3D views that sit inside a scrolling page must not steal the mouse wheel.
 * Plain scrolling moves the page; Ctrl or ⌘ + scroll zooms (a trackpad pinch sends the
 * same event, and touch pinch still works). A short hint appears the first few times.
 */

let lastHint = 0;
let hints = 0;

export function zoomHint() {
  const now = Date.now();
  if (hints >= 3 || now - lastHint < 6000) return;
  lastHint = now;
  hints++;
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  toast(`Scrolling moves the page. Hold ${mac ? "⌘" : "Ctrl"} and scroll to zoom.`, "info");
}

export const zoomKey = (e: WheelEvent) => e.ctrlKey || e.metaKey;

/** For three.js OrbitControls: let the wheel through to the page unless Ctrl or ⌘ is held. */
export function ctrlWheelZoom(el: HTMLElement, setZoom: (on: boolean) => void) {
  const fn = (e: WheelEvent) => {
    const on = zoomKey(e);
    setZoom(on);
    if (!on) zoomHint();
  };
  el.addEventListener("wheel", fn, { capture: true, passive: true });
  return () => el.removeEventListener("wheel", fn, { capture: true });
}
