import { useEffect, useState } from "react";

/**
 * Astra's field log: small badges a visitor earns by trying the site.
 * Stored in this browser only; nothing is sent anywhere.
 */
export const BADGES = [
  { id: "find", title: "First find", how: "Open a place on the Find new sites map" },
  { id: "compare", title: "Side by side", how: "Compare an Earth place with the Moon or Mars in 3D" },
  { id: "town", title: "Home check", how: "Check how Moon-like or Mars-like a town is" },
  { id: "save", title: "Collector", how: "Save a place to your list" },
  { id: "game3", title: "Sharp eye", how: "Get 3 right in a row in Earth or Mars?" },
  { id: "game10", title: "Mission geologist", how: "Score 10 in Earth or Mars?" },
  { id: "ask", title: "Good question", how: "Ask Astra something" },
  { id: "search", title: "Shortcut pro", how: "Open search with Ctrl K or /" },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];
const KEY = "sa-log";

function read(): BadgeId[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Record that something happened; announces a badge the first time. */
export function logBadge(id: BadgeId) {
  const cur = read();
  if (cur.includes(id)) return;
  const next = [...cur, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("sa-badge", { detail: { id } }));
}

export function useFieldLog() {
  const [got, setGot] = useState<BadgeId[]>(read);
  useEffect(() => {
    const on = () => setGot(read());
    window.addEventListener("sa-badge", on);
    return () => window.removeEventListener("sa-badge", on);
  }, []);
  return got;
}
