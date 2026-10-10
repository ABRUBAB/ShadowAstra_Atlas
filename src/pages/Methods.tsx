import { ArrowUpRight, Check, CircleDashed } from "lucide-react";
import { Eyebrow, Footer, Nav, WorldDot } from "../components/ui/Chrome";
import { LAYERS } from "../data/layers";

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
  { body: "earth", name: "NASADEM", agency: "NASA / JPL", use: "Slope, roughness, relief", res: "30 m", status: "planned", link: "https://www.earthdata.nasa.gov/esds/competitive-programs/measures/nasadem" },
  { body: "earth", name: "ASTER GDEM v3", agency: "NASA / METI", use: "Terrain relief (live hillshade)", res: "30 m", status: "live", link: "https://asterweb.jpl.nasa.gov/gdem.asp" },
  { body: "earth", name: "Copernicus DEM GLO-30", agency: "ESA", use: "Independent DEM cross-check", res: "30 m", status: "planned", link: "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM" },
  { body: "earth", name: "HLS (Landsat + Sentinel-2)", agency: "NASA / USGS / ESA", use: "Surface cover & bare-rock masks", res: "30 m", status: "planned", link: "https://hls.gsfc.nasa.gov/" },
  { body: "earth", name: "EMIT L2B minerals", agency: "NASA / JPL", use: "Surface mineralogy in arid regions", res: "60 m", status: "planned", link: "https://earth.jpl.nasa.gov/emit/" },
  { body: "earth", name: "MODIS LST · true colour", agency: "NASA", use: "Thermal regime, context imagery", res: "250 m–1 km", status: "live", link: "https://modis.gsfc.nasa.gov/" },
  { body: "earth", name: "VIIRS Black Marble", agency: "NASA / NOAA", use: "Remoteness proxy", res: "500 m", status: "live", link: "https://blackmarble.gsfc.nasa.gov/" },
  { body: "moon", name: "LRO LOLA DEMs & hillshade", agency: "NASA", use: "Polar terrain, slope, illumination context", res: "5–118 m", status: "live", link: "https://science.nasa.gov/mission/lro/lola/" },
  { body: "moon", name: "LROC WAC mosaic", agency: "NASA / ASU", use: "Visible context", res: "100 m", status: "live", link: "https://lroc.im-ldi.com/" },
  { body: "moon", name: "LRO Diviner", agency: "NASA / UCLA", use: "Temperature, cold traps", res: "~240 m", status: "planned", link: "https://www.diviner.ucla.edu/" },
  { body: "moon", name: "SELENE / Kaguya TC DTM", agency: "JAXA", use: "Independent lunar terrain", res: "10 m", status: "planned", link: "https://darts.isas.jaxa.jp/planet/pdap/selene/" },
  { body: "moon", name: "Chandrayaan-2 OHRC / DFSAR", agency: "ISRO", use: "High-res polar imaging & radar", res: "0.25–20 m", status: "planned", link: "https://pradan.issdc.gov.in/" },
  { body: "mars", name: "MGS MOLA", agency: "NASA", use: "Regional elevation", res: "463 m", status: "live", link: "https://attic.gsfc.nasa.gov/mola/" },
  { body: "mars", name: "Viking MDIM 2.1", agency: "NASA / USGS", use: "Global colour context", res: "232 m", status: "live", link: "https://astrogeology.usgs.gov/" },
  { body: "mars", name: "Mars Odyssey THEMIS", agency: "NASA / ASU", use: "Thermal inertia, rock vs. dust", res: "100 m", status: "live", link: "https://themis.mars.asu.edu/" },
  { body: "mars", name: "MRO HiRISE DTMs", agency: "NASA / UArizona", use: "Wheel-scale slope & roughness", res: "1 m", status: "planned", link: "https://www.uahirise.org/dtm/" },
  { body: "mars", name: "MRO CTX mosaic", agency: "NASA / Caltech", use: "Regional morphology", res: "5 m", status: "planned", link: "https://murray-lab.caltech.edu/CTX/" },
  { body: "mars", name: "Mars Express HRSC DTM", agency: "ESA / DLR", use: "Independent Mars terrain", res: "50 m", status: "planned", link: "https://www.cosmos.esa.int/web/psa/mars-express" },
];

const STAGES = [
  { k: "01", t: "Define the rehearsal", d: "Mission task + target region + physical scale (e.g. a 2 km rover corridor at Mons Mouton)." },
  { k: "02", t: "Measure the target", d: "From LOLA / MOLA / HiRISE: slope and roughness distributions, relief, thermal and material context." },
  { k: "03", t: "Screen Earth", d: "Tile candidate regions from NASADEM, HLS, EMIT and MODIS; mask vegetation, water, cloud and protected land." },
  { k: "04", t: "Rank honestly", d: "A transparent physical-feature baseline first; our trained terrain encoder must beat it on held-out regions." },
  { k: "05", t: "Abstain when unsure", d: "Missing coverage or disagreement returns “insufficient evidence”, never a confident score." },
  { k: "06", t: "Hand off a passport", d: "Test protocol, measurable outcomes, reality gaps, permits, stewardship and data lineage." },
];

const PRINCIPLES = [
  "No number on screen that does not come from a dataset or the pipeline.",
  "Known analogs are calibration controls, not new discoveries.",
  "Compare relief only at a matched physical scale, using each body’s own radius.",
  "Every layer shows its instrument, resolution and provider.",
  "Earth cannot reproduce gravity, vacuum or radiation — we say so on every site.",
  "Field visits need permission, local partnership and environmental care.",
];

export default function Methods() {
  const live = LAYERS.length;
  return (
    <div className="bg-void">
      <Nav />
      <section className="relative overflow-hidden border-b border-line px-4 pt-24 pb-20 sm:px-6">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_80%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto max-w-[1400px]">
          <Eyebrow>Data & method</Eyebrow>
          <h1 className="mt-8 max-w-[1000px] text-[clamp(38px,5.6vw,84px)] leading-[0.98] font-medium tracking-[-0.045em]">
            Open data in. <span className="font-serif font-normal italic text-earth">Honest evidence out.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-chrome">
            The challenge asks for new terrestrial analogs identified and characterized with open Earth, Moon and Mars
            data from NASA and other space agencies. This is how ShadowAstra Atlas will do it — and what is already running.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 text-[13px]">
            <span className="flex items-center gap-2 rounded-full border border-strong/40 bg-strong/10 px-3 py-1.5 text-strong">
              <Check size={14} /> {live} live NASA layers in the prototype
            </span>
            <span className="flex items-center gap-2 rounded-full border border-dashed border-line-2 px-3 py-1.5 text-chrome">
              <CircleDashed size={14} /> {SOURCES.filter((s) => s.status === "planned").length} datasets planned for the pipeline
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-line px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <Eyebrow>Pipeline</Eyebrow>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s) => (
              <li key={s.k} className="bg-panel p-7">
                <div className="font-mono text-xs text-earth">{s.k}</div>
                <div className="mt-6 text-xl font-medium tracking-tight">{s.t}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-chrome">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <Eyebrow>Source registry</Eyebrow>
          <h2 className="mt-6 text-[clamp(26px,3vw,42px)] font-medium tracking-tight">NASA first, cross-checked with ESA, JAXA and ISRO.</h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-ink font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
                <tr>
                  <th className="px-4 py-3 font-normal">Body</th>
                  <th className="px-4 py-3 font-normal">Dataset</th>
                  <th className="px-4 py-3 font-normal">Agency</th>
                  <th className="px-4 py-3 font-normal">Used for</th>
                  <th className="px-4 py-3 font-normal">Resolution</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.name} className="border-t border-line transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 capitalize text-chrome">
                        <WorldDot world={s.body} /> {s.body}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-platinum hover:text-earth">
                        {s.name} <ArrowUpRight size={12} className="opacity-50" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-chrome">{s.agency}</td>
                    <td className="px-4 py-3 text-chrome">{s.use}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-dim">{s.res}</td>
                    <td className="px-4 py-3">
                      {s.status === "live" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-strong/40 bg-strong/10 px-2 py-0.5 text-[11px] text-strong">
                          <Check size={11} /> Live in app
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-2 px-2 py-0.5 text-[11px] text-chrome">
                          <CircleDashed size={11} /> Planned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-line px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow>Our model</Eyebrow>
            <h2 className="mt-6 text-[clamp(26px,3vw,42px)] font-medium tracking-tight">A matcher that must earn its place.</h2>
            <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-chrome">
              <p>
                <span className="text-platinum">Baseline.</span> Multi-scale distributions of slope, relief and roughness,
                compared with a transparent distance and a tree ranker.
              </p>
              <p>
                <span className="text-platinum">Terrain encoder.</span> A compact network trained on Earth and planetary DEM
                tiles at matched physical scale (self-supervised, then task-pair ranking), on Kaggle GPUs.
              </p>
              <p>
                <span className="text-platinum">Earth context.</span> Frozen features from NASA/IBM Prithvi-EO-2.0 benchmarked
                against alternatives — used only where validation shows a gain.
              </p>
              <p>
                <span className="text-platinum">Evaluation.</span> Region-held-out splits, hard negatives (looks right, tests
                wrong), nDCG and expert agreement, plus coverage–abstention curves.
              </p>
            </div>
          </div>
          <div>
            <Eyebrow>Principles</Eyebrow>
            <ul className="mt-6 border-t border-line">
              {PRINCIPLES.map((p, i) => (
                <li key={p} className="flex gap-5 border-b border-line py-4 text-[15px] text-platinum">
                  <span className="font-mono text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
