import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, LocateFixed, Search } from "lucide-react";
import { Astronaut, climateReaction, type Reaction } from "./ui/Astronaut";
import { Chip, EASE, Meter, toast } from "./ui/kit";
import { haversineKm, loadGrid, searchGrid, type Grid, type SearchHit } from "../lib/grid";
import { logBadge } from "../lib/fieldlog";
import type { World } from "../data/sites";

const EXAMPLES = ["Dhaka", "Reykjavik", "Las Vegas", "Cairo", "Lima", "Ulaanbaatar"];

function nearestStrong(grid: Grid, world: World, lat: number, lon: number) {
  let best = -1;
  let bd = Infinity;
  for (let k = 0; k < grid.n; k++) {
    if (grid.model(world, k) < 0.985) continue;
    const d = haversineKm(lat, lon, grid.lat(k), grid.lon(k));
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best < 0 ? null : { k: best, km: bd };
}

const plants = (n: number | null) => (n === null ? "no data" : n < 0.15 ? "almost none" : n < 0.3 ? "sparse" : n < 0.5 ? "some" : "green");

/** "How Moon-like or Mars-like is your town?" */
export function CheckTown() {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{ k: number; label: string; lat: number; lon: number } | null>(null);

  const ensure = () => {
    if (grid || loading) return;
    setLoading(true);
    loadGrid()
      .then(setGrid)
      .catch(() => toast("Could not load the global data. Try again.", "info"))
      .finally(() => setLoading(false));
  };
  const hits = useMemo(() => (grid ? searchGrid(grid, q, 7).filter((h) => h.lat !== undefined) : []), [grid, q]);

  const choose = async (h: Pick<SearchHit, "label" | "lat" | "lon">) => {
    const g = grid ?? (await loadGrid());
    if (!grid) setGrid(g);
    const k = g.cellAt(h.lat!, h.lon!, 4);
    if (k < 0) return toast("No land data there. Try a town on land.", "info");
    setRes({ k, label: h.label, lat: h.lat!, lon: h.lon! });
    setQ(h.label);
    setOpen(false);
    logBadge("town");
  };
  const byName = async (name: string) => {
    setLoading(true);
    try {
      const g = grid ?? (await loadGrid());
      setGrid(g);
      const h = searchGrid(g, name, 5).find((x) => x.lat !== undefined);
      if (h) await choose(h);
    } finally {
      setLoading(false);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) return toast("Location is not available in this browser.", "info");
    navigator.geolocation.getCurrentPosition(
      (p) => choose({ label: "Your location", lat: p.coords.latitude, lon: p.coords.longitude }),
      () => toast("Location permission was not given.", "info"),
      { timeout: 8000 },
    );
  };

  const info = useMemo(() => {
    if (!grid || !res) return null;
    const k = res.k;
    const moon = grid.model("moon", k);
    const mars = grid.model("mars", k);
    const world: World = mars >= moon ? "mars" : "moon";
    const best = Math.max(moon, mars);
    const near = nearestStrong(grid, world, res.lat, res.lon);
    const v = (n: string) => grid.value(n, k);
    const climate = climateReaction(v("f_lst_night_min"), v("f_lst_day_max"));
    const W = world === "mars" ? "Mars" : "the Moon";
    const nearName = near ? grid.name(near.k).title : null;
    let react: Reaction;
    if (best >= 0.9) react = { mood: "happy", action: "celebrate", say: `Wow! ${res.label} is more like ${W} than ${Math.round(best * 100)}% of all land.` };
    else if (climate) react = climate;
    else if (best >= 0.6) react = { mood: "thinking", action: "sample", say: `Some ${W}-like ground here. For real practice, ${nearName} is ${Math.round(near?.km ?? 0).toLocaleString()} km away.` };
    else react = { mood: "sad", action: "slump", say: `Too green and wet for ${W} practice. The closest strong spot is ${nearName}, ${Math.round(near?.km ?? 0).toLocaleString()} km away.` };
    return { moon, mars, world, near, nearName, react, v, name: grid.name(k) };
  }, [grid, res]);

  const x = (lon: number) => ((lon + 180) / 360) * 100;
  const y = (lat: number) => ((90 - lat) / 180) * 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="surface rounded-3xl p-5 sm:p-7">
        <div className="relative">
          <div className="flex items-center gap-2 rounded-full border border-line-2 bg-ink py-1.5 pr-1.5 pl-4 focus-within:border-flare/60">
            <Search size={15} className="text-dim" />
            <input
              value={q}
              onFocus={() => {
                ensure();
                setOpen(true);
              }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits[0]) choose(hits[0]);
              }}
              placeholder={loading ? "Loading 80,206 places…" : "Type a town or city, like Dhaka"}
              aria-label="Town or city"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-platinum outline-none placeholder:text-dim"
            />
            <button onClick={locate} title="Use my location" aria-label="Use my location" className="grid size-9 place-items-center rounded-full text-chrome hover:text-flare">
              <LocateFixed size={15} />
            </button>
          </div>
          <AnimatePresence>
            {open && hits.length > 0 && (
              <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl p-1">
                {hits.map((h, i) => (
                  <li key={`${h.label}${i}`}>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => choose(h)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-platinum/[0.07]">
                      <span className="text-[13.5px] text-platinum">{h.label}</span>
                      <span className="text-[11px] text-dim">{h.sub}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-dim">Try:</span>
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => byName(e)} className="rounded-full border border-line-2 px-2.5 py-1 text-[11.5px] text-chrome transition-colors hover:border-chrome hover:text-platinum">
              {e}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {info && res ? (
            <motion.div key={res.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE }} className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[22px] font-medium tracking-tight">{res.label}</h3>
                <span className="text-[12px] text-dim">{info.name.subtitle || info.name.country}</span>
              </div>
              <div className="mt-4 space-y-4">
                <Meter value={info.moon} label="Moon-like" kind="model" right={`top ${Math.max(1, Math.round((1 - info.moon) * 100))}%`} tone="var(--color-moon)" />
                <Meter value={info.mars} label="Mars-like" kind="model" right={`top ${Math.max(1, Math.round((1 - info.mars) * 100))}%`} tone="var(--color-mars)" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
                {[
                  ["Coldest night", info.v("f_lst_night_min"), " °C"],
                  ["Hottest ground", info.v("f_lst_day_max"), " °C"],
                  ["Rain a year", info.v("f_precip"), " mm"],
                ].map(([k, val, u]) => (
                  <div key={k as string} className="bg-panel p-3">
                    <div className="text-[10.5px] text-dim">{k}</div>
                    <div className="mt-0.5 font-mono text-[15px] text-platinum">{val === null ? "n/a" : `${Math.round(val as number)}${u}`}</div>
                  </div>
                ))}
                <div className="bg-panel p-3">
                  <div className="text-[10.5px] text-dim">Plants</div>
                  <div className="mt-0.5 text-[14px] text-platinum capitalize">{plants(info.v("f_ndvi"))}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={`/discover?target=${info.world === "mars" ? "jezero" : "shackleton"}&task=${info.world === "mars" ? "astrobio" : "base"}&at=${res.lat.toFixed(2)},${res.lon.toFixed(2)}`} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium">
                  Full report <ArrowRight size={13} />
                </Link>
                {info.near && (
                  <Link to={`/discover?target=${info.world === "mars" ? "jezero" : "shackleton"}&task=${info.world === "mars" ? "astrobio" : "base"}&at=${grid!.lat(info.near.k).toFixed(2)},${grid!.lon(info.near.k).toFixed(2)}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-4 py-2 text-[13px] text-chrome hover:text-platinum">
                    Visit {info.nearName}
                  </Link>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-[14px] leading-relaxed text-chrome">
              We use the same model that ranks the whole planet. It learned from 38 places NASA and others use to practise. Your town gets a rank among all 80,206 land areas.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        <div data-theme="dark" className="relative aspect-[2/1] overflow-hidden rounded-3xl border border-line bg-void">
          <img src="/textures/earth_day_2k.webp" alt="Map of the Earth" loading="lazy" className="absolute inset-0 size-full object-cover opacity-60" />
          {info && res && (
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {info.near && (
                <motion.line
                  x1={x(res.lon)}
                  y1={y(res.lat) / 2}
                  x2={x(grid!.lon(info.near.k))}
                  y2={y(grid!.lat(info.near.k)) / 2}
                  stroke="#f2c879"
                  strokeWidth="0.25"
                  strokeDasharray="1 0.8"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: EASE }}
                />
              )}
            </svg>
          )}
          {info && res && (
            <>
              <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(7,8,10,0.8)]" style={{ left: `${x(res.lon)}%`, top: `${y(res.lat)}%` }}>
                <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />
              </span>
              {info.near && (
                <span
                  className={clsx("absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-void", info.world === "mars" ? "border-mars" : "border-moon")}
                  style={{ left: `${x(grid!.lon(info.near.k))}%`, top: `${y(grid!.lat(info.near.k))}%` }}
                />
              )}
            </>
          )}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <Chip className="bg-void/70">
              <span className="size-2 rounded-full bg-white" /> your town
            </Chip>
            <Chip className="bg-void/70">
              <span className="size-2 rounded-full border-2 border-mars" /> nearest strong site
            </Chip>
          </div>
        </div>
        <div className="surface flex items-center gap-4 rounded-3xl p-4">
          <Astronaut size={96} mood={info?.react.mood ?? "happy"} action={info?.react.action ?? "wave"} />
          <p className="text-[15px] leading-snug text-platinum">{info?.react.say ?? "Tell me your town. I'll tell you how Moon-like or Mars-like it is, and where to go for real practice."}</p>
        </div>
      </div>
    </div>
  );
}
