/**
 * Deploy smoke test and uptime check. Plain Node 22, no dependencies.
 *
 *   node scripts/smoke.mjs [base-url] [--json out.json]
 *   node scripts/smoke.mjs https://shadowastra-atlas.vercel.app
 *
 * Site checks fail the run (exit 1): pages and deep links load, the data files are there and agree
 * with each other, the security headers are sent, the inline script still matches its CSP hash and
 * hashed assets are cached for a year. Third-party map and terrain providers are only reported
 * (they are not ours to fix, and the site keeps working with fallbacks when one is down).
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "https://shadowastra-atlas.vercel.app").replace(/\/$/, "");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const results = [];

async function check(name, fatal, fn) {
  const t0 = performance.now();
  try {
    const note = await fn();
    results.push({ name, fatal, ok: true, ms: Math.round(performance.now() - t0), note: note ?? "" });
  } catch (e) {
    results.push({ name, fatal, ok: false, ms: Math.round(performance.now() - t0), note: String(e?.message ?? e) });
  }
}

async function get(url, init) {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), ...init });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r;
}
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

let html = "";
let headers = null;
let meta = null;

await check("home page loads", true, async () => {
  const r = await get(`${base}/`);
  headers = r.headers;
  html = await r.text();
  must(html.includes('<div id="root">'), "no app root in the HTML");
  return `${(html.length / 1024).toFixed(1)} kB HTML`;
});

for (const path of ["/discover?step=results&target=jezero&task=astrobio", "/methods", "/atlas?body=mars&spot=18.40,77.60", "/lab?earth=atacama&target=gale", "/report", "/no-such-page"]) {
  await check(`deep link ${path} serves the app`, true, async () => {
    const t = await (await get(`${base}${path}`)).text();
    must(t.includes('<div id="root">'), "not the app shell");
  });
}

await check("security headers", true, async () => {
  must(headers, "home page did not load");
  const csp = headers.get("content-security-policy") ?? "";
  const want = { "content-security-policy": csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'"), "x-content-type-options": headers.get("x-content-type-options") === "nosniff", "x-frame-options": headers.get("x-frame-options") === "DENY", "referrer-policy": !!headers.get("referrer-policy"), "cross-origin-opener-policy": !!headers.get("cross-origin-opener-policy"), "permissions-policy": !!headers.get("permissions-policy") };
  const missing = Object.entries(want).filter(([, ok]) => !ok).map(([k]) => k);
  must(!missing.length, `missing or wrong: ${missing.join(", ")}`);
  return "CSP, nosniff, DENY, referrer, COOP, permissions";
});

await check("inline script matches its CSP hash", true, async () => {
  const csp = headers?.get("content-security-policy") ?? "";
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
  for (const s of inline) {
    const h = `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
    must(csp.includes(h), `inline script hash ${h} is not in the CSP, so the browser would block it`);
  }
  return `${inline.length} inline script(s)`;
});

await check("hashed assets are cached for a year", true, async () => {
  const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
  must(asset, "no hashed script in the HTML");
  const r = await get(`${base}${asset}`);
  const cc = r.headers.get("cache-control") ?? "";
  must(cc.includes("immutable") && cc.includes("31536000"), `cache-control is "${cc}"`);
  await r.arrayBuffer();
  return asset;
});

await check("grid.json is valid", true, async () => {
  meta = await (await get(`${base}/data/grid.json`)).json();
  for (const k of ["rows", "cols", "count", "layout", "targets", "known", "confidence", "bin_bytes"]) must(meta[k] !== undefined, `grid.json has no ${k}`);
  must(meta.known.length >= 30, `only ${meta.known.length} known sites`);
  for (const need of ["model_moon", "model_mars", "f_relief", "q_cover", "h0"]) must(meta.layout.some((f) => f.name === need), `no ${need} field`);
  return `${meta.count.toLocaleString("en")} land areas, ${meta.known.length} known sites, ${Object.keys(meta.targets).length} targets`;
});

await check("grid.bin matches grid.json", true, async () => {
  must(meta, "grid.json did not load");
  const buf = await (await get(`${base}/data/grid.bin`)).arrayBuffer();
  must(buf.byteLength === meta.bin_bytes, `grid.bin is ${buf.byteLength} bytes, grid.json expects ${meta.bin_bytes}`);
  return `${(buf.byteLength / 1048576).toFixed(2)} MB`;
});

for (const f of ["validation.json", "terrain/manifest.json"]) {
  await check(`${f} loads`, true, async () => {
    await (await get(`${base}/data/${f}`)).json();
  });
}

const TILES = {
  "ESA Sentinel-2 cloudless (EOX)": "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/3/3/5.jpg",
  "NASA GIBS Blue Marble": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/2/1/2.jpeg",
  "NASA GIBS ASTER relief": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/6/27/45.jpg",
  "NASA Trek Moon LOLA heights": "https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_DEM_Global_128ppd_v04/1.0.0/default/default028mm/2/1/3.png",
  "NASA Trek Mars MOLA heights": "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_DEM_mosaic_global_463m_8/1.0.0/default/default028mm/2/1/3.png",
  "Esri World Imagery": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/5",
  "Mars CTX mosaic (Esri)": "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/3/3/5",
  "AWS terrain tiles (SRTM)": "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/3/5/3.png",
  "Open dataset (Hugging Face)": "https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas",
};
for (const [name, url] of Object.entries(TILES)) {
  await check(`provider: ${name}`, false, async () => {
    const r = await get(url);
    const type = r.headers.get("content-type") ?? "";
    await r.arrayBuffer();
    return type;
  });
}

const w = Math.max(...results.map((r) => r.name.length));
console.log(`Smoke test of ${base}  (${new Date().toISOString()})\n`);
for (const r of results) console.log(`${r.ok ? "PASS" : r.fatal ? "FAIL" : "WARN"}  ${r.name.padEnd(w)}  ${String(r.ms).padStart(5)} ms  ${r.note}`);
const failed = results.filter((r) => !r.ok && r.fatal);
const warned = results.filter((r) => !r.ok && !r.fatal);
console.log(`\n${results.length - failed.length - warned.length} passed, ${failed.length} failed, ${warned.length} provider warnings`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ base, date: new Date().toISOString(), results }, null, 1));
process.exit(failed.length ? 1 : 0);
