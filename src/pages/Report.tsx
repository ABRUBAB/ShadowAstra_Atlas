import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Logo } from "../components/ui/Chrome";
import { TARGET_BY_ID, TASKS, type TaskId } from "../data/sites";
import { TASK_WEIGHTS, greatCircleKm, tripCo2Tonnes } from "../lib/scoring";
import { formatCoord } from "../lib/geo";
import { sunRegime } from "../lib/sun";
import { MODEL_MIX, MONTHS, scoreCell, useGrid } from "../lib/grid";
import { DHAKA, FACTORS, FIELD_TESTS } from "../lib/mission";
import { useEarthThumb } from "../lib/thumbs";
import { sharePct } from "../components/find/MineralCard";
import { pinpointVerdict } from "../components/find/PinpointCard";
import { usePinpoint } from "../lib/pinpoint";
import { useValidation } from "../lib/validation";

/** A clean, printable site report: the characterization dossier for a field team. */
export default function Report() {
  const [p] = useSearchParams();
  const navigate = useNavigate();
  const { grid, progress } = useGrid();
  const targetId = TARGET_BY_ID[p.get("target") ?? ""] ? p.get("target")! : "jezero";
  const task = (TASKS.some((t) => t.id === p.get("task")) ? p.get("task") : "astrobio") as TaskId;
  const at = (p.get("at") ?? "").split(",").map(Number);
  const home = p.get("hlat") ? { name: p.get("home") ?? "Home", lat: +p.get("hlat")!, lon: +p.get("hlon")! } : DHAKA;
  const k = grid && at.length === 2 ? grid.cellAt(at[0], at[1], 3) : -1;
  const T = TARGET_BY_ID[targetId];
  const t = grid?.targets[targetId];
  const thumb = useEarthThumb(k >= 0 && grid ? grid.lat(k) : null, k >= 0 && grid ? grid.lon(k) : null, 640);
  const pin = usePinpoint(k >= 0 && grid ? grid.lat(k) : null, k >= 0 && grid ? grid.lon(k) : null, t ? t.terrain.hist : null);
  const { v: validation } = useValidation();
  const sunT = useMemo(() => sunRegime(T.body, T.lat), [T.body, T.lat]);
  useEffect(() => {
    document.title = "Site report · ShadowAstra Atlas";
  }, []);

  if (!grid || !t || k < 0)
    return <div className="grid min-h-dvh place-items-center bg-void text-[13px] text-chrome">{grid ? "Place not found." : `Loading NASA data… ${Math.round(progress * 100)}%`}</div>;

  const lat = grid.lat(k);
  const lon = grid.lon(k);
  const nm = grid.name(k);
  const cs = scoreCell(grid, k, { target: t, task, weights: TASK_WEIGHTS[task], modelMix: MODEL_MIX });
  const v = (n: string) => grid.value(n, k);
  const km = greatCircleKm(home.lat, home.lon, lat, lon);
  const taskLabel = TASKS.find((x) => x.id === task)!.label;
  const f = (dims: readonly string[]) => dims.reduce((a, d) => a + cs.dims[d as keyof typeof cs.dims], 0) / dims.length;
  const fmt = (x: number | null, u: string, d = 0) => (x === null ? "n/a" : `${x.toFixed(d)}${u}`);
  const volc = grid.volcano(k);
  const crater = grid.crater(k);
  const conf = grid.confidence(k, T.body);
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const res = t.resources;
  const mins = grid.minerals(k);
  const mm = grid.mineralMatch(k, t);
  const pc = sharePct;

  return (
    <div className="report min-h-dvh bg-[#ece7dc] py-8 text-[#1c1a16] print:bg-white print:py-0">
      <style>{`@media print { @page { size: A4; margin: 14mm } .no-print { display: none !important } body::before { display: none } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-[#55514a] hover:text-[#1c1a16]">
          <ArrowLeft size={14} /> Back
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-[#1c1a16] px-4 py-2 text-[13px] text-white">
          <Printer size={14} /> Save as PDF
        </button>
      </div>
      <article className="mx-auto max-w-[820px] bg-white px-10 py-10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] print:shadow-none" data-theme="light">
        <header className="flex items-start justify-between border-b border-[#dcd5c7] pb-5">
          <div>
            <div className="font-mono text-[10px] tracking-[0.24em] text-[#6a665e] uppercase">Analog site report</div>
            <h1 className="mt-1 text-[30px] leading-tight font-medium tracking-[-0.02em]">{nm.title}</h1>
            <div className="mt-1 text-[13px] text-[#55514a]">
              {nm.subtitle ? `${nm.subtitle} · ` : ""}
              <span className="font-mono">{formatCoord(lat, lon)}</span>
            </div>
          </div>
          <div className="text-right">
            <Logo size={28} />
            <div className="mt-2 font-mono text-[10px] text-[#6a665e]">{today}</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-[1.1fr_1fr] gap-6">
          <figure>
            {thumb ? <img src={thumb} alt="Satellite view, 50 km across" className="aspect-square w-full rounded-md object-cover" /> : <div className="aspect-square w-full rounded-md bg-[#f2ede3]" />}
            <figcaption className="mt-1 font-mono text-[9.5px] text-[#6a665e]">50 × 50 km, north up · ESA Sentinel-2 cloudless 2020</figcaption>
          </figure>
          <div>
            <div className="text-[12px] text-[#6a665e]">Mission</div>
            <div className="text-[16px] font-medium">
              {taskLabel} · {T.name} ({T.body === "moon" ? "Moon" : "Mars"})
            </div>
            <div className="mt-4 text-[12px] text-[#6a665e]">Match score</div>
            <div className="font-mono text-[44px] leading-none font-light">{cs.total.toFixed(2)}</div>
            <div className="mt-1 text-[12px] text-[#55514a]">0 to 1. Measured from NASA data, with {Math.round(MODEL_MIX * 100)}% from three models trained together on 38 known test sites.</div>
            <div className="mt-2 text-[12px] text-[#55514a]">
              Confidence: <b>{conf.level === "high" ? "high" : conf.level === "medium" ? "medium" : "not enough evidence"}</b> ({Math.round(conf.cover * 100)}% of measurements real, model runs agree within {Math.round(conf.spread * 100)} points)
            </div>
            <table className="mt-4 w-full text-[12.5px]">
              <tbody>
                {FACTORS.map((x) => (
                  <tr key={x.id} className="border-t border-[#eee8dc]">
                    <td className="py-1.5">{x.label}</td>
                    <td className="py-1.5 text-right font-mono">{f(x.dims).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#eee8dc]">
                  <td className="py-1.5">Learned model</td>
                  <td className="py-1.5 text-right font-mono">{cs.model.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[15px] font-medium">Characterization: this place compared with {T.name}</h2>
          <table className="mt-3 w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] tracking-wide text-[#6a665e] uppercase">
                <th className="py-1 font-normal">Factor</th>
                <th className="py-1 font-normal">This place (Earth)</th>
                <th className="py-1 font-normal">{T.name}</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-[#eee8dc]">
                <td className="py-2">Ground shape</td>
                <td className="py-2">
                  slope {fmt(v("f_slope"), "°", 1)}, height range {fmt(v("f_relief") === null ? null : v("f_relief")! / 1000, " km", 2)}
                </td>
                <td className="py-2">
                  slope {t.terrain.mean_slope.toFixed(1)}°, height range {(t.terrain.relief / 1000).toFixed(2)} km
                </td>
              </tr>
              <tr className="border-t border-[#eee8dc]">
                <td className="py-2">Best 10 km spot</td>
                <td className="py-2" colSpan={2}>
                  {pin === null
                    ? "working it out…"
                    : pin === "failed"
                      ? "terrain tiles could not be loaded"
                      : `${formatCoord(pin.best.lat, pin.best.lon)}: slopes ${Math.round(pin.best.score * 100)}% alike (an average 10 km piece of this place: ${Math.round(pin.mean * 100)}%), average slope ${pin.best.meanSlope.toFixed(1)}°, height range ${Math.round(pin.best.relief)} m. `}
                  <span className="text-[#6a665e]">{pinpointVerdict(validation?.pinpoint) ?? ""}</span>
                </td>
              </tr>
              <tr className="border-t border-[#eee8dc]">
                <td className="py-2">Rocks & craters</td>
                <td className="py-2">
                  {volc && volc.km < 300 ? `volcano ${volc.name} ${Math.round(volc.km)} km` : "no volcano near"}; {crater && crater.score > 0.2 ? `crater ${crater.name}` : "no crater near"}; bare ground {fmt(v("f_barren") === null ? null : v("f_barren")! * 100, "%")}; main rock {grid.rock(k)?.label.toLowerCase() ?? "unknown"} (GLiM)
                </td>
                <td className="py-2">
                  {T.kind}
                  {t.rock ? `; main rocks: ${t.rock.label.toLowerCase()}` : ""}
                  {res?.feo_wt_pct !== undefined ? `; ${res.feo_wt_pct.toFixed(0)}% iron oxide and ${res.tio2_wt_pct!.toFixed(1)}% titanium oxide by weight (Lunar Prospector, about 150 km)` : ""}
                </td>
              </tr>
              <tr className="border-t border-[#eee8dc]">
                <td className="py-2">Minerals</td>
                <td className="py-2">
                  {mins
                    ? `clays ${pc(mins.clay)}, sulfates ${pc(mins.sulfate)}, carbonates ${pc(mins.carbonate)}, iron oxides ${pc(mins.iron)} (NASA EMIT)${mm !== null ? `; match with ${T.name} ${mm.toFixed(2)}` : ""}`
                    : "no clear EMIT view (plants, water, snow or cloud cover the ground, or beyond 52°)"}
                </td>
                <td className="py-2">{t.minerals ? `${t.minerals.families.join(", ")} (${t.minerals.source})` : T.body === "moon" ? "none: the Moon never had liquid water" : "no water-made minerals mapped"}</td>
              </tr>
              <tr className="border-t border-[#eee8dc]">
                <td className="py-2">Cold & light</td>
                <td className="py-2">
                  coldest night {fmt(v("f_lst_night_min"), " °C")}, hottest ground {fmt(v("f_lst_day_max"), " °C")}, best light in {MONTHS[t.light_month[grid.row[k]] ?? 0]}
                </td>
                <td className="py-2">
                  {res?.temp_avg_c !== undefined
                    ? `ground ${Math.round(res.temp_avg_c)} °C on average, typically ${Math.round(res.temp_max_c!)} °C at warmest${res.temp_min_c !== undefined ? ` and ${Math.round(res.temp_min_c)} °C before dawn` : ""} (LRO Diviner, ${Math.round(res.radius_km ?? 10)} km); `
                    : ""}
                  Sun at most {Math.round(sunT.maxElev)}°, typically {Math.round(sunT.medianElev)}°
                </td>
              </tr>
              <tr className="border-t border-[#eee8dc]">
                <td className="py-2">Ice & loose ground</td>
                <td className="py-2">
                  rain {fmt(v("f_precip"), " mm/yr")}, snow and ice {fmt(v("f_snowice") === null ? null : v("f_snowice")! * 100, "%")}
                </td>
                <td className="py-2">
                  {res?.ice_1m_share !== undefined
                    ? `water ice stable at the surface on ${Math.round(res.ice_surface_share! * 100)}% and within 1 m on ${Math.round(res.ice_1m_share * 100)}% of the ground within 10 km (LRO Diviner)`
                    : res?.h2o_wt_pct != null
                      ? `${res.h2o_wt_pct.toFixed(1)}% water by weight in the topsoil (Mars Odyssey GRS, 5° map)`
                      : T.tasks.includes("ice") || T.tasks.includes("polar")
                        ? "water ice likely nearby"
                        : "ice not the focus"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-[15px] font-medium">Field tests to run here</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[12.5px]">
              {FIELD_TESTS[task].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[15px] font-medium">Planning</h2>
            <ul className="mt-2 space-y-1 text-[12.5px]">
              <li>
                From {home.name}: {Math.round(km).toLocaleString()} km, about {tripCo2Tonnes(km, 4).toFixed(1)} t CO₂ for four people, return
              </li>
              <li>Nearest town: {nm.place ? `${nm.place}, ${Math.round(nm.placeKm ?? 0)} km` : "none listed"}</li>
              <li>Permission: {lat < -60 ? "Antarctic Treaty environmental permit" : "local authorities, land owners and communities"}</li>
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-md bg-[#f6f2ea] p-4 text-[12.5px]">
          <h2 className="text-[14px] font-medium">What Earth can't copy</h2>
          <p className="mt-1">
            {T.body === "moon" ? "Gravity is six times stronger on Earth, there is air, and Earth's magnetic field blocks space radiation. Lunar nights last two weeks." : "Gravity is 2.6 times stronger on Earth, the air is 160 times thicker, and Earth's magnetic field blocks space radiation."}
          </p>
        </section>

        <footer className="mt-8 border-t border-[#dcd5c7] pt-4 text-[10.5px] leading-relaxed text-[#6a665e]">
          Data: SRTM terrain (AWS Terrain Tiles), NASA POWER climatology, NASA GIBS MODIS ground temperature, plants, snow and land cover, NASA EMIT L3 minerals (LP DAAC), Smithsonian GVP volcanoes, Earth Impact
          Database, Natural Earth;{T.body === "moon" ? " LRO LOLA 118 m" : " MGS MOLA 463 m"} heights (USGS Astrogeology){res ? ` and ${res.source}` : ""} for {T.name}. Method and model tests: shadowastra-atlas.vercel.app/methods. Team ShadowAstra, Dhaka · NASA Space Apps
          Challenge 2026. NASA does not endorse this report.
        </footer>
      </article>
    </div>
  );
}
