import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Grid, type GridMeta } from "../../src/lib/grid";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const DATA = `${ROOT}public/data/`;

export function readArrayBuffer(path: string): ArrayBuffer {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

let cached: Grid | null = null;
/** The real grid the website ships, read from public/data. */
export function loadGrid(): Grid {
  if (!cached) cached = new Grid(readJson<GridMeta>(`${DATA}grid.json`), readArrayBuffer(`${DATA}grid.bin`));
  return cached;
}

/** fetch() for /data/... URLs, answered from public/data (for code that downloads band files). */
export async function diskFetch(url: string | URL | Request): Promise<Response> {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "");
  try {
    return new Response(readFileSync(`${ROOT}public${path}`));
  } catch {
    return new Response("", { status: 404 });
  }
}
