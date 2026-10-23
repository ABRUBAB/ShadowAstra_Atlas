import { useEffect, useState } from "react";

/** Places a visitor has saved, kept in this browser only. */
export interface SavedPlace {
  id: string;
  name: string;
  sub: string;
  lat: number;
  lon: number;
  score?: number;
  target?: string;
  task?: string;
  at: number;
}

const KEY = "sa-saved";

function read(): SavedPlace[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: SavedPlace[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* private mode: the list lives for this visit only */
  }
  window.dispatchEvent(new Event("sa-saved"));
}

export const placeId = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function useSaved() {
  const [list, setList] = useState<SavedPlace[]>(read);
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener("sa-saved", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("sa-saved", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  const has = (id: string) => list.some((p) => p.id === id);
  const toggle = (p: Omit<SavedPlace, "at">) => {
    const cur = read();
    write(cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [{ ...p, at: Date.now() }, ...cur]);
    return !cur.some((x) => x.id === p.id);
  };
  const remove = (id: string) => write(read().filter((x) => x.id !== id));
  return { list, has, toggle, remove };
}
