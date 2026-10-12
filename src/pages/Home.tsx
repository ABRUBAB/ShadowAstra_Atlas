import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { ArrowRight, ArrowUpRight, Check, CircleDashed, Leaf, Mountain, Radar, Scale, ShieldCheck, Sun, Target } from "lucide-react";
import { Eyebrow, Footer, Github, Nav, REPO_URL, WorldDot } from "../components/ui/Chrome";
import { Astronaut, type Action, type Mood } from "../components/ui/Astronaut";
import { EARTH_SITES, SCREENING_REGIONS, TARGETS, TARGET_BY_ID, TASKS } from "../data/sites";
import { LAYERS, LAYERS_BY_BODY } from "../data/layers";
import { formatCoord, polarPixel, POLAR_IMAGE_SIZE } from "../lib/geo";
import { useSmoothScroll } from "../lib/useSmoothScroll";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const HeroScene = lazy(() => import("../components/three/HeroScene"));
const EASE = "expo.out";

export default function Home() {
  useSmoothScroll();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(".hero-title", { type: "words", mask: "words" });
        gsap
          .timeline({ defaults: { ease: EASE } })
          .from(split.words, { yPercent: 105, duration: 1.4, stagger: 0.07, delay: 0.15 })
          .from(".hero-fade", { opacity: 0, y: 14, duration: 1.1, stagger: 0.09 }, "-=1.0")
          .from(".hero-hud", { opacity: 0, duration: 1.2 }, "-=0.6");

        ScrollTrigger.batch("[data-reveal]", {
          start: "top 90%",
          once: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: EASE }),
        });

        gsap.utils.toArray<HTMLElement>(".split-reveal").forEach((el) => {
          const s = SplitText.create(el, { type: "words", mask: "words" });
          gsap.from(s.words, { yPercent: 100, duration: 1.15, stagger: 0.03, ease: EASE, scrollTrigger: { trigger: el, start: "top 86%" } });
        });

        gsap.utils.toArray<HTMLElement>("[data-rule]").forEach((el) => {
          gsap.from(el, { scaleX: 0, transformOrigin: "left center", duration: 1.4, ease: EASE, scrollTrigger: { trigger: el, start: "top 90%" } });
        });

        gsap.to(".hero-scene", { yPercent: 14, opacity: 0.3, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
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
      <Novelty />
      <Worlds />
      <FalseFriend />
      <MoonBase />
      <Pipeline />
      <Sustainability />
      <Library />
      <Progress />
      <TeamTeaser />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function Chapter({ n, children, className }: { n: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className ?? ""}`}>
      <span className="font-mono text-[11px] text-flare">{n}</span>
      <span data-rule className="h-px w-10 bg-line-2" />
      <span className="font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">{children}</span>
    </div>
  );
}

function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`split-reveal text-[clamp(30px,4.2vw,62px)] leading-[1.03] font-medium tracking-[-0.038em] ${className ?? ""}`}>{children}</h2>;
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-serif font-normal text-chrome italic">{children}</span>;
}

/** Astra appears once per chapter, doing that chapter's job. */
function Guide({ mood, action, say, className, size = 130 }: { mood: Mood; action: Action; say?: string; className?: string; size?: number }) {
  return (
    <div data-reveal className={className}>
      <Astronaut mood={mood} action={action} say={say} size={size} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const compact = typeof window !== "undefined" && window.innerWidth < 900;
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % EARTH_SITES.length), 3600);
    return () => clearInterval(t);
  }, []);
  const s = EARTH_SITES[i];
  const pair = TARGET_BY_ID[s.pairs[0]];

  return (
    <section data-theme="dark" className="hero relative h-dvh min-h-[680px] overflow-hidden bg-void">
      <div className="hero-scene absolute inset-0">
        {/* Poster: a 60 KB NASA Earth that paints instantly while WebGL warms up. */}
        {!compact && (
          <div
            className="absolute rounded-full transition-opacity duration-1000"
            style={{
              opacity: ready ? 0 : 1,
              width: "70vh",
              height: "70vh",
              left: "calc(50vw + 32vh - 35vh)",
              top: "calc(53vh - 35vh)",
              backgroundImage: "url(/textures/earth_day_1k.webp)",
              backgroundSize: "200% 100%",
              backgroundPosition: "-40% 0",
              boxShadow: "inset -18vh -4vh 16vh rgba(7,8,10,0.96), inset 2vh 1vh 6vh rgba(255,255,255,0.08)",
            }}
          />
        )}
        <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
          <Suspense fallback={null}>
            <HeroScene compact={compact} onReady={() => setReady(true)} />
          </Suspense>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,10,0.94)_0%,rgba(7,8,10,0.6)_36%,transparent_62%)] max-[900px]:bg-[linear-gradient(180deg,transparent_0%,transparent_30%,rgba(7,8,10,0.9)_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-4 pb-24 sm:px-6 min-[900px]:justify-center min-[900px]:pb-0">
        <div className="pointer-events-auto max-w-[860px]">
          <Eyebrow className="hero-fade mb-7">NASA Space Apps 2026 · Team ShadowAstra · Dhaka</Eyebrow>
          <h1 className="hero-title text-[clamp(40px,min(7vw,11vh),116px)] leading-[0.95] font-medium tracking-[-0.045em] text-platinum">
            <span className="block">Rehearse other worlds</span>
            <span className="block font-serif font-normal tracking-[-0.02em] text-flare italic">on this one.</span>
          </h1>
          <p className="hero-fade mt-7 max-w-[540px] text-[17px] leading-relaxed text-chrome">
            ShadowAstra Atlas finds places on Earth where astronauts, rovers and tools can practise for a Moon base or a Mars mission. We match
            each place to the job, compare the ground at the same size, and check the sunlight too.
          </p>
          <div className="hero-fade mt-9 flex flex-wrap items-center gap-3">
            <Link to="/lab" className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
              Open the Analog Lab
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/atlas" className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-void/40 px-6 py-3.5 text-sm text-platinum backdrop-blur transition-colors hover:border-chrome">
              Explore the Atlas
            </Link>
          </div>
        </div>
      </div>

      <div className="hero-hud pointer-events-none absolute right-4 bottom-24 z-10 hidden w-[340px] sm:right-6 min-[900px]:block">
        <div className="panel rounded-xl p-4">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-dim uppercase">
            <span>
              Reference analog {String(i + 1).padStart(2, "0")}/{EARTH_SITES.length}
            </span>
            <span>live catalogue</span>
          </div>
          <div key={s.id} className="mt-3 animate-[hudIn_.6s_cubic-bezier(.22,1,.36,1)]">
            <div className="text-[15px] font-medium text-platinum">{s.name}</div>
            <div className="font-mono text-[11px] text-chrome tabular">
              {formatCoord(s.lat, s.lon)} · {s.country}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-dim">
              <WorldDot world="earth" />
              <span className="h-px flex-1 bg-line-2" />
              <span className="font-serif text-[13px] italic">rehearses</span>
              <span className="h-px flex-1 bg-line-2" />
              <WorldDot world={pair.body} />
            </div>
            <div className="mt-2 text-right text-[13px] text-platinum">
              {pair.name} <span className="text-dim">· {pair.body === "moon" ? "Moon" : "Mars"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-hud absolute bottom-3 left-[calc(50%-120px)] z-10 hidden md:block [@media(max-height:760px)]:hidden">
        <Astronaut size={78} mood="happy" action="wave" say="Hi, I'm Astra, your field-test astronaut." sayAlign="side" />
      </div>
      <style>{`@keyframes hudIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}

function SourceMarquee() {
  const items = useMemo(() => Array.from(new Set(LAYERS.map((l) => l.instrument.replace(/,.*$/, "")))), []);
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink py-4" aria-label="NASA data sources">
      <div className="animate-marquee flex w-max gap-12 whitespace-nowrap">
        {[...items, ...items].map((n, k) => (
          <span key={k} className="flex items-center gap-12 font-mono text-[11px] tracking-[0.22em] text-dim uppercase">
            {n}
            <span className="text-line-2">/</span>
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
    { n: EARTH_SITES.length, label: "Reference Earth analogs", note: "published field-test sites" },
    { n: TARGETS.length, label: "Moon & Mars targets", note: "Artemis regions, rover sites, caves" },
    { n: LAYERS.length, label: "Live map layers", note: "NASA GIBS, Trek + ESA Sentinel-2" },
    { n: SCREENING_REGIONS.length, label: "Regions queued to screen", note: "for new analogs" },
  ];
  return (
    <section className="relative px-4 py-28 sm:px-6 md:py-40">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-start justify-between gap-6">
          <Chapter n="01">The challenge</Chapter>
          <Guide mood="thinking" action="idle" size={96} className="-mt-6 hidden md:block" />
        </div>
        <H2 className="mt-8 max-w-[1100px]">
          Earth’s famous analog sites let teams test before they fly. <Em>But they are not well characterized</Em>, and the next ones haven’t been
          found.
        </H2>
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          <p data-reveal className="max-w-xl text-[17px] leading-relaxed text-chrome">
            NASA asks teams to use open Earth, Moon and Mars data to <span className="text-platinum">identify and characterize new terrestrial analogs</span> for
            future bases and landing sites, across deserts, polar regions, volcanic and arid terrain and caves.
          </p>
          <p data-reveal className="max-w-xl text-[17px] leading-relaxed text-chrome">
            We start with the job, not the picture. Pick what you want to practise and the Atlas compares{" "}
            <span className="text-platinum">ground shape, rocks, temperature, sunlight, soil and radiation</span> at the same scale. Then it tells you
            plainly what Earth can’t copy.
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

/* -------------------------------------------------------------- novelty */

function Novelty() {
  const items = [
    { icon: Target, t: "Matched to the job", d: "There is no single “Mars-like” score. A rover test and an ice search need different places, so the score changes with the task." },
    { icon: Mountain, t: "Terrain Twins", d: "Real Earth, Moon and Mars ground side by side in 3D, cut to the same size so slopes compare fairly." },
    { icon: Sun, t: "Shadow Lab", d: "Move a low Sun around both places and see which ground never gets light. That is where ice can hide." },
    { icon: Radar, t: "Light Twin calendar", d: "Our Sun maths tells field teams which months on Earth have sunlight most like the target." },
    { icon: Leaf, t: "Rehearse closer", d: "Find the nearest good site to your team and see the travel footprint. Fewer flights, same science." },
    { icon: Scale, t: "Honest evidence", d: "Every number is marked Computed, Demo or Reality gap. We never hide gravity, vacuum or radiation." },
  ];
  return (
    <section className="relative border-t border-line bg-ink px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Chapter n="02">What’s new</Chapter>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
          <H2 className="max-w-[860px]">
            Six ideas no analog catalogue has <Em>put together before.</Em>
          </H2>
          <Link to="/lab" className="link-wipe inline-flex items-center gap-2 pb-1 text-sm text-chrome hover:text-platinum">
            Try them in the Analog Lab <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, k) => (
            <article key={it.t} data-reveal className="group relative bg-panel p-7 transition-colors duration-500 hover:bg-panel-2">
              <div className="flex items-center justify-between">
                <it.icon size={20} strokeWidth={1.5} className="text-platinum" />
                <span className="font-mono text-[11px] text-dim">{String(k + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-10 text-[19px] font-medium tracking-tight">{it.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-chrome">{it.d}</p>
              <span className="absolute inset-x-7 bottom-0 h-px origin-left scale-x-0 bg-flare transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-x-100" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- worlds */

function SpinningBody({ src, size = 220, speed = 60 }: { src: string; size?: number; speed?: number }) {
  return (
    <div
      className="rounded-full"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: "200% 100%",
        animation: `spin-tex ${speed}s linear infinite`,
        boxShadow: `inset -${size * 0.24}px -${size * 0.06}px ${size * 0.26}px rgba(7,8,10,0.95), inset ${size * 0.03}px ${size * 0.02}px ${size * 0.08}px rgba(255,255,255,0.12)`,
      }}
    />
  );
}

function Worlds() {
  const worlds = [
    { body: "moon" as const, title: "The Moon", sub: "Permanent base · south pole", tex: "/textures/moon_lroc_1k.webp", text: "Ridges with near-constant sunlight beside craters that haven’t seen the Sun in billions of years." },
    { body: "earth" as const, title: "Earth", sub: "The rehearsal ground", tex: "/textures/earth_day_1k.webp", text: "Deserts, polar valleys, lava tubes and impact craters, screened with global NASA terrain, imagery and thermal data." },
    { body: "mars" as const, title: "Mars", sub: "Landing & human sites", tex: "/textures/mars_viking_1k.webp", text: "Rover craters, ice-rich plains and cave skylights that future crews will need to reach, survive and study." },
  ];
  return (
    <section className="relative overflow-hidden border-t border-line px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Chapter n="03">Three worlds · one atlas</Chapter>
        <H2 className="mt-8 max-w-[900px]">
          Every map is real NASA data, <Em>many maps per world.</Em>
        </H2>
        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {worlds.map((w) => (
            <article key={w.body} data-reveal className="flex flex-col rounded-2xl border border-line bg-panel p-7">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.25em] text-dim uppercase">{w.sub}</div>
                  <h3 className="mt-2 text-3xl font-medium tracking-tight">{w.title}</h3>
                </div>
                <WorldDot world={w.body} className="mt-2" />
              </div>
              <div className="my-10 grid place-items-center">
                <SpinningBody src={w.tex} speed={w.body === "earth" ? 60 : 90} />
              </div>
              <p className="text-sm leading-relaxed text-chrome">{w.text}</p>
              <ul className="mt-6 border-t border-line">
                {LAYERS_BY_BODY[w.body].map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[13px]">
                    <span className="text-platinum">{l.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-dim">{l.resolution}</span>
                  </li>
                ))}
              </ul>
              <Link to={`/atlas?body=${w.body}`} className="link-wipe mt-6 inline-flex w-fit items-center gap-1.5 text-sm text-chrome hover:text-platinum">
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

// Illustrative profiles only, drawn to explain the idea, not measured.
const PROFILE_A = "M0,120 C60,118 90,96 140,100 S230,128 280,110 S380,84 430,96 S520,120 600,104";
const PROFILE_B = "M0,128 C40,126 60,60 90,58 S120,140 160,132 S200,30 240,40 S290,150 330,138 S380,48 420,60 S470,146 520,128 S570,70 600,80";
const PROFILE_T = "M0,126 C40,124 70,64 100,62 S130,138 170,130 S210,36 250,44 S300,146 340,136 S390,52 430,62 S480,142 530,126 S570,76 600,84";

function FalseFriend() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const steps = [
    { k: "01", title: "It looks like Mars.", text: "Red rock, no plants, a crater on the horizon. Site A is the obvious place to rehearse a rover traverse." },
    { k: "02", title: "The mission asks a different question.", text: "The real route crosses steep, broken ground. What matters is the slope and bumps under the wheels, not the colour." },
    { k: "03", title: "Compare the task, at the same scale.", text: "Site B carries the obstacle the mission cares about. The Atlas changes the choice while the plan can still change." },
  ];
  const astra: { mood: Mood; action: Action; say: string }[] = [
    { mood: "wow", action: "walk", say: "Looks just like Mars!" },
    { mood: "sad", action: "slump", say: "Site A is too gentle, the rover test would prove nothing." },
    { mood: "happy", action: "celebrate", say: "Site B matches the route. That's our rehearsal ground." },
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
          <Chapter n="04">The false friend</Chapter>
          <div className="mt-10 space-y-8">
            {steps.map((s, k) => (
              <button
                key={s.k}
                onClick={() => setStep(k)}
                className={`block w-full border-l pl-6 text-left transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${step === k ? "border-flare opacity-100" : "border-line opacity-35 hover:opacity-60"}`}
              >
                <div className="font-mono text-xs text-dim">{s.k}</div>
                <div className="mt-1 text-[clamp(22px,2.4vw,34px)] leading-tight font-medium tracking-tight">{s.title}</div>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-chrome">{s.text}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -top-28 right-6 z-10 hidden md:block">
            <Astronaut size={104} {...astra[step]} sayAlign="left" />
          </div>
          <div className="rounded-2xl border border-line bg-panel p-6 md:p-8">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-dim uppercase">
              <span>Route elevation profile</span>
              <span className="rounded-full border border-dashed border-line-2 px-2 py-0.5">Illustrative · not measured</span>
            </div>
            <svg viewBox="0 0 600 170" className="mt-6 w-full overflow-visible" role="img" aria-label="Two route profiles compared against the target route">
              {[40, 80, 120, 160].map((y) => (
                <line key={y} x1="0" x2="600" y1={y} y2={y} style={{ stroke: "var(--color-line)" }} strokeWidth="1" />
              ))}
              <path d={PROFILE_T} fill="none" style={{ stroke: "var(--color-mars)", transition: "opacity .8s" }} strokeWidth="1.8" strokeDasharray="5 5" opacity={step >= 1 ? 0.95 : 0} />
              <path d={PROFILE_A} fill="none" strokeWidth="2" opacity={step === 2 ? 0.25 : 1} style={{ stroke: "var(--color-chrome)", transition: "opacity .8s" }} />
              <path
                d={PROFILE_B}
                fill="none"
                strokeWidth="2.4"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={step === 2 ? 0 : 1}
                style={{ stroke: "var(--color-platinum)", transition: "stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)" }}
              />
            </svg>
            <div className="mt-6 grid gap-3 text-[13px] sm:grid-cols-3">
              <Legend color="var(--color-mars)" dashed label="Mars target route" on={step >= 1} />
              <Legend color="var(--color-chrome)" label="Site A: looks right" on />
              <Legend color="var(--color-platinum)" label="Site B: tests right" on={step === 2} />
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
                <div className={`mt-2 transition-opacity duration-700 ${step === 2 ? "text-strong opacity-100" : "opacity-0"}`}>✓ Rehearses the real obstacle</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label, dashed, on }: { color: string; label: string; dashed?: boolean; on: boolean }) {
  return (
    <div className={`flex items-center gap-2 transition-opacity duration-700 ${on ? "opacity-100" : "opacity-30"}`}>
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
          <div className="relative aspect-square overflow-hidden rounded-full border border-line-2">
            <div className="absolute inset-0 scale-[1.55]">
              <img src="/textures/moon_south_pole_lola.webp" alt="Lunar south pole, LRO LOLA hillshade" loading="lazy" className="polar-image size-full object-cover" />
              <svg viewBox={`0 0 ${POLAR_IMAGE_SIZE} ${POLAR_IMAGE_SIZE}`} className="absolute inset-0 size-full">
                {[0.25, 0.5, 0.75].map((r) => (
                  <circle key={r} cx={700} cy={700} r={700 * r} fill="none" stroke="rgba(242,200,121,0.22)" strokeDasharray="3 9" />
                ))}
                {polar.map((t) => {
                  const [x, y] = polarPixel(t.lat, t.lon);
                  const on = hover === t.id;
                  return (
                    <g key={t.id} onMouseEnter={() => setHover(t.id)} className="cursor-pointer">
                      <circle cx={x} cy={y} r={on ? 24 : 14} fill="none" stroke="#f2c879" strokeWidth={on ? 2 : 1.2} opacity={on ? 1 : 0.6} style={{ transition: "all .4s cubic-bezier(.22,1,.36,1)" }} />
                      <circle cx={x} cy={y} r={4.5} fill={on ? "#ffffff" : "#f2c879"} />
                      {on && (
                        <text x={x + 30} y={y + 7} fill="#edeae4" fontSize="22" fontFamily="Geist" style={{ paintOrder: "stroke" }} stroke="#07080a" strokeWidth="7">
                          {t.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <div className="mt-4 text-center font-mono text-[10px] tracking-widest text-dim uppercase">LRO LOLA hillshade · reprojected polar stereographic · ~84°S → pole</div>
        </div>
        <div>
          <div className="flex items-end justify-between gap-6">
            <Chapter n="05">Permanent Moon base</Chapter>
            <Guide mood="happy" action="flag" size={96} className="-mb-2 hidden md:block" />
          </div>
          <H2 className="mt-8">
            Light on the ridges, <Em>ice in the dark.</Em>
          </H2>
          <p data-reveal className="mt-6 max-w-lg text-[16px] leading-relaxed text-chrome">
            Artemis candidate regions cluster around the lunar south pole, where the Sun never climbs more than a few degrees. That is why our Shadow Lab
            exists: the base will live between light and shadow, so its rehearsal ground must too.
          </p>
          <ul className="mt-10 border-t border-line">
            {polar.map((t) => (
              <li key={t.id}>
                <button
                  onMouseEnter={() => setHover(t.id)}
                  onFocus={() => setHover(t.id)}
                  className={`flex w-full items-center justify-between gap-4 border-b border-line py-3.5 text-left transition-colors duration-300 ${hover === t.id ? "text-platinum" : "text-chrome"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`size-1.5 rounded-full transition-colors ${hover === t.id ? "bg-flare" : "bg-line-2"}`} />
                    {t.name}
                  </span>
                  <span className="font-mono text-[11px] text-dim tabular">{formatCoord(t.lat, t.lon)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/lab?earth=dry-valleys&target=shackleton&task=polar" className="link-wipe mt-8 inline-flex items-center gap-2 text-sm text-flare">
            Shackleton vs. McMurdo Dry Valleys in the Shadow Lab <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- pipeline */

function Pipeline() {
  const steps = [
    { k: "01", t: "Mission task", d: `Pick one of ${TASKS.length} rehearsal tasks, traverse, ISRU, ice, caves, polar light…`, live: true },
    { k: "02", t: "Target region", d: "Choose a Moon base region or Mars site; its NASA terrain sets the physical scale.", live: true },
    { k: "03", t: "Twin the evidence", d: "Terrain, Sun and shadow computed live today; geology, temperature and regolith next.", live: true },
    { k: "04", t: "Screen & rank", d: "Physical baseline first, then our trained terrain encoder on held-out regions.", live: false },
    { k: "05", t: "Site passport", d: "Protocol, best season, reality gaps, permits and travel footprint for a field team.", live: false },
  ];
  return (
    <section className="relative border-t border-line bg-ink px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Chapter n="06">How the Atlas decides</Chapter>
            <H2 className="mt-8 max-w-[820px]">From a mission question to a field-ready passport.</H2>
          </div>
          <Guide mood="focused" action="scan" size={110} className="hidden md:block" />
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
                    <Check size={12} /> Live in prototype
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

/* ---------------------------------------------------------- sustainability */

function Sustainability() {
  const cards = [
    { icon: Leaf, t: "Fewer, smarter field trips", d: "Remote screening narrows the shortlist before anyone flies. The Lab shows each trip's distance and an indicative CO₂ estimate, and suggests the closest credible analog." },
    { icon: ShieldCheck, t: "Stewardship built in", d: "Every site carries its protection status. Antarctic Treaty, national parks, sacred and Indigenous land. Consent comes before coordinates." },
    { icon: Target, t: "Local impact, Dhaka first", d: "A Bangla-friendly classroom mode and a university workshop pilot so students who can't reach Atacama can still do real planetary science." },
  ];
  return (
    <section className="relative border-t border-line px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Chapter n="07">Sustainability & people</Chapter>
            <H2 className="mt-8 max-w-[880px]">
              Explore responsibly here <Em>so we can explore elsewhere.</Em>
            </H2>
          </div>
          <Guide mood="neutral" action="walk" size={100} className="hidden md:block" />
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <article key={c.t} data-reveal className="rounded-2xl border border-line bg-panel p-7">
              <c.icon size={20} strokeWidth={1.5} className="text-strong" />
              <h3 className="mt-8 text-[19px] font-medium tracking-tight">{c.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-chrome">{c.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- library */

function Library() {
  return (
    <section className="relative border-t border-line bg-ink py-28 md:py-36">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex items-end justify-between gap-6">
          <Chapter n="08">Reference library</Chapter>
          <Guide mood="happy" action="sample" size={96} className="hidden md:block" />
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <H2 className="max-w-[820px]">
            The analogs we already know, <Em>our calibration set.</Em>
          </H2>
          <p className="max-w-sm text-sm text-dim">Known sites are controls for validating the screening method. They are not presented as new discoveries.</p>
        </div>
      </div>
      <div className="scrollbar-thin mt-14 flex snap-x gap-4 overflow-x-auto px-4 pb-6 sm:px-6 lg:px-[max(24px,calc((100vw-1400px)/2+24px))]">
        {EARTH_SITES.map((s) => (
          <Link key={s.id} to={`/lab?earth=${s.id}&target=${s.pairs[0]}`} className="group relative w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="relative h-44 overflow-hidden">
              <img src={`/thumbs/${s.id}.webp`} alt={`NASA Blue Marble view around ${s.name}`} loading="lazy" className="size-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
              <div className="absolute top-3 left-3 flex gap-1.5">
                {s.worlds.map((w) => (
                  <span key={w} className="flex items-center gap-1.5 rounded-full bg-void/75 px-2 py-0.5 text-[10px] tracking-wide text-platinum uppercase backdrop-blur">
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
    "Analog Lab: 3D Terrain Twins from real Earth, Moon & Mars elevation",
    "Shadow Lab: horizon-based illumination & persistent-shadow mapping",
    "Light Twin: solar-geometry match and rehearsal calendar",
    "Rehearse-closer finder with travel-footprint estimate",
    "12 live NASA map layers; lunar south pole reprojected from LOLA",
    "17 reference analogs, 18 targets, 8 tasks, 8 screening regions",
  ];
  const next = [
    "Full-precision DEMs: LOLA polar 5 to 20 m, HiRISE 1 m, NASADEM 30 m",
    "Geology, temperature & regolith from EMIT, Diviner, THEMIS, CRISM",
    "Physical baseline ranker + region-held-out evaluation",
    "Terrain encoder trained on Kaggle; uncertainty & abstention",
    "Screen the queued regions; export site passports",
  ];
  return (
    <section className="relative border-t border-line px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-end justify-between gap-6">
          <Chapter n="09">Preliminary-round progress</Chapter>
          <Guide mood="focused" action="drill" size={96} className="hidden md:block" />
        </div>
        <H2 className="mt-8 max-w-[900px]">
          What’s real today, <Em>and what we build next.</Em>
        </H2>
        <div className="mt-16 grid gap-4 md:grid-cols-2">
          <div data-reveal className="rounded-2xl border border-line bg-panel p-7">
            <div className="flex items-center gap-2 text-sm text-strong">
              <Check size={16} /> Built and in this repository
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
              <Radar size={16} /> Next, at the hackathon
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
  { id: "rubab", name: "Abdullah Rubab" },
  { id: "hossin", name: "Tanvir Hossin" },
  { id: "saniul", name: "Mohammad Saniul Alam" },
  { id: "tasnuva", name: "Tasnuva Arif" },
  { id: "hasan", name: "Md. Tanvir Hasan" },
  { id: "parvez", name: "Mohammed Mahmud Parvez" },
];

function TeamTeaser() {
  return (
    <section className="relative border-t border-line bg-ink px-4 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Chapter n="10">Team ShadowAstra · Dhaka</Chapter>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <H2>
            Six people, <Em>three worlds.</Em>
          </H2>
          <Link to="/about" className="link-wipe inline-flex items-center gap-2 pb-1 text-sm text-chrome hover:text-platinum">
            Meet the team <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="mt-14 grid grid-cols-3 gap-3 md:grid-cols-6">
          {TEAM.map((m) => (
            <Link to="/about" key={m.id} data-reveal className="group">
              <div className="aspect-[4/5] overflow-hidden rounded-xl border border-line bg-panel">
                <img
                  src={`/team/${m.id}.webp`}
                  alt={m.name}
                  loading="lazy"
                  className="size-full object-cover opacity-85 grayscale transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.03] group-hover:opacity-100 group-hover:grayscale-0"
                />
              </div>
              <div className="mt-2 text-[13px] text-platinum">{m.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line px-4 py-32 sm:px-6 md:py-44">
      <div className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_120%,rgba(242,200,121,0.14),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1000px] text-center">
        <div className="mb-8 flex justify-center">
          <Astronaut size={110} mood="happy" action="celebrate" />
        </div>
        <h2 className="split-reveal text-[clamp(36px,6vw,92px)] leading-[0.98] font-medium tracking-[-0.045em]">
          Find where Earth <span className="font-serif font-normal text-flare italic">can teach us.</span>
        </h2>
        <div data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/lab" className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-medium">
            Open the Analog Lab <ArrowRight size={16} />
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-4 text-sm text-platinum hover:border-chrome">
            <Github size={16} /> View the code
          </a>
        </div>
      </div>
    </section>
  );
}
