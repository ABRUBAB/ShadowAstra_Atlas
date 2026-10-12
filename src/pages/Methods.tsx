import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ArrowUpRight, BrainCircuit, Check, CircleDashed, Crosshair, Database, Gauge, Layers, Mountain, Search, ShieldQuestion, Sun, Target, Workflow } from "lucide-react";
import { Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { Astronaut } from "../components/ui/Astronaut";
import { LAYERS } from "../data/layers";
import { PARAMS, TASK_WEIGHTS } from "../lib/scoring";
import { TASKS } from "../data/sites";
import { useSmoothScroll } from "../lib/useSmoothScroll";

const EASE = [0.22, 1, 0.36, 1] as const;

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
  { body: "earth", name: "SRTM-based Terrain Tiles", agency: "NASA SRTM · AWS Open Data", use: "Terrain slabs, slope & relief", res: "~30 m src", status: "live", link: "https://registry.opendata.aws/terrain-tiles/" },
  { body: "earth", name: "Sentinel-2 cloudless 2020", agency: "ESA Copernicus · EOX", use: "True-colour imagery, 3D drape, geology plates", res: "10 m", status: "live", link: "https://s2maps.eu" },
  { body: "earth", name: "Blue Marble · MODIS · LST", agency: "NASA GIBS", use: "Globe, polar imagery, thermal context", res: "250 m to 1 km", status: "live", link: "https://earthdata.nasa.gov/gibs" },
  { body: "earth", name: "ASTER GDEM v3", agency: "NASA / METI", use: "Hillshade relief", res: "30 m", status: "live", link: "https://asterweb.jpl.nasa.gov/gdem.asp" },
  { body: "earth", name: "VIIRS Black Marble", agency: "NASA / NOAA", use: "Remoteness proxy", res: "500 m", status: "live", link: "https://blackmarble.gsfc.nasa.gov/" },
  { body: "earth", name: "NASADEM", agency: "NASA / JPL", use: "Full-precision slope & relief", res: "30 m", status: "planned", link: "https://www.earthdata.nasa.gov/esds/competitive-programs/measures/nasadem" },
  { body: "earth", name: "HLS (Landsat + Sentinel-2)", agency: "NASA / USGS / ESA", use: "Surface cover & bare-rock masks", res: "30 m", status: "planned", link: "https://hls.gsfc.nasa.gov/" },
  { body: "earth", name: "EMIT L2B minerals", agency: "NASA / JPL", use: "Surface mineralogy", res: "60 m", status: "planned", link: "https://earth.jpl.nasa.gov/emit/" },
  { body: "earth", name: "Copernicus DEM GLO-30", agency: "ESA", use: "Independent DEM cross-check", res: "30 m", status: "planned", link: "https://dataspace.copernicus.eu/" },
  { body: "moon", name: "LRO LOLA DEM & hillshade", agency: "NASA", use: "Terrain slabs, Shadow Lab, polar map", res: "118 to 237 m", status: "live", link: "https://science.nasa.gov/mission/lro/lola/" },
  { body: "moon", name: "LROC WAC mosaic", agency: "NASA / ASU", use: "Visible imagery, 3D drape", res: "100 m", status: "live", link: "https://lroc.im-ldi.com/" },
  { body: "moon", name: "LRO Diviner", agency: "NASA / UCLA", use: "Temperature, cold traps", res: "~240 m", status: "planned", link: "https://www.diviner.ucla.edu/" },
  { body: "moon", name: "SELENE / Kaguya TC DTM", agency: "JAXA", use: "Independent lunar terrain", res: "10 m", status: "planned", link: "https://darts.isas.jaxa.jp/planet/pdap/selene/" },
  { body: "moon", name: "Chandrayaan-2 OHRC / DFSAR", agency: "ISRO", use: "Polar imaging & radar", res: "0.25 to 20 m", status: "planned", link: "https://pradan.issdc.gov.in/" },
  { body: "mars", name: "MGS MOLA DEM", agency: "NASA", use: "Terrain slabs, regional elevation", res: "463 m", status: "live", link: "https://attic.gsfc.nasa.gov/mola/" },
  { body: "mars", name: "Viking MDIM 2.1", agency: "NASA / USGS", use: "Colour imagery, 3D drape", res: "232 m", status: "live", link: "https://astrogeology.usgs.gov/" },
  { body: "mars", name: "Mars Odyssey THEMIS", agency: "NASA / ASU", use: "Thermal IR, rock vs. dust", res: "100 m", status: "live", link: "https://themis.mars.asu.edu/" },
  { body: "mars", name: "MRO HiRISE DTMs", agency: "NASA / UArizona", use: "Wheel-scale slope & roughness", res: "1 m", status: "planned", link: "https://www.uahirise.org/dtm/" },
  { body: "mars", name: "MRO CTX mosaic", agency: "NASA / Caltech", use: "Regional morphology", res: "5 m", status: "planned", link: "https://murray-lab.caltech.edu/CTX/" },
  { body: "mars", name: "Mars Express HRSC DTM", agency: "ESA / DLR", use: "Independent Mars terrain", res: "50 m", status: "planned", link: "https://www.cosmos.esa.int/web/psa/mars-express" },
];

const STAGES = [
  { icon: Target, t: "Define the rehearsal", d: "Mission task + target + physical scale, e.g. a 2 km rover corridor at Mons Mouton.", live: true },
  { icon: Mountain, t: "Measure the target", d: "Slope, relief and roughness from LOLA / MOLA; Sun regime from orbital geometry.", live: true },
  { icon: Search, t: "Screen Earth", d: "Same features from SRTM / NASADEM; mask water, vegetation, cloud and protected land.", live: false },
  { icon: Gauge, t: "Rank honestly", d: "A transparent physical baseline first, our model must beat it on held-out regions.", live: false },
  { icon: ShieldQuestion, t: "Abstain when unsure", d: "Missing coverage or disagreement returns “insufficient evidence”, never a confident score.", live: false },
  { icon: Workflow, t: "Hand off a passport", d: "Protocol, best season, reality gaps, permits, travel footprint and data lineage.", live: false },
];

const FORMULAS = [
  { k: "Topography", f: "0.65 · overlap(slopeₑ, slopeₜ) + 0.35 · (1 − |log₁₀ reliefₑ/reliefₜ|)", d: "Slope histograms and relief on one shared grid, after identical smoothing." },
  { k: "Lighting", f: "1 − W₁(sunₑ, sunₜ) / 25°", d: "Earth-mover distance between daylight Sun-elevation distributions, best season." },
  { k: "Analog Fit", f: "Σ wᵢ·vᵢ / Σ wᵢ", d: "Weights come from the mission task; reality gaps are shown, never summed." },
];

const MODEL = [
  { icon: Gauge, t: "Physical baseline", d: "Multi-scale slope, curvature, roughness and relief → distance + LightGBM LambdaRank.", m: "must be beaten" },
  { icon: Layers, t: "Terrain encoder", d: "Self-supervised on matched-scale DEM patches from Earth, Moon and Mars (SimCLR / masked patches).", m: "body-agnostic geometry" },
  { icon: BrainCircuit, t: "Mission-conditioned ranker", d: "Terrain embedding + EMIT/HLS/LST context + a mission token → relevance.", m: "nDCG@5 / @10" },
  { icon: Crosshair, t: "Uncertainty & abstention", d: "Deep ensembles + conformal prediction; region-held-out splits, hard negatives.", m: "coverage vs. abstention curve" },
];

const PRINCIPLES = [
  "No number on screen that does not come from a dataset or the pipeline.",
  "Known analogs are calibration controls, not new discoveries.",
  "Compare relief only at a matched physical scale, using each body’s own radius.",
  "Every layer shows its instrument, resolution and provider.",
  "Earth cannot reproduce gravity, vacuum or radiation, we say so on every site.",
  "Field visits need permission, local partnership and environmental care.",
];

function Words({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 1.2, ease: EASE, delay: delay + i * 0.06 }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-[11px] text-flare">{n}</span>
      <motion.span className="block h-px w-10 origin-left bg-line-2" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
      <span className="font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">{children}</span>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} className="mt-6 max-w-[920px] text-[clamp(30px,4vw,58px)] leading-[1.03] font-medium tracking-[-0.038em]">
      {children}
    </motion.h2>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-serif font-normal text-chrome italic">{children}</span>;
}

export default function Methods() {
  useSmoothScroll();
  const live = LAYERS.length;
  const planned = SOURCES.filter((s) => s.status === "planned").length;
  return (
    <div className="bg-void">
      <Nav />

      <section className="relative overflow-hidden border-b border-line">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_80%_at_70%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-[1400px] items-end gap-10 px-4 pt-28 pb-20 sm:px-6 lg:grid-cols-[1fr_auto] lg:pt-36">
          <div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">
              <span className="h-px w-8 bg-chrome/50" /> Data & method
            </motion.div>
            <h1 className="mt-8 text-[clamp(40px,6vw,92px)] leading-[0.98] font-medium tracking-[-0.045em]">
              <Words text="Open data in." />
              <br />
              <Words text="Honest evidence out." className="font-serif font-normal tracking-[-0.02em] text-flare italic" delay={0.25} />
            </h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.6 }} className="mt-8 max-w-2xl text-[17px] leading-relaxed text-chrome">
              NASA asks for new Earth analogs found with open Earth, Moon and Mars data. Here is how we do it, and what already runs in your browser.
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="hidden lg:block">
            <Astronaut size={130} mood="focused" action="drill" say="Every number here traces back to a dataset." sayAlign="left" />
          </motion.div>
        </div>
        <div className="relative mx-auto grid max-w-[1400px] grid-cols-2 border-t border-line md:grid-cols-4">
          {[
            [live, "live map layers"],
            [planned, "datasets in the pipeline"],
            [4, "space agencies"],
            [PARAMS.length, "scored & shown parameters"],
          ].map(([n, l], i) => (
            <motion.div key={l as string} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.8 + i * 0.08 }} className="border-line px-4 py-8 sm:px-6 [&:not(:last-child)]:border-r">
              <div className="font-mono text-[44px] leading-none font-light tabular">{n}</div>
              <div className="mt-2 text-[13px] text-dim">{l}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <Pipeline />
      <Scoring />
      <Registry />
      <Model />

      <section className="border-b border-line px-4 py-28 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Kicker n="05">Principles</Kicker>
            <H2>
              Six rules <Em>we don’t break.</Em>
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
          <Link to="/lab" className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
            Open the Analog Lab <ArrowRight size={16} />
          </Link>
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
        <Kicker n="01">Pipeline</Kicker>
        <H2>
          Six steps from a mission question <Em>to a field passport.</Em>
        </H2>
        <div ref={ref} className="relative mt-16">
          <div className="absolute top-[22px] right-0 left-0 hidden h-px bg-line lg:block" />
          <motion.div style={{ scaleX: p }} className="absolute top-[22px] right-0 left-0 hidden h-px origin-left bg-flare lg:block" />
          <ol className="grid gap-6 lg:grid-cols-6">
            {STAGES.map((s, i) => (
              <motion.li key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.07 }} className="relative">
                <div className={clsx("relative z-10 grid size-11 place-items-center rounded-full border bg-void", s.live ? "border-flare text-flare" : "border-line-2 text-chrome")}>
                  <s.icon size={18} strokeWidth={1.5} />
                </div>
                <div className="mt-6 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-1 text-[18px] font-medium tracking-tight">{s.t}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-chrome">{s.d}</p>
                <span className={clsx("mt-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", s.live ? "border-strong/40 bg-strong/10 text-strong" : "border-dashed border-line-2 text-chrome")}>
                  {s.live ? <Check size={11} /> : <CircleDashed size={11} />} {s.live ? "Live in prototype" : "Hackathon build"}
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
            <Kicker n="02">How we score an Earth analog</Kicker>
            <H2>
              Six parameters, weighted by the mission, <Em>never one universal number.</Em>
            </H2>
          </div>
          <div className="hidden md:block">
            <Astronaut size={96} mood="thinking" action="idle" />
          </div>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {FORMULAS.map((f, i) => (
            <motion.div key={f.k} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }} className="rounded-2xl border border-line bg-panel p-6">
              <div className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">{f.k}</div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-void px-4 py-3 font-mono text-[13px] whitespace-nowrap text-flare">{f.f}</div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-chrome">{f.d}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {PARAMS.map((p) => {
            const kind = p.id === "radiation" ? "Reality gap" : p.id === "topography" || p.id === "lighting" ? "Computed today" : "Demo → model";
            const tone = p.id === "radiation" ? "text-weak" : kind === "Computed today" ? "text-strong" : "text-chrome";
            return (
              <div key={p.id} className="bg-panel p-6 transition-colors hover:bg-panel-2">
                <div className="flex items-center justify-between">
                  <span className="text-[17px] text-platinum">{p.label}</span>
                  <span className={clsx("font-mono text-[10px] tracking-widest uppercase", tone)}>{kind}</span>
                </div>
                <p className="mt-2 text-[13.5px] text-chrome">{p.what}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 font-mono text-[10px] tracking-[0.22em] text-dim uppercase">Mission weights · hover a row</div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-panel font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
              <tr>
                <th className="px-5 py-3 font-normal">Mission task</th>
                {keys.map((k) => (
                  <th key={k} className="px-5 py-3 text-right font-normal">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TASKS.map((t) => (
                <tr key={t.id} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} className={clsx("border-t border-line transition-colors", hover === t.id && "bg-panel")}>
                  <td className="px-5 py-3 text-platinum">{t.label}</td>
                  {keys.map((k) => {
                    const w = TASK_WEIGHTS[t.id][k];
                    return (
                      <td key={k} className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
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
        <div className="mt-5 flex flex-wrap gap-5 font-mono text-[11px] text-dim">
          <span>
            <span className="text-strong">●</span> ≥ 0.75 high match
          </span>
          <span>
            <span className="text-partial">●</span> 0.50 to 0.74 medium
          </span>
          <span>
            <span className="text-weak">●</span> &lt; 0.50 low
          </span>
        </div>
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
    <section className="border-b border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="03">Source registry</Kicker>
        <H2>
          NASA first, <Em>cross-checked with ESA, JAXA and ISRO.</Em>
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
              {s === "live" ? "Live in app" : s === "planned" ? "Planned" : "Any status"}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-dim">{rows.length} datasets</span>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          <div className="hidden grid-cols-[110px_1.3fr_1fr_1.4fr_110px_130px] gap-4 bg-panel px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-dim uppercase md:grid">
            <span>Body</span>
            <span>Dataset</span>
            <span>Agency</span>
            <span>Used for</span>
            <span>Resolution</span>
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
                  className="grid gap-1 border-t border-line px-5 py-3.5 text-[13px] transition-colors hover:bg-panel md:grid-cols-[110px_1.3fr_1fr_1.4fr_110px_130px] md:gap-4"
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
                        <Check size={11} /> Live in app
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-2 px-2 py-0.5 text-[11px] text-chrome">
                        <CircleDashed size={11} /> Planned
                      </span>
                    )}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Model() {
  return (
    <section className="border-b border-line bg-ink px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Kicker n="04">Our model</Kicker>
            <H2>
              A matcher that <Em>must earn its place.</Em>
            </H2>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-dashed border-line-2 px-4 py-2 text-[12px] text-chrome">
            <Sun size={13} className="text-flare" /> Trained on Kaggle at the hackathon · demo values until then
          </div>
        </div>
        <ol className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {MODEL.map((m, i) => (
            <motion.li
              key={m.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="group relative flex flex-col rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-line-2"
            >
              <div className="flex items-center justify-between">
                <m.icon size={20} strokeWidth={1.5} className="text-platinum" />
                <span className="font-mono text-[11px] text-dim">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-10 text-[18px] font-medium tracking-tight">{m.t}</h3>
              <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-chrome">{m.d}</p>
              <span className="mt-5 w-fit rounded-full border border-line-2 px-2.5 py-1 font-mono text-[10.5px] text-dim">{m.m}</span>
              <span className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-flare transition-transform duration-700 group-hover:scale-x-100" />
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
