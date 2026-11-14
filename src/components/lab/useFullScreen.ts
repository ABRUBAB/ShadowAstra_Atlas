import { useCallback, useEffect, useState } from "react";

export type FullMode = "off" | "native" | "css";

/**
 * Full screen for one element: the browser's Fullscreen API where it works, otherwise (iPhone
 * Safari has none for page elements) the element is pinned over the page. Esc or a close button
 * exits. Meanwhile the rest of the page is inert, so keyboard focus stays in the full-screen view,
 * and the page behind does not scroll.
 */
export function useFullScreen(ref: React.RefObject<HTMLElement | null>) {
  const [mode, setMode] = useState<FullMode>("off");

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenEnabled && typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen({ navigationUI: "hide" });
        setMode("native");
        return;
      } catch {
        /* refused (no user gesture, an iframe without permission): pin it instead */
      }
    }
    setMode("css");
  }, [ref]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setMode("off");
  }, []);

  // leaving native full screen with Esc or the browser's own controls
  useEffect(() => {
    const on = () => {
      if (!document.fullscreenElement) setMode((m) => (m === "native" ? "off" : m));
    };
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  useEffect(() => {
    if (mode === "off") return;
    const el = ref.current;
    if (!el) return;
    const undo: (() => void)[] = [];
    // everything outside the view becomes inert: siblings along the path up to <body>
    for (let node: HTMLElement | null = el; node && node !== document.body && node.parentElement; node = node.parentElement) {
      for (const sib of Array.from(node.parentElement.children)) {
        if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue;
        sib.inert = true;
        undo.push(() => (sib.inert = false));
      }
    }
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    undo.push(() => (html.style.overflow = overflow));
    if (mode === "css") {
      // a transform, filter or containment on an ancestor would trap position: fixed inside it
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const node = a;
        const prev = { transform: node.style.transform, filter: node.style.filter, contain: node.style.contain, willChange: node.style.willChange };
        Object.assign(node.style, { transform: "none", filter: "none", contain: "none", willChange: "auto" });
        undo.push(() => Object.assign(node.style, prev));
      }
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setMode("off");
    };
    window.addEventListener("keydown", key);
    undo.push(() => window.removeEventListener("keydown", key));
    return () => undo.reverse().forEach((f) => f());
  }, [mode, ref]);

  // leaving the page while in full screen
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
    [],
  );

  return { mode, on: mode !== "off", enter, exit };
}
