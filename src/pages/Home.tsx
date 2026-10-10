import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { ArrowRight, ArrowUpRight, Check, CircleDashed, Radar } from "lucide-react";
import { Eyebrow, Footer, Github, Nav, REPO_URL, WorldDot } from "../components/ui/Chrome";
import { EARTH_SITES, SCREENING_REGIONS, TARGETS, TARGET_BY_ID, TASKS } from "../data/sites";
import { LAYERS, LAYERS_BY_BODY } from "../data/layers";
import { formatCoord, polarPixel, POLAR_IMAGE_SIZE } from "../lib/geo";
import { useSmoothScroll } from "../lib/useSmoothScroll";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const HeroScene = lazy(() => import("../components/three/HeroScene"));

export default function Home() {
  useSmoothScroll();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(".hero-title", { type: "words", mask: "words" });
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(split.words, { yPercent: 110, duration: 1.1, stagger: 0.05, delay: 0.2 })
          .from(".hero-fade", { opacity: 0, y: 16, duration: 0.8, stagger: 0.08 }, "-=0.7")
          .from(".hero-hud", { opacity: 0, duration: 1 }, "-=0.4");

        ScrollTrigger.batch("[data-reveal]", {
          start: "top 88%",
          once: true,
          onEnter: (els) =>
            gsap.fromTo(els, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: "power3.out" }),
        });

        gsap.utils.toArray<HTMLElement>(".split-reveal").forEach((el) => {
          const s = SplitText.create(el, { type: "words", mask: "words" });
          gsap.from(s.words, {
            yPercent: 100,
            duration: 0.9,
            stagger: 0.035,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
          });
        });

        gsap.to(".hero-scene", {
          yPercent: 18,
          opacity: 0.35,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
        return () => split.revert();
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-reveal]", { opacity: 1 });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="bg-void">
      <Nav overlay />
      <Hero />
      <SourceMarquee />
      <Challenge />
      <Worlds />
      <FalseFriend />
      <MoonBase />
      <Pipeline />
      <Library />
      <Progress />
      <Team />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  const [i, setI] = useState(0);
  const sites = EARTH_SITES;
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % sites.length), 3200);
    return () => clearInterval(t);
  }, [sites.length]);
  const s = sites[i];
  const pair = TARGET_BY_ID[s.pairs[0]];

  return (
    <section className="hero relative h-dvh min-h-[680px] overflow-hidden">
      <div className="hero-scene absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_50%,rgba(52,102,216,0.18),transparent_70%)]" />
        <Suspense fallback={null}>
          <HeroScene compact={typeof window !== "undefined" && window.innerWidth < 900} />
        </Suspense>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,3,6,0.92)_0%,rgba(2,3,6,0.55)_38%,transparent_62%)] max-[900px]:bg-[linear-gradient(180deg,transparent_0%,transparent_30%,rgba(2,3,6,0.88)_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-4 pb-24 sm:px-6 min-[900px]:justify-center min-[900px]:pb-0">
        <div className="pointer-events-auto max-w-[860px]">
          <Eyebrow className="hero-fade mb-6">NASA Space Apps 2026 · Team ShadowAstra · Dhaka</Eyebrow>
          <h1 className="hero-title text-[clamp(40px,min(7vw,11vh),116px)] leading-[0.94] font-medium tracking-[-0.045em] text-platinum">
            <span className="block">Rehearse other worlds</span>
            <span className="block font-serif font-normal tracking-[-0.02em] text-earth italic">on this one.</span>
          </h1>
          <p className="hero-fade mt-7 max-w-[540px] text-[17px] leading-relaxed text-chrome">
            ShadowAstra Atlas maps permanent Moon base regions and Mars mission targets to the Earth landscapes where
            crews, rovers and instruments can practise first — and shows, with open NASA data, exactly what each
            rehearsal can and cannot teach.
          </p>
          <div className="hero-fade mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/atlas"
              className="group inline-flex items-center gap-2 rounded-full bg-platinum px-6 py-3.5 text-sm font-medium text-void transition-transform duration-150 hover:bg-white active:scale-[0.98]"
            >
              Open the Atlas
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/compare"
              className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-void/40 px-6 py-3.5 text-sm text-platinum backdrop-blur transition-colors hover:border-chrome"
            >
              Compare at matched scale
            </Link>
          </div>
        </div>
      </div>

      {/* telemetry HUD — every value is from the site catalogue */}
      <div className="hero-hud pointer-events-none absolute right-4 bottom-8 z-10 hidden w-[340px] sm:right-6 min-[900px]:block">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-dim uppercase">
            <span>Reference analog {String(i + 1).padStart(2, "0")}/{sites.length}</span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-strong" /> live catalogue
            </span>
          </div>
          <div key={s.id} className="mt-3 animate-[fadeIn_.5s_ease-out]">
            <div className="text-[15px] font-medium text-platinum">{s.name}</div>
            <div className="font-mono text-[11px] text-chrome tabular">
              {formatCoord(s.lat, s.lon)} · {s.country}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-chrome">
              <WorldDot world="earth" />
              <span className="h-px flex-1 bg-gradient-to-r from-earth/60 to-transparent" />
              <span>rehearses</span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-chrome/50" />
              <WorldDot world={pair.body} />
            </div>
            <div className="mt-2 text-right text-[13px] text-platinum">
              {pair.name} <span className="text-dim">· {pair.body === "moon" ? "Moon" : "Mars"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-hud absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-dim uppercase md:flex min-[900px]:left-6 min-[900px]:translate-x-0 min-[900px]:items-start">
        <span>Scroll</span>
        <span className="relative h-10 w-px overflow-hidden bg-line-2">
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scan_1.8s_ease-in-out_infinite] bg-platinum" />
        </span>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}

function SourceMarquee() {
  const items = useMemo(() => {
    const names = LAYERS.map((l) => l.instrument.replace(/,.*$/, ""));
    return Array.from(new Set(names));
  }, []);
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink py-5" aria-label="NASA data sources">
      <div className="animate-marquee flex w-max gap-12 whitespace-nowrap">
        {[...items, ...items].map((n, k) => (
          <span key={k} className="flex items-center gap-12 font-mono text-[12px] tracking-[0.2em] text-chrome uppercase">
            {n}
            <span className="text-earth">✦</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------- challenge */

function Challenge() {
  const stats = [
    { n: EARTH_SITES.length, label: "Reference Earth analogs catalogued", note: "published field-test sites" },
    { n: TARGETS.length, label: "Moon & Mars targets mapped", note: "Artemis regions, rover sites, caves" },
    { n: LAYERS.length, label: "Live NASA map layers", note: "GIBS + Solar System Treks" },
    { n: SCREENING_REGIONS.length, label: "Regions queued for new-analog screening", note: "not yet screened" },
  ];
  return (
    <section className="relative px-4 py-28 sm:px-6 md:py-40">
      <div className="mx-auto max-w-[1400px]">
        <Eyebrow>The challenge</Eyebrow>
        <h2 className="split-reveal mt-8 max-w-[1100px] text-[clamp(30px,4.6vw,68px)] leading-[1.02] font-medium tracking-[-0.035em]">
          Earth’s famous analog sites let teams test before they fly.{" "}
          <span className="font-serif font-normal text-chrome italic">But they are not well characterized</span> — and
          the next ones haven’t been found.
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-[1fr_1fr]">
          <p data-reveal className="max-w-xl text-[17px] leading-relaxed text-chrome">
            NASA asks teams to use open Earth, Moon and Mars data to <em className="text-platinum not-italic">identify and characterize new terrestrial analogs</em>{" "}
            for future bases and landing sites — across deserts, polar regions, volcanic and arid terrain and caves.
          </p>
          <p data-reveal className="max-w-xl text-[17px] leading-relaxed text-chrome">
            Our answer starts from the mission, not the picture. Choose what you need to rehearse — a rover traverse,
            ice prospecting, a lava-tube survey — and the Atlas compares{" "}
            <span className="text-platinum">topography, geology, environment and resources</span> at a matched physical
            scale, then says plainly what Earth can’t reproduce.
          </p>
        </div>
        <div className="mt-20 grid grid-cols-2 border-t border-l border-line lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} data-reveal className="border-r border-b border-line p-6 md:p-8">
              <div className="font-mono text-[clamp(40px,5vw,72px)] leading-none font-light tracking-tight tabular">{s.n}</div>
              <div className="mt-4 text-sm text-platinum">{s.label}</div>
              <div className="mt-1 text-xs text-dim">{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- worlds */

function SpinningBody({ src, size = 220, speed = 60, tint }: { src: string; size?: number; speed?: number; tint: string }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute -inset-6 rounded-full opacity-60 blur-2xl" style={{ background: `radial-gradient(circle, ${tint}33, transparent 65%)` }} />
      <div
        className="relative size-full rounded-full"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "200% 100%",
          animation: `spin-tex ${speed}s linear infinite`,
          boxShadow: `inset -${size * 0.22}px -${size * 0.06}px ${size * 0.25}px rgba(0,0,0,0.92), inset ${size * 0.04}px ${size * 0.03}px ${size * 0.1}px rgba(255,255,255,0.18), 0 0 ${size * 0.25}px ${tint}26`,
        }}
      />
      <style>{`@keyframes spin-tex{from{background-position:0 0}to{background-position:-200% 0}}`}</style>
    </div>
  );
}

function Worlds() {
  const worlds = [
    {
      body: "moon" as const,
      title: "The Moon",
      sub: "Permanent base · south pole",
      tex: "/textures/moon_lroc_4k.jpg",
      tint: "#d6dbe4",
      text: "Artemis regions where ridges catch near-constant sunlight beside craters that have not seen the Sun in billions of years.",
    },
    {
      body: "earth" as const,
      title: "Earth",
      sub: "The rehearsal ground",
      tex: "/textures/earth_day_4k.jpg",
      tint: "#75bbff",
      text: "Deserts, polar valleys, lava tubes and impact craters — screened with global NASA terrain, imagery and thermal data.",
    },
    {
      body: "mars" as const,
      title: "Mars",
      sub: "Landing & human sites",
      tex: "/textures/mars_viking_4k.jpg",
      tint: "#e08a5f",
      text: "Rover craters, ice-rich plains and cave skylights that future crews will need to reach, survive and study.",
    },
  ];
  return (
    <section className="relative overflow-hidden border-t border-line px-4 py-28 sm:px-6 md:py-36">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
      <div className="relative mx-auto max-w-[1400px]">
        <Eyebrow>Three worlds · one atlas</Eyebrow>
        <h2 className="split-reveal mt-8 max-w-[900px] text-[clamp(30px,4.2vw,60px)] leading-[1.04] font-medium tracking-[-0.035em]">
          Every map is real NASA data — <span className="font-serif font-normal italic text-chrome">many maps per world.</span>
        </h2>
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {worlds.map((w) => (
            <article key={w.body} data-reveal className="group panel relative flex flex-col overflow-hidden rounded-2xl p-7">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.25em] text-dim uppercase">{w.sub}</div>
                  <h3 className="mt-2 text-3xl font-medium tracking-tight">{w.title}</h3>
                </div>
                <WorldDot world={w.body} className="mt-2" />
              </div>
              <div className="my-10 grid place-items-center">
                <SpinningBody src={w.tex} tint={w.tint} speed={w.body === "earth" ? 50 : 80} />
              </div>
              <p className="text-sm leading-relaxed text-chrome">{w.text}</p>
              <ul className="mt-6 space-y-0 border-t border-line">
                {LAYERS_BY_BODY[w.body].map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[13px]">
                    <span className="text-platinum">{l.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-dim">{l.resolution}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={`/atlas?body=${w.body}`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm text-chrome transition-colors hover:text-platinum"
              >
                Open {w.title.replace("The ", "")} maps <ArrowUpRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- false friend */

// Illustrative profiles only — drawn to explain the idea, not measured.
const PROFILE_A = "M0,120 C60,118 90,96 140,100 S230,128 280,110 S380,84 430,96 S520,120 600,104";
const PROFILE_B = "M0,128 C40,126 60,60 90,58 S120,140 160,132 S200,30 240,40 S290,150 330,138 S380,48 420,60 S470,146 520,128 S570,70 600,80";
const PROFILE_T = "M0,126 C40,124 70,64 100,62 S130,138 170,130 S210,36 250,44 S300,146 340,136 S390,52 430,62 S480,142 530,126 S570,76 600,84";

function FalseFriend() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const steps = [
    {
      k: "01",
      title: "It looks like Mars.",
      text: "Red rock, no plants, a crater on the horizon. Site A is the obvious place to rehearse a rover traverse.",
    },
    {
      k: "02",
      title: "The mission asks a different question.",
      text: "The real route crosses steep, broken relief. What matters is slope and roughness at wheel scale — not colour.",
    },
    {
      k: "03",
      title: "Compare the task, at the same scale.",
      text: "Site B's profile carries the obstacle the mission cares about. The Atlas changes the choice while the plan can still change.",
    },
  ];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({
          trigger: ref.current,
          start: "top top",
          end: "+=180%",
          pin: true,
          scrub: true,
          onUpdate: (self) => setStep(Math.min(2, Math.floor(self.progress * 3))),
        });
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative border-t border-line bg-ink px-4 py-24 sm:px-6 min-[900px]:flex min-[900px]:h-dvh min-[900px]:items-center min-[900px]:py-0">
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-14 min-[900px]:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Eyebrow>The false friend</Eyebrow>
          <div className="mt-10 space-y-8">
            {steps.map((s, k) => (
              <button
                key={s.k}
                onClick={() => setStep(k)}
                className={`block w-full border-l-2 pl-6 text-left transition-all duration-500 ${
                  step === k ? "border-earth opacity-100" : "border-line opacity-40 hover:opacity-70"
                }`}
              >
                <div className="font-mono text-xs text-dim">{s.k}</div>
                <div className="mt-1 text-[clamp(22px,2.4vw,34px)] leading-tight font-medium tracking-tight">{s.title}</div>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-chrome">{s.text}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="panel relative rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-dim uppercase">
            <span>Route elevation profile</span>
            <span className="rounded-full border border-dashed border-line-2 px-2 py-0.5">Illustrative · not measured</span>
          </div>
          <svg viewBox="0 0 600 170" className="mt-6 w-full overflow-visible" role="img" aria-label="Two route profiles compared against the target route">
            {[40, 80, 120, 160].map((y) => (
              <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#1b2130" strokeWidth="1" />
            ))}
            <path d={PROFILE_T} fill="none" stroke="#e08a5f" strokeWidth="2" strokeDasharray="5 5" opacity={step >= 1 ? 0.95 : 0} style={{ transition: "opacity .6s" }} />
            <path
              d={PROFILE_A}
              fill="none"
              stroke="#afb9c7"
              strokeWidth="2.2"
              opacity={step === 2 ? 0.3 : 1}
              style={{ transition: "opacity .6s" }}
            />
            <path
              d={PROFILE_B}
              fill="none"
              stroke="#75bbff"
              strokeWidth="2.6"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={step === 2 ? 0 : 1}
              style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)" }}
            />
          </svg>
          <div className="mt-6 grid gap-3 text-[13px] sm:grid-cols-3">
            <Legend color="#e08a5f" dashed label="Mars target route" on={step >= 1} />
            <Legend color="#afb9c7" label="Site A — looks right" on />
            <Legend color="#75bbff" label="Site B — tests right" on={step === 2} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-[13px]">
            <div className="bg-panel p-4">
              <div className="text-dim">Site A</div>
              <div className="mt-1 text-platinum">Colour match · gentle relief</div>
              <div className="mt-2 text-weak">✕ Misses the traverse hazard</div>
            </div>
            <div className="bg-panel p-4">
              <div className="text-dim">Site B</div>
              <div className="mt-1 text-platinum">Matched slope & roughness</div>
              <div className={`mt-2 transition-opacity duration-500 ${step === 2 ? "text-strong opacity-100" : "opacity-0"}`}>✓ Rehearses the real obstacle</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label, dashed, on }: { color: string; label: string; dashed?: boolean; on: boolean }) {
  return (
    <div className={`flex items-center gap-2 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-30"}`}>
      <span className="h-0.5 w-6" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)` : color }} />
      <span className="text-chrome">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------- moon base */

function MoonBase() {
  const polar = TARGETS.filter((t) => t.body === "moon" && t.lat < -80);
  const [hover, setHover] = useState<string | null>("shackleton");
  return (
    <section className="relative overflow-hidden border-t border-line px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto grid max-w-[1400px] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div data-reveal className="relative mx-auto w-full max-w-[640px]">
          <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(214,219,228,0.12),transparent_65%)]" />
          <div className="relative aspect-square overflow-hidden rounded-full border border-line-2">
            <div className="absolute inset-0 scale-[1.55]">
            <img src="/textures/moon_south_pole_lola.jpg" alt="Lunar south pole, LRO LOLA hillshade from 80°S to the pole" className="polar-image size-full object-cover" />
            <svg viewBox={`0 0 ${POLAR_IMAGE_SIZE} ${POLAR_IMAGE_SIZE}`} className="absolute inset-0 size-full">
              {[0.25, 0.5, 0.75].map((r) => (
                <circle key={r} cx={700} cy={700} r={700 * r} fill="none" stroke="rgba(117,187,255,0.18)" strokeDasharray="4 8" />
              ))}
              {polar.map((t) => {
                const [x, y] = polarPixel(t.lat, t.lon);
                const on = hover === t.id;
                return (
                  <g key={t.id} onMouseEnter={() => setHover(t.id)} className="cursor-pointer">
                    <circle cx={x} cy={y} r={on ? 26 : 16} fill="none" stroke="#75bbff" strokeWidth={on ? 2.5 : 1.5} opacity={on ? 1 : 0.6} style={{ transition: "all .25s" }} />
                    <circle cx={x} cy={y} r={5} fill={on ? "#ffffff" : "#75bbff"} />
                    {on && (
                      <text x={x + 32} y={y + 7} fill="#f3f5f7" fontSize="22" fontFamily="Geist" style={{ paintOrder: "stroke" }} stroke="#020306" strokeWidth="8">
                        {t.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            </div>
          </div>
          <div className="mt-4 text-center font-mono text-[10px] tracking-widest text-dim uppercase">
            LRO LOLA hillshade · reprojected polar stereographic · ~84°S → pole · rings every 2.5°
          </div>
        </div>
        <div>
          <Eyebrow>Permanent Moon base</Eyebrow>
          <h2 className="split-reveal mt-8 text-[clamp(30px,4vw,58px)] leading-[1.04] font-medium tracking-[-0.035em]">
            Light on the ridges, <span className="font-serif font-normal italic text-chrome">ice in the dark.</span>
          </h2>
          <p data-reveal className="mt-6 max-w-lg text-[16px] leading-relaxed text-chrome">
            NASA’s Artemis candidate regions cluster around the lunar south pole. We map each one on real LOLA terrain and ask
            which Earth places share its low Sun, cold traps, slopes and logistics.
          </p>
          <ul className="mt-10 border-t border-line">
            {polar.map((t) => (
              <li key={t.id}>
                <button
                  onMouseEnter={() => setHover(t.id)}
                  onFocus={() => setHover(t.id)}
                  className={`flex w-full items-center justify-between gap-4 border-b border-line py-3.5 text-left transition-colors ${
                    hover === t.id ? "text-platinum" : "text-chrome"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`size-1.5 rounded-full ${hover === t.id ? "bg-earth" : "bg-line-2"}`} />
                    {t.name}
                  </span>
                  <span className="font-mono text-[11px] text-dim tabular">{formatCoord(t.lat, t.lon)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/atlas?body=moon&layer=moon-south-pole" className="mt-8 inline-flex items-center gap-2 text-sm text-earth hover:text-platinum">
            Explore the south pole in the Atlas <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- pipeline */

function Pipeline() {
  const steps = [
    { k: "01", t: "Mission task", d: `Pick one of ${TASKS.length} rehearsal tasks — traverse, ISRU, ice, caves, polar light…`, live: true },
    { k: "02", t: "Target region", d: "Choose a Moon base region or Mars site; its NASA terrain defines the physical scale.", live: true },
    { k: "03", t: "Evidence layers", d: "DEM slope & roughness, geology, thermal and imagery — with coverage and gaps shown.", live: false },
    { k: "04", t: "Earth shortlist", d: "Screen new regions against known analogs; rank with an honest physical baseline first.", live: false },
    { k: "05", t: "Site passport", d: "What to test, what will not transfer, permissions and stewardship — ready for a field team.", live: false },
  ];
  return (
    <section className="relative border-t border-line bg-ink px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>How the Atlas decides</Eyebrow>
            <h2 className="split-reveal mt-8 max-w-[820px] text-[clamp(30px,4vw,58px)] leading-[1.04] font-medium tracking-[-0.035em]">
              From a mission question to a field-ready passport.
            </h2>
          </div>
          <Link to="/methods" className="inline-flex items-center gap-2 text-sm text-chrome hover:text-platinum">
            Data & method <ArrowUpRight size={15} />
          </Link>
        </div>
        <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
          {steps.map((s) => (
            <li key={s.k} data-reveal className="relative flex flex-col bg-panel p-6">
              <div className="font-mono text-xs text-dim">{s.k}</div>
              <div className="mt-8 text-lg font-medium">{s.t}</div>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-chrome">{s.d}</p>
              <div className="mt-6">
                {s.live ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-strong/40 bg-strong/10 px-2.5 py-1 text-[11px] text-strong">
                    <Check size={12} /> Prototype live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-2 px-2.5 py-1 text-[11px] text-chrome">
                    <CircleDashed size={12} /> Hackathon build
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- library */

function Library() {
  return (
    <section className="relative border-t border-line py-28 md:py-36">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <Eyebrow>Reference library</Eyebrow>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <h2 className="split-reveal max-w-[820px] text-[clamp(30px,4vw,58px)] leading-[1.04] font-medium tracking-[-0.035em]">
            The analogs we already know — <span className="font-serif font-normal italic text-chrome">our calibration set.</span>
          </h2>
          <p className="max-w-sm text-sm text-dim">
            Known sites are controls for validating the screening method. They are not presented as new discoveries.
          </p>
        </div>
      </div>
      <div className="scrollbar-thin mt-14 flex snap-x gap-4 overflow-x-auto px-4 pb-6 sm:px-6 lg:px-[max(24px,calc((100vw-1400px)/2+24px))]">
        {EARTH_SITES.map((s) => (
          <Link
            key={s.id}
            to={`/atlas?site=${s.id}`}
            className="group panel relative w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl"
          >
            <div className="relative h-44 overflow-hidden">
              <img
                src={`/thumbs/${s.id}.jpg`}
                alt={`NASA Blue Marble view around ${s.name}`}
                loading="lazy"
                className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
              <div className="absolute top-3 left-3 flex gap-1.5">
                {s.worlds.map((w) => (
                  <span key={w} className="flex items-center gap-1.5 rounded-full bg-void/70 px-2 py-0.5 text-[10px] tracking-wide text-platinum uppercase backdrop-blur">
                    <WorldDot world={w} /> {w}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-5">
              <div className="text-[16px] font-medium">{s.name}</div>
              <div className="mt-0.5 font-mono text-[11px] text-dim">
                {s.country} · {formatCoord(s.lat, s.lon)}
              </div>
              <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-chrome">{s.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.pairs.slice(0, 3).map((p) => (
                  <span key={p} className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-chrome">
                    → {TARGET_BY_ID[p].name}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- progress */

function Progress() {
  const done = [
    "Design system & cinematic interface (this site)",
    "Live NASA basemaps for Earth, Moon and Mars — 12 layers",
    "3D globes built from NASA Blue Marble, Black Marble, LRO and Viking data",
    "Lunar south pole map reprojected from LRO LOLA",
    "Catalogue: 17 reference analogs, 18 Moon/Mars targets, 8 tasks",
    "Matched physical-scale comparison across bodies",
  ];
  const next = [
    "DEM pipeline: slope, roughness & relief at shared scales (NASADEM, LOLA, MOLA, HiRISE)",
    "Physical baseline ranker + region-held-out evaluation",
    "Screen the 8 queued regions for new analog candidates",
    "Terrain encoder trained on Kaggle; uncertainty & abstention",
    "Site passport export and field-test protocol",
  ];
  return (
    <section className="relative border-t border-line bg-ink px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Eyebrow>Preliminary-round progress</Eyebrow>
        <h2 className="split-reveal mt-8 max-w-[900px] text-[clamp(30px,4vw,58px)] leading-[1.04] font-medium tracking-[-0.035em]">
          What’s real today, <span className="font-serif font-normal italic text-chrome">and what we build next.</span>
        </h2>
        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <div data-reveal className="panel rounded-2xl p-7">
            <div className="flex items-center gap-2 text-sm text-strong">
              <Check size={16} /> Built — in this repository
            </div>
            <ul className="mt-6 space-y-3.5">
              {done.map((d) => (
                <li key={d} className="flex gap-3 text-[15px] text-platinum">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-strong" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="rounded-2xl border border-dashed border-line-2 p-7">
            <div className="flex items-center gap-2 text-sm text-chrome">
              <Radar size={16} /> Next — hackathon weekend
            </div>
            <ul className="mt-6 space-y-3.5">
              {next.map((d) => (
                <li key={d} className="flex gap-3 text-[15px] text-chrome">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full border border-chrome" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- team */

const TEAM = [
  { name: "Abdullah Rubab", role: "Team Lead · Product & Integration" },
  { name: "Tanvir Hossin", role: "Planetary Data Research" },
  { name: "Mohammad Saniul Alam", role: "Geospatial Product Design" },
  { name: "Tasnuva Arif", role: "Development & Testing · Narrator" },
  { name: "Md. Tanvir Hasan", role: "Scientific Validation & Security" },
  { name: "Mohammed Mahmud Parvez", role: "Film & Motion" },
];

function Team() {
  return (
    <section className="relative border-t border-line px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Eyebrow>Team ShadowAstra · Dhaka</Eyebrow>
        <h2 className="split-reveal mt-8 text-[clamp(30px,4vw,58px)] leading-[1.04] font-medium tracking-[-0.035em]">
          Six people, <span className="font-serif font-normal italic text-chrome">three worlds.</span>
        </h2>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m) => (
            <div key={m.name} data-reveal className="group flex items-center gap-5 bg-void p-6 transition-colors hover:bg-panel">
              <div className="grid size-14 shrink-0 place-items-center rounded-full border border-line-2 font-wide text-xs text-chrome transition-colors group-hover:border-earth group-hover:text-earth">
                {m.name
                  .replace("Md. ", "")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="text-[16px] font-medium">{m.name}</div>
                <div className="mt-0.5 text-[13px] text-dim">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="noise relative overflow-hidden border-t border-line px-4 py-32 sm:px-6 md:py-44">
      <div className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_120%,rgba(52,102,216,0.35),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1000px] text-center">
        <h2 className="split-reveal text-[clamp(36px,6vw,92px)] leading-[0.98] font-medium tracking-[-0.045em]">
          Find where Earth <span className="font-serif font-normal italic text-earth">can teach us.</span>
        </h2>
        <div data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/atlas" className="inline-flex items-center gap-2 rounded-full bg-platinum px-7 py-4 text-sm font-medium text-void hover:bg-white">
            Open the Atlas <ArrowRight size={16} />
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-4 text-sm text-platinum hover:border-chrome"
          >
            <Github size={16} /> View the code
          </a>
        </div>
      </div>
    </section>
  );
}
