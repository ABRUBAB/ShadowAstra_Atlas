import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ArrowUpRight, BrainCircuit, Check, CircleDashed, ClipboardList, Crosshair, Database, Gauge, Globe, Layers, Mountain, Target } from "lucide-react";
import { Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { Astronaut } from "../components/ui/Astronaut";
import { Counter, EASE, GlyphTile, Kicker, KindBadge, Meter, RevealWords, Seg } from "../components/ui/kit";
import { PARAMS, TASK_WEIGHTS } from "../lib/scoring";
import { TASKS, type World } from "../data/sites";
import { useSmoothScroll } from "../lib/useSmoothScroll";
import { useGrid } from "../lib/grid";

type Status = "live" | "planned";
interface Source {
  body: "earth" | "moon" | "mars";
  name: string;
  agency: string;
  use: string;
  res: string;
  status: Status;
  link: string;
}

const SOURCES: Source[] = [
  { body: "earth", name: "NASA POWER climatology", agency: "NASA LaRC (MERRA-2)", use: "Air temperature, coldest and hottest months, rain, humidity, sunshine", res: "0.5°", status: "live", link: "https://power.larc.nasa.gov/" },
  { body: "earth", name: "MODIS land surface temperature", agency: "NASA GIBS · Terra MODIS", use: "Coldest night and hottest day ground temperature, 2024", res: "~4 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "MODIS NDVI, snow and land cover", agency: "NASA GIBS · Terra MODIS", use: "Plants, snow months, bare ground, ice, cities and farms", res: "~1 to 5 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "SRTM-based Terrain Tiles", agency: "NASA SRTM · AWS Open Data", use: "Slopes, height range and roughness for every land area; 3D ground", res: "~30 m source", status: "live", link: "https://registry.opendata.aws/terrain-tiles/" },
  { body: "earth", name: "Holocene volcano list", agency: "Smithsonian GVP", use: "Distance to 1,214 volcanoes active in the last 12,000 years", res: "points", status: "live", link: "https://volcano.si.edu/" },
  { body: "earth", name: "Confirmed impact craters", agency: "Earth Impact Database (PASSC)", use: "65 craters with their sizes", res: "points", status: "live", link: "http://www.passc.net/EarthImpactDatabase/" },
  { body: "earth", name: "Sentinel-2 cloudless 2020", agency: "ESA Copernicus · EOX", use: "True-colour imagery, 3D drape, the Earth or Mars game", res: "10 m", status: "live", link: "https://s2maps.eu" },
  { body: "earth", name: "Blue Marble, ASTER relief", agency: "NASA GIBS · NASA/METI", use: "Globe, polar imagery, shaded relief", res: "30 m to 1 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "Natural Earth", agency: "Public domain", use: "Country, region and town names for every place", res: "1:10 m", status: "live", link: "https://www.naturalearthdata.com/" },
  { body: "earth", name: "Official 2026 challenge datasets", agency: "NASA + partner agencies", use: "Released 28 October; we add them to the same pipeline", res: "various", status: "planned", link: "https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/" },
  { body: "earth", name: "EMIT surface minerals", agency: "NASA / JPL", use: "What the rocks are made of", res: "60 m", status: "planned", link: "https://earth.jpl.nasa.gov/emit/" },
  { body: "earth", name: "NASADEM", agency: "NASA / JPL", use: "Sharper slopes for small sites", res: "30 m", status: "planned", link: "https://www.earthdata.nasa.gov/esds/competitive-programs/measures/nasadem" },
  { body: "moon", name: "LRO LOLA global DEM (16-bit)", agency: "NASA · USGS Astrogeology", use: "Full-precision slopes and height range for Moon targets", res: "118 m", status: "live", link: "https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m" },
  { body: "moon", name: "LOLA tiles and polar hillshade", agency: "NASA Solar System Treks", use: "3D ground, shadow map, polar map", res: "118 to 237 m", status: "live", link: "https://trek.nasa.gov/moon/" },
  { body: "moon", name: "LROC WAC mosaic", agency: "NASA / ASU", use: "Visible imagery, 3D drape, game", res: "100 m", status: "live", link: "https://lroc.im-ldi.com/" },
  { body: "moon", name: "LRO Diviner", agency: "NASA / UCLA", use: "Moon surface temperature and cold traps", res: "~240 m", status: "planned", link: "https://www.diviner.ucla.edu/" },
  { body: "moon", name: "SELENE / Kaguya TC DTM", agency: "JAXA", use: "Independent lunar terrain", res: "10 m", status: "planned", link: "https://darts.isas.jaxa.jp/planet/pdap/selene/" },
  { body: "mars", name: "MGS MOLA global DEM (16-bit)", agency: "NASA · USGS Astrogeology", use: "Full-precision slopes and height range for Mars targets", res: "463 m", status: "live", link: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" },
  { body: "mars", name: "Viking MDIM 2.1", agency: "NASA / USGS", use: "Colour imagery, 3D drape, game", res: "232 m", status: "live", link: "https://astrogeology.usgs.gov/" },
  { body: "mars", name: "Mars Odyssey THEMIS", agency: "NASA / ASU", use: "Thermal infrared, rock vs dust", res: "100 m", status: "live", link: "https://themis.mars.asu.edu/" },
  { body: "mars", name: "MRO HiRISE DTMs", agency: "NASA / UArizona", use: "Wheel-scale slopes for landing sites", res: "1 m", status: "planned", link: "https://www.uahirise.org/dtm/" },
  { body: "mars", name: "Mars Express HRSC DTM", agency: "ESA / DLR", use: "Independent Mars terrain", res: "50 m", status: "planned", link: "https://www.cosmos.esa.int/web/psa/mars-express" },
];

const STAGES = [
  { icon: Target, t: "Pick the job", d: "A mission task and a Moon or Mars place set what matters and the scale to compare at.", live: true },
  { icon: Mountain, t: "Measure the target", d: "Slopes, height range and roughness from full-precision LOLA and MOLA. Sun angles from orbital geometry.", live: true },
  { icon: Globe, t: "Measure all of Earth", d: "80,206 land areas: terrain from SRTM tiles; cold, heat, plants and snow from MODIS; rain from NASA POWER; volcanoes and craters.", live: true },
  { icon: Gauge, t: "Score for the mission", d: "Five measured scores weighted by the job, plus a learned model. Re-ranked in your browser as you move sliders.", live: true },
  { icon: Crosshair, t: "Test honestly", d: "Hide each known site and its neighbours within 300 km, retrain, and check where it ranks. Compare with a simple rule.", live: true },
  { icon: ClipboardList, t: "Plan the trip", d: "Best months, travel CO₂ and protection status today. A downloadable field test plan is next.", live: false },
];

const FORMULAS = [
  { k: "Ground shape", f: "0.65 · overlap(slopesₑ, slopesₜ) + 0.35 · (1 − |log₁₀ rangeₑ / rangeₜ|)", d: "Slope histograms and height range over the same 50 km square at 1.2 km spacing, after the same smoothing, on Earth and the target." },
  { k: "Sunlight angle", f: "1 − W₁(sunₑ, sunₜ) / 25°", d: "Earth-mover distance between the daylight Sun heights at each place, using Earth's best month." },
  { k: "Rocks & craters", f: "0.6 · max(volcano, crater) + 0.4 · bare", d: "For Moon targets. Lava tube jobs use volcanoes, crater jobs use craters, life search adds dryness." },
  { k: "Cold & heat", f: "0.55 · cold + 0.45 · swing", d: "Ice and low-Sun jobs use cold and ice instead. Mars targets also add dry air." },
  { k: "Bare, dry ground", f: "0.6 · bare + 0.4 · dry", d: "Little rain and few plants, so soil and rock are exposed like regolith." },
  { k: "Match score", f: "(1 − m) · Σ wᵢ·vᵢ / Σ wᵢ + m · model", d: "Weights wᵢ come from the job. m is how much you trust the learned model (30% by default)." },
];

const INDICATORS = [
  ["Dry", "1 − rank of yearly rain and snow (NASA POWER)"],
  ["Bare", "0.6 · (bare + ice + 0.3 · shrubland, MODIS land cover) + 0.4 · (1 − green, from MODIS NDVI)"],
  ["Cold", "1 − rank of the coldest monthly night ground temperature (MODIS)"],
  ["Swing", "rank of the biggest day to night ground temperature change (MODIS)"],
  ["Dry air", "1 − rank of relative humidity (NASA POWER)"],
  ["Volcano", "exp(−distance to the nearest Holocene volcano / 60 km)"],
  ["Crater", "1 inside a confirmed crater rim, fading over about 40 km"],
  ["Ice", "ice cover + snowy months / 24, plus 0.3 where the average air is below −2 °C"],
];

const PRINCIPLES = [
  "No number on screen that does not come from a dataset or the pipeline.",
  "Known test sites teach and test the model. We never show them as new discoveries.",
  "Compare ground only at the same physical scale, using each world's own size.",
  "Every layer shows its instrument, resolution and provider.",
  "Earth can't copy gravity, vacuum or radiation. We say so next to every score.",
  "Field visits need permission, local partners and care for the land.",
];

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-serif font-normal text-chrome italic">{children}</span>;
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} className="mt-6 max-w-[920px] text-[clamp(30px,4vw,58px)] leading-[1.03] font-medium tracking-[-0.038em]">
      {children}
    </motion.h2>
  );
}

export default function Methods() {
  useSmoothScroll();
  const live = SOURCES.filter((s) => s.status === "live").length;
  return (
    <div className="bg-void">
      <Nav />

      <section className="relative overflow-hidden border-b border-line">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_80%_at_70%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-[1400px] items-end gap-10 px-4 pt-28 pb-20 sm:px-6 lg:grid-cols-[1fr_auto] lg:pt-36">
          <div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">
              <span className="h-px w-8 bg-chrome/50" /> How it works
            </motion.div>
            <h1 className="mt-8 text-[clamp(40px,6vw,92px)] leading-[0.98] font-medium tracking-[-0.045em]">
              <RevealWords text="Open data in." />
              <br />
              <span className="font-serif font-normal tracking-[-0.02em] text-flare italic">
                <RevealWords text="Honest answers out." delay={0.25} />
              </span>
            </h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.6 }} className="mt-8 max-w-2xl text-[17px] leading-relaxed text-chrome">
              We measured every land area on Earth with open NASA data, then compare each one with Moon and Mars places at the same scale. Here is every step, every
              formula, every dataset, and the test that shows it works.
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="hidden lg:block">
            <Astronaut size={130} mood="focused" action="drill" say="Every number here traces back to a dataset." sayAlign="left" />
          </motion.div>
        </div>
        <div className="relative mx-auto grid max-w-[1400px] grid-cols-2 border-t border-line md:grid-cols-4">
          {[
            [80206, "land areas measured", 0],
            [24, "measurements per place", 0],
            [live, "datasets in use", 0],
            [38, "known sites to learn from", 0],
          ].map(([n, l, d], i) => (
            <motion.div key={l as string} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.8 + i * 0.08 }} className="border-line px-4 py-8 sm:px-6 [&:not(:last-child)]:border-r">
              <div className="font-mono text-[44px] leading-none font-light">
                <Counter value={n as number} decimals={d as number} />
              </div>
              <div className="mt-2 text-[13px] text-dim">{l}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <Pipeline />
      <Scoring />
      <ModelTest />
      <Registry />

      <section className="border-b border-line px-4 py-28 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Kicker n="05">Principles</Kicker>
            <H2>
              Six rules <Em>we don't break.</Em>
            </H2>
          </div>
          <ul className="border-t border-line">
            {PRINCIPLES.map((p, i) => (
              <motion.li key={p} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.05 }} className="group relative flex gap-5 border-b border-line py-5 pl-6 transition-colors hover:bg-panel">
                <span className="absolute top-0 bottom-0 left-0 w-px origin-top scale-y-0 bg-flare transition-transform duration-500 group-hover:scale-y-100" />
                <span className="font-mono text-xs text-dim group-hover:text-flare">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[16px] text-platinum">{p}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-28 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_120%,rgba(242,200,121,0.12),transparent_70%)]" />
        <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-8">
          <h2 className="text-[clamp(28px,3.6vw,52px)] font-medium tracking-[-0.035em]">
            See the method <span className="font-serif font-normal text-flare italic">run live.</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/discover" className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
              Find new sites <ArrowRight size={16} />
            </Link>
            <Link to="/lab" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-6 py-3.5 text-sm text-platinum hover:border-chrome">
              Compare in 3D
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 50%"] });
  const p = useSpring(scrollYProgress, { stiffness: 110, damping: 28 });
  return (
    <section className="border-b border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="01">The steps</Kicker>
        <H2>
          Six steps from a mission question <Em>to a place you can visit.</Em>
        </H2>
        <div ref={ref} className="relative mt-16">
          <div className="absolute top-[24px] right-0 left-0 hidden h-px bg-line lg:block" />
          <motion.div style={{ scaleX: p }} className="absolute top-[24px] right-0 left-0 hidden h-px origin-left bg-flare lg:block" />
          <ol className="grid gap-6 lg:grid-cols-6">
            {STAGES.map((s, i) => (
              <motion.li key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.07 }} className="relative">
                <GlyphTile tone={s.live ? "var(--color-flare)" : "var(--color-chrome)"} className="relative z-10">
                  <s.icon size={18} strokeWidth={1.5} />
                </GlyphTile>
                <div className="mt-6 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-1 text-[18px] font-medium tracking-tight">{s.t}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-chrome">{s.d}</p>
                <span className={clsx("mt-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", s.live ? "border-strong/40 bg-strong/10 text-strong" : "border-dashed border-line-2 text-chrome")}>
                  {s.live ? <Check size={11} /> : <CircleDashed size={11} />} {s.live ? "Working now" : "Next"}
                </span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Scoring() {
  const keys = ["topography", "geology", "temperature", "lighting", "regolith"] as const;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="border-b border-line bg-ink px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Kicker n="02">How a place is scored</Kicker>
            <H2>
              Five measured scores, weighted by the job. <Em>Never one universal number.</Em>
            </H2>
          </div>
          <div className="hidden md:block">
            <Astronaut size={96} mood="thinking" action="idle" />
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FORMULAS.map((f, i) => (
            <motion.div key={f.k} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.06 }} className="surface rounded-2xl p-6">
              <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">{f.k}</div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-void px-4 py-3 font-mono text-[13px] whitespace-nowrap text-flare">{f.f}</div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-chrome">{f.d}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {PARAMS.map((p) => (
            <div key={p.id} className="bg-panel p-6 transition-colors hover:bg-panel-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[17px] text-platinum">{p.label}</span>
                <KindBadge kind={p.id === "radiation" ? "gap" : "computed"} />
              </div>
              <p className="mt-2 text-[13.5px] text-chrome">{p.what}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">The building blocks · 0 to 1, higher is more Moon or Mars-like</div>
            <ul className="mt-3 border-t border-line">
              {INDICATORS.map(([k, d]) => (
                <li key={k} className="grid grid-cols-[84px_1fr] gap-3 border-b border-line py-2.5 text-[13px]">
                  <span className="text-platinum">{k}</span>
                  <span className="text-chrome">{d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-dim">“Rank” means the percentile among all land areas, so every building block is on the same 0 to 1 scale and one extreme value can't dominate.</p>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">How much each score counts, per job · hover a row</div>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="bg-panel font-mono text-[10px] tracking-[0.12em] text-dim uppercase">
                  <tr>
                    <th className="px-4 py-3 font-normal">Job</th>
                    {keys.map((k) => (
                      <th key={k} className="px-4 py-3 text-right font-normal">
                        {PARAMS.find((p) => p.id === k)!.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((t) => (
                    <tr key={t.id} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} className={clsx("border-t border-line transition-colors", hover === t.id && "bg-panel")}>
                      <td className="px-4 py-3 text-platinum">{t.label}</td>
                      {keys.map((k) => {
                        const w = TASK_WEIGHTS[t.id][k];
                        return (
                          <td key={k} className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
                                <motion.div className={clsx("h-full rounded-full", hover === t.id ? "bg-flare" : "bg-platinum/70")} initial={{ width: 0 }} whileInView={{ width: `${(w / 0.5) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} />
                              </div>
                              <span className="w-9 text-right font-mono text-chrome">{Math.round(w * 100)}%</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURE: Record<string, string> = {
  volcanic: "Volcanoes nearby",
  impact: "Impact craters",
  lst_night_min: "Night cold",
  lst_day_max: "Day heat",
  rough: "Rough ground",
  ndvi: "Few plants",
  barren: "Bare ground",
  slope90: "Steep slopes",
  lat_abs: "Distance from equator",
  relief: "Height range",
  elev: "Height",
  slope: "Average slope",
  precip: "Rain",
  rh: "Humidity",
  t_max: "Hot air",
  t_min: "Cold air",
  t_mean: "Average air",
  snowice: "Snow and ice",
  shrub: "Shrubland",
  forest: "Forest",
  sun: "Sunshine",
  lst_range: "Day to night swing",
  snow_months: "Snowy months",
};

function ModelTest() {
  const { grid, progress } = useGrid();
  const [world, setWorld] = useState<World>("moon");
  const ev = grid?.meta.evaluation[world];
  const steps = [
    { icon: Database, t: "Learn from known sites", d: "38 sites used by NASA, ESA, CSA and universities are the examples. The rest of the land is the unlabelled background.", tag: "Done" },
    { icon: BrainCircuit, t: "A careful model", d: "Gradient-boosted trees (LightGBM) trained 4 times on fresh background samples, then averaged. Only physical measurements: no cities or farms.", tag: "Done" },
    { icon: Crosshair, t: "A fair test", d: "Hide one site and every other known site within 300 km, retrain, then see where the hidden site ranks among all land.", tag: "Done" },
    { icon: Layers, t: "Terrain encoder", d: "A neural network that learns the shape of the ground from Earth, Moon and Mars heights, trained on Kaggle GPUs.", tag: "Next" },
  ];
  return (
    <section className="border-b border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Kicker n="03">The learned model</Kicker>
            <H2>
              A model that <Em>had to prove itself.</Em>
            </H2>
          </div>
          <Seg
            value={world}
            onChange={setWorld}
            options={[
              { id: "moon", label: <><WorldDot world="moon" /> Moon sites</> },
              { id: "mars", label: <><WorldDot world="mars" /> Mars sites</> },
            ]}
          />
        </div>
        <ol className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((m, i) => (
            <motion.li key={m.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }} className="surface lift flex flex-col rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <GlyphTile tone={m.tag === "Done" ? "var(--color-earth)" : "var(--color-chrome)"}>
                  <m.icon size={18} strokeWidth={1.5} />
                </GlyphTile>
                <span className={clsx("rounded-full border px-2 py-0.5 text-[11px]", m.tag === "Done" ? "border-strong/40 bg-strong/10 text-strong" : "border-dashed border-line-2 text-chrome")}>{m.tag}</span>
              </div>
              <h3 className="mt-8 text-[18px] font-medium tracking-tight">{m.t}</h3>
              <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-chrome">{m.d}</p>
            </motion.li>
          ))}
        </ol>
        {ev ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="surface rounded-2xl p-6">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Hidden sites · typical rank</div>
              <div className="mt-3 flex items-end gap-6">
                <div>
                  <div className="font-mono text-[40px] leading-none font-light text-flare">
                    <Counter value={ev.model_median_top_pct} decimals={1} suffix="%" />
                  </div>
                  <div className="mt-1 text-[12px] text-chrome">our model</div>
                </div>
                <div>
                  <div className="font-mono text-[40px] leading-none font-light text-chrome">
                    <Counter value={ev.baseline_median_top_pct} decimals={1} suffix="%" />
                  </div>
                  <div className="mt-1 text-[12px] text-chrome">simple rule</div>
                </div>
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-dim">Smaller is better: “top 1%” means only 1 in 100 land areas ranked higher than the hidden site.</p>
            </div>
            <div className="surface rounded-2xl p-6">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Found in the top 10% of land</div>
              <div className="mt-4 space-y-4">
                <Meter value={ev.model_in_top10_pct / 100} label="Our model" right={`${ev.model_in_top10_pct}%`} tone="var(--color-flare)" />
                <Meter value={ev.baseline_in_top10_pct / 100} label="Simple rule" right={`${ev.baseline_in_top10_pct}%`} tone="var(--color-chrome)" />
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-dim">Out of {ev.positives} known {world === "moon" ? "Moon" : "Mars"} practice sites.</p>
            </div>
            <div className="surface rounded-2xl p-6">
              <div className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">What the model looks at most</div>
              <div className="mt-4 space-y-2.5">
                {ev.importance.slice(0, 6).map(([f, w]) => (
                  <Meter key={f} thin value={w / ev.importance[0][1]} label={<span className="text-[12.5px]">{FEATURE[f] ?? f}</span>} right={<span className="text-[11px] text-dim">{Math.round(w * 100)}%</span>} tone="var(--color-earth)" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-flare transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        )}
        <p className="mt-6 max-w-[880px] text-[13px] leading-relaxed text-dim">
          Honest limits: the known-site list is small and biased toward places teams can reach. Volcano and crater distance help the model a lot, which is real
          geology but also means quiet, unmapped terrain can be missed. That is why the mission formula always counts most, and why every place shows its raw data.
        </p>
      </div>
    </section>
  );
}

function Registry() {
  const [body, setBody] = useState<"all" | Source["body"]>("all");
  const [status, setStatus] = useState<"all" | Status>("all");
  const rows = useMemo(() => SOURCES.filter((s) => (body === "all" || s.body === body) && (status === "all" || s.status === status)), [body, status]);
  const chip = (on: boolean) => clsx("rounded-full border px-3.5 py-1.5 text-[12px] capitalize transition-colors", on ? "border-platinum bg-platinum text-void" : "border-line-2 text-chrome hover:border-chrome hover:text-platinum");
  return (
    <section className="border-b border-line bg-ink px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="04">Every dataset</Kicker>
        <H2>
          NASA first, <Em>checked against other agencies.</Em>
        </H2>
        <div className="mt-10 flex flex-wrap items-center gap-2">
          <Database size={14} className="mr-1 text-dim" />
          {(["all", "earth", "moon", "mars"] as const).map((b) => (
            <button key={b} onClick={() => setBody(b)} className={chip(body === b)}>
              {b !== "all" && <WorldDot world={b} className="mr-1.5 align-middle" />}
              {b}
            </button>
          ))}
          <span className="mx-2 h-5 w-px bg-line-2" />
          {(["all", "live", "planned"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === "live" ? "In use" : s === "planned" ? "Next" : "Any status"}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-dim">{rows.length} datasets</span>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          <div className="hidden grid-cols-[100px_1.3fr_1fr_1.6fr_110px_110px] gap-4 bg-panel px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-dim uppercase md:grid">
            <span>World</span>
            <span>Dataset</span>
            <span>From</span>
            <span>Used for</span>
            <span>Detail</span>
            <span>Status</span>
          </div>
          <ul>
            <AnimatePresence initial={false}>
              {rows.map((s) => (
                <motion.li
                  key={s.name}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid gap-1 border-t border-line px-5 py-3.5 text-[13px] transition-colors hover:bg-panel md:grid-cols-[100px_1.3fr_1fr_1.6fr_110px_110px] md:gap-4"
                >
                  <span className="flex items-center gap-2 text-chrome capitalize">
                    <WorldDot world={s.body} /> {s.body}
                  </span>
                  <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-platinum hover:text-flare">
                    {s.name} <ArrowUpRight size={12} className="opacity-50" />
                  </a>
                  <span className="text-chrome">{s.agency}</span>
                  <span className="text-chrome">{s.use}</span>
                  <span className="font-mono text-[12px] text-dim">{s.res}</span>
                  <span>
                    {s.status === "live" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-strong/40 bg-strong/10 px-2 py-0.5 text-[11px] text-strong">
                        <Check size={11} /> In use
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-2 px-2 py-0.5 text-[11px] text-chrome">
                        <CircleDashed size={11} /> Next
                      </span>
                    )}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <p className="mt-4 text-[12px] text-dim">
          The full data pipeline (Python) is in the repository under <span className="font-mono text-chrome">pipeline/</span>. Anyone can rebuild every number from the
          public sources above.
        </p>
      </div>
    </section>
  );
}
