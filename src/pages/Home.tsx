import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ArrowUpRight, Award, Check, CircleDashed, Gamepad2, Globe, GraduationCap, Layers, Leaf, Lock, MapPin, Orbit, Radar, ShieldCheck, Target } from "lucide-react";
import { Footer, Github, Nav, REPO_URL, WorldDot } from "../components/ui/Chrome";
import { Astronaut, type Action, type Mood } from "../components/ui/Astronaut";
import { Counter, EASE, GlyphTile, Kicker, Magnetic, WordCycler } from "../components/ui/kit";
import { EarthOrMars } from "../components/EarthOrMars";
import { CheckTown } from "../components/CheckTown";
import { EARTH_SITES, TARGETS, TARGET_BY_ID, TASKS } from "../data/sites";
import { formatCoord, polarPixel, POLAR_IMAGE_SIZE } from "../lib/geo";
import { useSmoothScroll } from "../lib/useSmoothScroll";
import { BADGES, useFieldLog } from "../lib/fieldlog";
import { useValidation } from "../lib/validation";
import { MODEL_MIX } from "../lib/grid";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const HeroScene = lazy(() => import("../components/three/HeroScene"));
const GSAP_EASE = "expo.out";

export default function Home() {
  useSmoothScroll();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(".hero-title", { type: "words", mask: "words" });
        gsap
          .timeline({ defaults: { ease: GSAP_EASE } })
          .from(split.words, { yPercent: 105, duration: 1.4, stagger: 0.07, delay: 0.15 })
          .from(".hero-fade", { opacity: 0, y: 14, duration: 1.1, stagger: 0.09 }, "-=1.0")
          .from(".hero-hud", { opacity: 0, duration: 1.2 }, "-=0.6");

        ScrollTrigger.batch("[data-reveal]", {
          start: "top 90%",
          once: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: GSAP_EASE }),
        });

        gsap.utils.toArray<HTMLElement>(".split-reveal").forEach((el) => {
          const s = SplitText.create(el, { type: "words", mask: "words" });
          gsap.from(s.words, { yPercent: 100, duration: 1.15, stagger: 0.03, ease: GSAP_EASE, scrollTrigger: { trigger: el, start: "top 86%" } });
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

  // Deep links such as /#play scroll once the page has laid out.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={root} className="bg-void">
      <Nav overlay />
      <Hero />
      <SourceMarquee />
      <Numbers />
      <TryIt />
      <TownSection />
      <PlaySection />
      <MeetAstra />
      <FalseFriend />
      <MoonBase />
      <HowItWorks />
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

function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`split-reveal text-[clamp(30px,4.2vw,62px)] leading-[1.03] font-medium tracking-[-0.038em] ${className ?? ""}`}>{children}</h2>;
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-serif font-normal text-chrome italic">{children}</span>;
}

function Section({ id, children, className, ink }: { id?: string; children: React.ReactNode; className?: string; ink?: boolean }) {
  return (
    <section id={id} className={clsx("relative scroll-mt-16 border-t border-line px-4 py-28 sm:px-6 md:py-36", ink && "bg-ink", className)}>
      <div className="mx-auto max-w-[1400px]">{children}</div>
    </section>
  );
}

/** Astra appears in each chapter, doing that chapter's job. */
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
          <div className="hero-fade mb-7 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-chrome uppercase">
            <span className="h-px w-8 bg-chrome/50" />
            NASA Space Apps 2026 · Team ShadowAstra · Dhaka
          </div>
          <h1 className="hero-title text-[clamp(40px,min(7vw,11vh),112px)] leading-[0.95] font-medium tracking-[-0.045em] text-platinum">
            <span className="block">Practise for other worlds</span>
            <span className="block font-serif font-normal tracking-[-0.02em] text-flare italic">on this one.</span>
          </h1>
          <p className="hero-fade mt-7 max-w-[560px] text-[17px] leading-relaxed text-chrome">
            Astronauts and rovers test their gear on Earth first. ShadowAstra Atlas measures every land area on Earth with NASA data and finds the best places
            to practise for{" "}
            <WordCycler words={["a Moon base.", "driving on Mars.", "finding ice.", "exploring lava tubes.", "the search for life."]} className="text-platinum" />
          </p>
          <div className="hero-fade mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link to="/discover" className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
                Find new test sites
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </Magnetic>
            <Link to="/lab" className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-void/40 px-6 py-3.5 text-sm text-platinum backdrop-blur transition-colors hover:border-chrome">
              Compare two places in 3D
            </Link>
            <a href="#town" className="link-wipe ml-1 inline-flex items-center gap-1.5 text-sm text-chrome hover:text-platinum">
              <MapPin size={14} /> How Mars-like is your town?
            </a>
          </div>
        </div>
      </div>

      <div className="hero-hud pointer-events-none absolute right-4 bottom-24 z-10 hidden w-[340px] sm:right-6 min-[900px]:block">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-dim uppercase">
            <span>
              Known test site {String(i + 1).padStart(2, "0")}/{EARTH_SITES.length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-strong" /> live
            </span>
          </div>
          <div key={s.id} className="mt-3 animate-[hudIn_.6s_cubic-bezier(.22,1,.36,1)]">
            <div className="text-[15px] font-medium text-platinum">{s.name}</div>
            <div className="font-mono text-[11px] text-chrome tabular">
              {formatCoord(s.lat, s.lon)} · {s.country}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-dim">
              <WorldDot world="earth" />
              <span className="h-px flex-1 bg-line-2" />
              <span className="font-serif text-[13px] italic">practises for</span>
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
  const items = ["NASA POWER", "NASA GIBS · MODIS", "LRO LOLA", "MGS MOLA", "SRTM terrain", "LRO LROC", "Mars Odyssey THEMIS", "Viking MDIM", "ASTER GDEM", "Smithsonian GVP", "ESA Sentinel-2", "Natural Earth"];
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink py-4" aria-label="Data sources">
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

/* ------------------------------------------------------------- numbers */

function Numbers() {
  const { v } = useValidation();
  const newSites = v?.independent.all.blend?.median ?? null;
  const stats = [
    { n: 80206, d: 0, s: "", label: "land areas measured", note: "every 55 km square of land on Earth", icon: Globe },
    { n: 24, d: 0, s: "", label: "measurements each", note: "slopes, cold, heat, rain, plants, volcanoes, craters, plus EMIT minerals in dry land", icon: Layers },
    { n: 38, d: 0, s: "", label: "known sites learned from", note: "used by NASA, ESA, CSA and universities", icon: Target },
    {
      n: newSites ?? 0,
      d: 1,
      s: "%",
      label: "where 28 sites it never saw rank",
      note: newSites === null ? "published test sites kept out of training" : `published test sites kept out of training land in the top ${newSites.toFixed(1)}% of all land`,
      icon: Radar,
    },
  ];
  return (
    <Section>
      <div className="flex items-start justify-between gap-6">
        <Kicker n="01">The challenge</Kicker>
        <Guide mood="thinking" action="idle" size={96} className="-mt-6 hidden md:block" />
      </div>
      <H2 className="mt-8 max-w-[1100px]">
        NASA asked for new places on Earth that copy the Moon and Mars. <Em>So we measured all of them.</Em>
      </H2>
      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <p data-reveal className="max-w-xl text-[17px] leading-relaxed text-chrome">
          The 2026 challenge asks teams to use open Earth, Moon and Mars data to <span className="text-platinum">find and describe new analog sites</span>: places on
          Earth that are similar enough to practise a mission.
        </p>
        <p data-reveal className="max-w-xl text-[17px] leading-relaxed text-chrome">
          We start with the job, not the picture. A rover test and an ice hunt need different places. So the Atlas compares{" "}
          <span className="text-platinum">ground shape, rocks, cold, sunlight and bare ground</span> for the job you pick, and tells you plainly what Earth can't copy.
        </p>
      </div>
      <div className="mt-16 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: EASE, delay: i * 0.07 }}
            className="surface lift rounded-2xl p-5 md:p-7"
          >
            <GlyphTile>
              <s.icon size={18} strokeWidth={1.5} />
            </GlyphTile>
            <div className="mt-7 font-mono text-[clamp(34px,4.4vw,64px)] leading-none font-light tracking-tight text-platinum">
              <Counter value={s.n} decimals={s.d} suffix={s.s} duration={1.8} />
            </div>
            <div className="mt-3 text-sm text-platinum">{s.label}</div>
            <div className="mt-1 text-xs leading-relaxed text-dim">{s.note}</div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- try it */

function MiniHeat() {
  return (
    <div className="relative h-36 overflow-hidden rounded-xl border border-line bg-void">
      <img src="/textures/earth_day_1k.webp" alt="" className="absolute inset-0 size-full object-cover opacity-40 saturate-50" />
      {[
        [62, 38, 0],
        [55, 46, 0.6],
        [28, 70, 1.2],
        [76, 34, 1.8],
        [52, 57, 0.9],
      ].map(([x, y, d], k) => (
        <span
          key={k}
          className="absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, background: "radial-gradient(circle, rgba(242,200,121,0.9), rgba(224,138,95,0.4) 45%, transparent 70%)", animation: `heatPulse 3.2s ${d}s ease-in-out infinite` }}
        />
      ))}
      <style>{`@keyframes heatPulse{0%,100%{transform:translate(-50%,-50%) scale(.7);opacity:.5}50%{transform:translate(-50%,-50%) scale(1.15);opacity:1}}`}</style>
    </div>
  );
}

function MiniRidges() {
  return (
    <div className="relative h-36 overflow-hidden rounded-xl border border-line bg-void">
      <svg viewBox="0 0 300 140" className="absolute inset-0 size-full" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <motion.path
            key={k}
            d={`M0,${110 - k * 12} C40,${96 - k * 12 - (k % 2) * 14} 80,${118 - k * 12} 120,${92 - k * 12} S200,${70 - k * 10} 240,${96 - k * 12} S290,${84 - k * 12} 300,${90 - k * 12}`}
            fill="none"
            style={{ stroke: k < 3 ? "var(--color-earth)" : "var(--color-mars)" }}
            strokeWidth="1"
            strokeOpacity={0.35 + k * 0.1}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: k * 0.12, ease: EASE }}
          />
        ))}
      </svg>
    </div>
  );
}

function MiniTown() {
  return (
    <div className="relative grid h-36 place-items-center overflow-hidden rounded-xl border border-line bg-void">
      <div className="flex w-[78%] flex-col gap-3">
        {[
          ["Moon-like", 0.34, "var(--color-moon)"],
          ["Mars-like", 0.81, "var(--color-mars)"],
        ].map(([k, v, c]) => (
          <div key={k as string}>
            <div className="flex justify-between text-[11px] text-chrome">
              <span>{k}</span>
              <span className="font-mono">{Math.round((v as number) * 100)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full rounded-full" style={{ background: c as string }} initial={{ width: 0 }} whileInView={{ width: `${(v as number) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.3, ease: EASE }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniGame() {
  return (
    <div className="relative grid h-36 grid-cols-2 gap-2 overflow-hidden rounded-xl border border-line bg-void p-2">
      <img src="/thumbs/atacama.webp" alt="" className="size-full rounded-lg object-cover grayscale" />
      <div className="grid place-items-center rounded-lg bg-[url(/textures/mars_viking_1k.webp)] bg-[length:600%] bg-[position:40%_45%] grayscale">
        <span className="rounded-full bg-void/70 px-2 py-0.5 font-mono text-[11px] text-platinum">?</span>
      </div>
    </div>
  );
}

function MiniTwins() {
  return (
    <div className="relative flex h-36 items-center justify-center gap-10 overflow-hidden rounded-xl border border-line bg-void">
      <motion.span className="block size-16 rounded-full bg-[url(/textures/mars_viking_1k.webp)] bg-[length:200%_100%] shadow-[inset_-10px_-4px_14px_rgba(0,0,0,0.85)]" animate={{ backgroundPositionX: ["0%", "-200%"] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
      <span className="absolute top-1/2 left-1/2 h-px w-16 -translate-x-1/2 bg-gradient-to-r from-mars/60 via-flare to-earth/60" />
      <motion.span className="absolute top-1/2 left-1/2 size-1.5 -translate-y-1/2 rounded-full bg-flare shadow-[0_0_10px_#f2c879]" animate={{ x: [-34, 30] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }} />
      <motion.span className="block size-16 rounded-full bg-[url(/textures/earth_day_1k.webp)] bg-[length:200%_100%] shadow-[inset_-10px_-4px_14px_rgba(0,0,0,0.85)]" animate={{ backgroundPositionX: ["0%", "-200%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} />
    </div>
  );
}

function MiniLearn() {
  return (
    <div className="relative flex h-36 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-line bg-void">
      <span className="text-[26px] font-medium text-platinum">Practise on Earth.</span>
      <span className="font-bn text-[22px] text-flare">পৃথিবীতে অনুশীলন।</span>
    </div>
  );
}

function TryIt() {
  const cards = [
    { to: "/discover", t: "Find new test sites", d: "See the whole Earth ranked live for the job you pick. Click any place to see why it scores.", cta: "Open the finder", visual: <MiniHeat />, icon: Globe },
    { to: "/lab", t: "Compare two places in 3D", d: "Real ground from Earth and the Moon or Mars, cut to the same size, with a Sun you can move.", cta: "Open compare", visual: <MiniRidges />, icon: Layers },
    { to: "#town", t: "Check your town", d: "Type any town. See how Moon-like and Mars-like it is, and the nearest strong site.", cta: "Check a town", visual: <MiniTown />, icon: MapPin },
    { to: "#play", t: "Play: Earth or Mars?", d: "Two real images at the same scale, colour off. Can you spot which one is not Earth?", cta: "Play now", visual: <MiniGame />, icon: Gamepad2 },
    { to: "/atlas?body=mars", t: "Earth twins of any spot", d: "Tap anywhere on the Moon or Mars. We find the places on Earth with the same ground.", cta: "Open the map", visual: <MiniTwins />, icon: Orbit },
    { to: "/learn", t: "Learn, in English or Bangla", d: "Short lessons, a quiz scored with real NASA data, and a worksheet to print for class.", cta: "Start learning", visual: <MiniLearn />, icon: GraduationCap },
  ];
  return (
    <Section ink>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Kicker n="02">Things to try</Kicker>
          <H2 className="mt-8 max-w-[860px]">
            Six ways in. <Em>Pick one and start exploring.</Em>
          </H2>
        </div>
        <Guide mood="happy" action="point" size={104} className="hidden md:block" />
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => {
          const inner = (
            <>
              {c.visual}
              <div className="mt-5 flex items-center gap-3">
                <GlyphTile className="size-10">
                  <c.icon size={16} strokeWidth={1.6} />
                </GlyphTile>
                <h3 className="text-[18px] leading-tight font-medium tracking-tight">{c.t}</h3>
              </div>
              <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-chrome">{c.d}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-flare">
                {c.cta} <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </span>
            </>
          );
          const cls = "surface lift group flex h-full flex-col rounded-2xl p-4";
          return (
            <motion.div key={c.t} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }}>
              {c.to.startsWith("#") ? (
                <a href={c.to} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link to={c.to} className={cls}>
                  {inner}
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function TownSection() {
  return (
    <Section id="town">
      <Kicker n="03">Your town</Kicker>
      <H2 className="mt-8 max-w-[900px]">
        How Mars-like is your town? <Em>Ask the same model that ranks the planet.</Em>
      </H2>
      <div className="mt-14">
        <CheckTown />
      </div>
    </Section>
  );
}

function PlaySection() {
  return (
    <Section id="play" ink>
      <Kicker n="04">A quick game</Kicker>
      <H2 className="mt-8 max-w-[900px]">
        Earth or Mars? <Em>It is harder than you think.</Em>
      </H2>
      <p data-reveal className="mt-6 max-w-[620px] text-[16px] leading-relaxed text-chrome">
        Each pair is a real Earth test site and the Moon or Mars place it is used to practise for. Same size, colour off. If you can't tell them apart, the site is
        doing its job.
      </p>
      <div className="mt-12">
        <EarthOrMars />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ meet astra */

const MOODS: { label: string; mood: Mood; action: Action; say: string }[] = [
  { label: "Say hello", mood: "happy", action: "wave", say: "Hi! I'm Astra. I test places so real crews don't have to guess." },
  { label: "Scan the ground", mood: "focused", action: "scan", say: "Scanning slopes and rocks at the same scale as the target…" },
  { label: "Drill a core", mood: "focused", action: "drill", say: "A core sample tells us what the ground is made of." },
  { label: "Take a sample", mood: "happy", action: "sample", say: "Bagged and labelled. Clean hands, clean science." },
  { label: "Look far", mood: "thinking", action: "binoculars", say: "Somewhere out there is a place nobody has tested yet." },
  { label: "Cold night", mood: "cold", action: "shiver", say: "Brr! −40 °C. The lunar night is far colder, but this is good practice." },
  { label: "Hot noon", mood: "hot", action: "fan", say: "The ground is 60 °C. Great for testing how gear handles heat." },
  { label: "Great match", mood: "happy", action: "celebrate", say: "0.86! This place copies the mission really well." },
  { label: "Poor match", mood: "sad", action: "slump", say: "0.31. It looks right, but it won't test what matters." },
  { label: "Plant a flag", mood: "wow", action: "flag", say: "New candidate site! Let's tell the field teams." },
];

function MeetAstra() {
  const [k, setK] = useState(0);
  const m = MOODS[k];
  const got = useFieldLog();
  useEffect(() => {
    const t = setInterval(() => setK((n) => (n + 1) % MOODS.length), 5200);
    return () => clearInterval(t);
  }, [k]);
  return (
    <Section>
      <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
        <div data-theme="dark" className="relative overflow-hidden rounded-3xl border border-line bg-void">
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_100%,rgba(242,200,121,0.16),transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[url(/textures/moon_lroc_1k.webp)] bg-[length:200%] bg-[position:30%_60%] opacity-30 [mask-image:linear-gradient(to_top,black,transparent)]" />
          <div className="relative grid min-h-[460px] place-items-center p-8">
            <div className="flex flex-col items-center">
              <AnimatePresence mode="wait">
                <motion.p key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }} className="glass mb-6 max-w-[320px] rounded-2xl px-4 py-3 text-center text-[14.5px] leading-snug text-platinum">
                  {m.say}
                </motion.p>
              </AnimatePresence>
              <Astronaut size={240} mood={m.mood} action={m.action} />
            </div>
          </div>
        </div>
        <div>
          <Kicker n="05">Meet Astra</Kicker>
          <H2 className="mt-8">
            He goes where you point him. <Em>And he tells you the truth.</Em>
          </H2>
          <p data-reveal className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-chrome">
            Astra is our field-test astronaut. He checks every place you open, shivers in the cold, sweats in the heat, and says plainly when a place is poor
            practice. He also answers questions in the corner of every page.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {MOODS.map((x, i) => (
              <button
                key={x.label}
                onClick={() => setK(i)}
                aria-pressed={i === k}
                className={clsx("rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors", i === k ? "border-flare/60 bg-flare/10 text-flare" : "border-line-2 text-chrome hover:border-chrome hover:text-platinum")}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="surface mt-10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[14px] text-platinum">
                <Award size={16} className="text-flare" /> Astra's field log
              </div>
              <span className="font-mono text-[12px] text-dim">
                {got.length} of {BADGES.length} badges
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full rounded-full bg-flare" initial={{ width: 0 }} whileInView={{ width: `${(got.length / BADGES.length) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {BADGES.map((b) => {
                const on = got.includes(b.id);
                return (
                  <li key={b.id} className={clsx("flex items-start gap-2.5 rounded-xl border p-2.5", on ? "border-flare/40 bg-flare/[0.06]" : "border-line")}>
                    <span className={clsx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", on ? "bg-flare text-void" : "bg-ink text-dim")}>{on ? <Check size={12} /> : <Lock size={11} />}</span>
                    <span>
                      <span className={clsx("block text-[12.5px]", on ? "text-platinum" : "text-chrome")}>{b.title}</span>
                      <span className="block text-[11px] leading-snug text-dim">{b.how}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </Section>
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
    { k: "01", title: "It looks like Mars.", text: "Red rock, no plants, a crater on the horizon. Site A is the obvious place to practise a rover drive." },
    { k: "02", title: "The mission asks a different question.", text: "The real route crosses steep, broken ground. What matters is the slope and bumps under the wheels, not the colour." },
    { k: "03", title: "Compare the job, at the same scale.", text: "Site B has the obstacle the mission cares about. The Atlas changes the choice while the plan can still change." },
  ];
  const astra: { mood: Mood; action: Action; say: string }[] = [
    { mood: "wow", action: "walk", say: "Looks just like Mars!" },
    { mood: "sad", action: "slump", say: "Site A is too gentle. The rover test would prove nothing." },
    { mood: "happy", action: "celebrate", say: "Site B matches the route. That's our practice ground." },
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
          <Kicker n="06">Looks alike is not enough</Kicker>
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
          <div className="surface rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-dim uppercase">
              <span>Route height profile</span>
              <span className="rounded-full border border-dashed border-line-2 px-2 py-0.5">Drawing to explain · not measured</span>
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
              <Legend color="var(--color-mars)" dashed label="Mars route" on={step >= 1} />
              <Legend color="var(--color-chrome)" label="Site A: looks right" on />
              <Legend color="var(--color-platinum)" label="Site B: tests right" on={step === 2} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-[13px]">
              <div className="bg-panel p-4">
                <div className="text-dim">Site A</div>
                <div className="mt-1 text-platinum">Same colour · gentle ground</div>
                <div className="mt-2 text-weak">✕ Misses the hard part of the drive</div>
              </div>
              <div className="bg-panel p-4">
                <div className="text-dim">Site B</div>
                <div className="mt-1 text-platinum">Same slopes and bumps</div>
                <div className={`mt-2 transition-opacity duration-700 ${step === 2 ? "text-strong opacity-100" : "opacity-0"}`}>✓ Practises the real obstacle</div>
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
          <div className="mt-4 text-center font-mono text-[10px] tracking-widest text-dim uppercase">LRO LOLA shaded relief · seen from above the pole · 84°S to the pole</div>
        </div>
        <div>
          <div className="flex items-end justify-between gap-6">
            <Kicker n="07">A base at the Moon's south pole</Kicker>
            <Guide mood="happy" action="flag" size={96} className="-mb-2 hidden md:block" />
          </div>
          <H2 className="mt-8">
            Light on the ridges, <Em>ice in the dark.</Em>
          </H2>
          <p data-reveal className="mt-6 max-w-lg text-[16px] leading-relaxed text-chrome">
            NASA's Artemis landing regions sit around the lunar south pole, where the Sun never climbs more than a few degrees. The base will live between light
            and shadow, so its practice ground must too.
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
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to={`/discover?target=${hover ?? "shackleton"}&task=polar`} className="link-wipe inline-flex items-center gap-2 text-sm text-flare">
              Find Earth sites for {TARGETS.find((t) => t.id === hover)?.name ?? "Shackleton"} <ArrowRight size={15} />
            </Link>
            <Link to="/lab?earth=dry-valleys&target=shackleton&task=polar" className="link-wipe inline-flex items-center gap-2 text-sm text-chrome hover:text-platinum">
              Dry Valleys vs Shackleton in 3D <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- how it works */

function HowItWorks() {
  const steps = [
    { k: "01", t: "Pick a job", d: `${TASKS.length} kinds of practice: living at a base, rover drives, ice hunts, lava tubes, craters and more.` },
    { k: "02", t: "Pick a destination", d: `${TARGETS.length} Moon and Mars places: Artemis regions, rover craters, ice plains and cave skylights.` },
    { k: "03", t: "Every land area is scored", d: "80,206 places on Earth, five measured scores plus a learned model, re-ranked live as you move the sliders." },
    { k: "04", t: "Check, compare, plan", d: "Open a place, compare it in 3D, see the best months for the light and the travel CO₂." },
  ];
  return (
    <Section ink>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Kicker n="08">How it works</Kicker>
          <H2 className="mt-8 max-w-[820px]">From a mission question to a place you can visit.</H2>
        </div>
        <Guide mood="focused" action="scan" size={110} className="hidden md:block" />
      </div>
      <ol className="mt-16 grid gap-4 md:grid-cols-4">
        {steps.map((s, i) => (
          <motion.li key={s.k} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }} className="surface relative flex flex-col rounded-2xl p-6">
            <span className="outline-num text-[56px] leading-none">{s.k}</span>
            <div className="mt-6 text-lg font-medium">{s.t}</div>
            <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-chrome">{s.d}</p>
            <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-strong/40 bg-strong/10 px-2.5 py-1 text-[11px] text-strong">
              <Check size={12} /> Working now
            </span>
            {i < steps.length - 1 && <span className="absolute top-1/2 -right-3 hidden h-px w-6 bg-line-2 md:block" />}
          </motion.li>
        ))}
      </ol>
      <Link to="/methods" className="link-wipe mt-10 inline-flex items-center gap-2 text-sm text-chrome hover:text-platinum">
        Read the full method and data list <ArrowUpRight size={15} />
      </Link>
    </Section>
  );
}

/* ---------------------------------------------------------- sustainability */

function Sustainability() {
  const cards = [
    { icon: Leaf, t: "Fewer, smarter field trips", d: "Remote checks narrow the shortlist before anyone flies. Compare shows each trip's distance and a rough CO₂ number, and the closest good site." },
    { icon: ShieldCheck, t: "Respect for the land", d: "Sites carry their protection status: Antarctic Treaty, national parks, sacred and Indigenous land. Permission comes before coordinates." },
    { icon: Target, t: "Local impact, Dhaka first", d: "A Bangla classroom mode and a university workshop, so students who can't reach Atacama can still do real planetary science." },
  ];
  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Kicker n="09">Explore responsibly</Kicker>
          <H2 className="mt-8 max-w-[880px]">
            Care for this planet <Em>so we can explore the next ones.</Em>
          </H2>
        </div>
        <Guide mood="neutral" action="walk" size={100} className="hidden md:block" />
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => (
          <motion.article key={c.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }} className="surface lift rounded-2xl p-7" style={{ ["--spot" as string]: "var(--color-strong)" }}>
            <GlyphTile tone="var(--color-strong)">
              <c.icon size={18} strokeWidth={1.5} />
            </GlyphTile>
            <h3 className="mt-8 text-[19px] font-medium tracking-tight">{c.t}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-chrome">{c.d}</p>
          </motion.article>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- library */

function Library() {
  return (
    <section className="relative border-t border-line bg-ink py-28 md:py-36">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex items-end justify-between gap-6">
          <Kicker n="10">Known test sites</Kicker>
          <Guide mood="happy" action="sample" size={96} className="hidden md:block" />
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <H2 className="max-w-[820px]">
            The places teams already use. <Em>Our model learned from them.</Em>
          </H2>
          <p className="max-w-sm text-sm text-dim">These are known sites, not our discoveries. We use them to train and test the model. New places live in Find new sites.</p>
        </div>
      </div>
      <div className="scrollbar-thin mt-14 flex snap-x gap-4 overflow-x-auto px-4 pb-6 sm:px-6 lg:px-[max(24px,calc((100vw-1400px)/2+24px))]">
        {EARTH_SITES.map((s) => (
          <Link key={s.id} to={`/lab?earth=${s.id}&target=${s.pairs[0]}`} className="surface group relative w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl">
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
  const { v } = useValidation();
  const hidden = v?.mixing?.curve.find((c) => Math.abs(c.mix - MODEL_MIX) < 0.01)?.known_median;
  const fresh = v?.independent.all.blend?.median;
  const done = [
    "Global data engine: 80,206 land areas measured from NASA POWER, MODIS, SRTM terrain, NASA EMIT minerals, volcanoes and craters",
    "The Moon and Mars measured everywhere at full precision (LRO LOLA, MGS MOLA), with Diviner cold and ice at the lunar south pole and Odyssey water on Mars",
    hidden !== undefined && fresh !== undefined
      ? `A learned model picked from nine on Kaggle: hidden known sites come back in the top ${hidden.toFixed(1)}% of land, and 28 published sites it never saw rank in the top ${fresh.toFixed(1)}%`
      : "A learned model picked from nine on Kaggle and tested on 28 published sites it never saw",
    "A terrain AI, trained on Kaggle GPUs with heights from three worlds, that finds Earth twins for any spot on the Moon or Mars",
    "Find new sites: a mission builder that searches the planet, compares places and prints a site report",
    "Compare any place in 3D with a movable Sun, a shadow map, minerals and travel CO₂; lessons in English, Spanish and Bangla",
    "An open dataset of every score on Hugging Face (CC BY 4.0), for anyone to check or reuse",
  ];
  const next = [
    "Add the official 2026 challenge datasets as new pipeline steps (released 28 Oct)",
    "Pinpoint the best 10 km spot inside each 55 km candidate",
    "Expert review of the top new sites by our scientific validation lead",
  ];
  return (
    <Section>
      <div className="flex items-end justify-between gap-6">
        <Kicker n="11">Progress</Kicker>
        <Guide mood="focused" action="drill" size={96} className="hidden md:block" />
      </div>
      <H2 className="mt-8 max-w-[900px]">
        What works today, <Em>and what we build next.</Em>
      </H2>
      <div className="mt-16 grid gap-4 md:grid-cols-2">
        <div data-reveal className="surface rounded-2xl p-7" style={{ ["--spot" as string]: "var(--color-strong)" }}>
          <div className="flex items-center gap-2 text-sm text-strong">
            <Check size={16} /> Built and live
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
            <CircleDashed size={16} /> Next, for the hackathon weekend
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
    </Section>
  );
}

/* -------------------------------------------------------------------- team */

const TEAM = [
  { id: "rubab", name: "Abdullah Rubab", role: "Team lead" },
  { id: "hossin", name: "Tanvir Hossin", role: "Planetary terrain" },
  { id: "hasan", name: "Md. Tanvir Hasan", role: "Science checks" },
  { id: "saniul", name: "Mohammad Saniul Alam", role: "Experience design" },
  { id: "tasnuva", name: "Tasnuva Arif", role: "Development & testing" },
  { id: "parvez", name: "Mohammed Mahmud Parvez", role: "Film" },
];

function TeamTeaser() {
  return (
    <Section ink>
      <Kicker n="12">Team ShadowAstra · Dhaka</Kicker>
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
            <div className="text-[11px] text-dim">{m.role}</div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  const pick = useMemo(() => TARGETS[Math.floor(Math.random() * TARGETS.length)], []);
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
          <Magnetic>
            <Link to={`/discover?target=${pick.id}&task=${pick.tasks[0]}`} className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-medium">
              Find sites for {pick.name} <ArrowRight size={16} />
            </Link>
          </Magnetic>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-4 text-sm text-platinum hover:border-chrome">
            <Github size={16} /> View the code
          </a>
        </div>
      </div>
    </section>
  );
}
