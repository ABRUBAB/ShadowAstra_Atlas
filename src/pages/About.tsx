import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, Eye, Leaf, Scale, Users } from "lucide-react";
import { Footer, Github, Nav, REPO_URL } from "../components/ui/Chrome";
import { Astronaut } from "../components/ui/Astronaut";
import { useSmoothScroll } from "../lib/useSmoothScroll";

const EASE = [0.22, 1, 0.36, 1] as const;

const TEAM = [
  { id: "rubab", name: "Abdullah Rubab", role: "Team lead", line: "Leads the team, scope, architecture and every claim we make." },
  { id: "hossin", name: "Tanvir Hossin", role: "Planetary terrain", line: "Researches Moon and Mars terrain, targets and the data behind them." },
  { id: "hasan", name: "Md. Tanvir Hasan", role: "Scientific validation", line: "Validates our science, splits, baselines and independent checks." },
  { id: "saniul", name: "Mohammad Saniul Alam", role: "Experience design", line: "Designs the experience, maps, comparisons and how a judge reads them." },
  { id: "tasnuva", name: "Tasnuva Arif", role: "Development & testing", line: "Builds and tests the app, and is the voice of our film." },
  { id: "parvez", name: "Mohammed Mahmud Parvez", role: "Film & motion", line: "Edits our film and shapes the motion language." },
];

const AWARDS = [
  { a: "Best Use of Science", f: "Every land area measured the same way as the Moon or Mars target, at the same 50 km scale. A learned model tested by hiding known sites." },
  { a: "Best Use of Data", f: "NASA POWER, MODIS (GIBS), SRTM, full-precision LOLA and MOLA, volcano and crater records, built into one open global dataset." },
  { a: "Best Use of Technology", f: "80,206 places re-ranked live in the browser, a 3D score globe, WebGL terrain from real heights, and a shadow model." },
  { a: "Galactic Impact", f: "Tells field teams where, and when, to practise, and what the practice can't prove." },
  { a: "Best Mission Concept", f: "Pick a job and a destination. The whole planet answers with places to test, why, and the best months to go." },
  { a: "Most Inspirational", f: "Astra, our field-test astronaut, shivers, sweats, cheers and admits when a place is poor practice." },
  { a: "Best Storytelling", f: "Earth to Moon to Mars, “looks alike is not enough”, and light and shadow as the thread." },
  { a: "Global Connection", f: "Check any town on Earth. Find the closest strong site from any team's city." },
  { a: "Art & Technology", f: "Cinematic globes from NASA mosaics, a sunlight-and-shadow palette, calm motion." },
  { a: "Local Impact", f: "Dhaka-first workshops and a Bangla classroom mode, so students far from Atacama do real planetary science." },
];

const VALUES = [
  { icon: Eye, t: "Evidence over impressions", d: "A site that looks like Mars is not automatically a Mars rehearsal." },
  { icon: Scale, t: "Labels you can trust", d: "Measured, learned and “Earth can't copy” values never share a colour." },
  { icon: Leaf, t: "Stewardship first", d: "Sacred, Indigenous and protected land is flagged before any trip." },
  { icon: Users, t: "Open by default", d: "Code, method and data lineage are public for anyone to reuse." },
];

const TIMELINE = [
  { d: "Sep 2026", t: "Team formed in Dhaka", s: "Six people, one challenge: find Earth's best practice grounds." },
  { d: "1 Oct", t: "Concept film submitted", s: "Who, why, what and what next, in under four minutes." },
  { d: "Oct", t: "Working prototype", s: "Maps, 3D compare, the shadow map and Astra. Then every land area on Earth measured and a tested model." },
  { d: "Nov", t: "Hackathon weekend", s: "The official 2026 datasets, minerals from EMIT, a terrain neural network and field test plans." },
  { d: "Next", t: "Community", s: "Expert review, an open dataset anyone can reuse, and a classroom pilot in Dhaka." },
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

function Rule() {
  return <motion.span className="block h-px w-10 origin-left bg-line-2" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />;
}

function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-[11px] text-flare">{n}</span>
      <Rule />
      <span className="font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">{children}</span>
    </div>
  );
}

export default function About() {
  useSmoothScroll();
  return (
    <div className="bg-void">
      <Nav />
      <Hero />
      <Crew />
      <Name />
      <Awards />
      <Values />
      <Timeline />
      <section className="relative overflow-hidden border-t border-line px-4 py-32 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_120%,rgba(242,200,121,0.12),transparent_70%)]" />
        <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-8">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} className="text-[clamp(30px,4vw,60px)] leading-[1.02] font-medium tracking-[-0.04em]">
            See the method <span className="font-serif font-normal text-flare italic">in action.</span>
          </motion.h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/discover" className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
              Find new test sites <ArrowRight size={16} />
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-6 py-3.5 text-sm hover:border-chrome">
              <Github size={16} /> GitHub <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative overflow-hidden border-b border-line">
      {/* The real lunar south pole, with a Sun sweeping around it, light and shadow. */}
      <motion.div style={{ y, opacity: fade }} className="pointer-events-none absolute top-1/2 right-[-12%] hidden aspect-square w-[62vw] max-w-[860px] -translate-y-1/2 lg:block">
        <div className="relative size-full overflow-hidden rounded-full">
          <img src="/textures/moon_south_pole_lola.webp" alt="" className="polar-image size-full scale-[1.35] object-cover opacity-70" />
          <div className="absolute inset-0 animate-[sweep_22s_linear_infinite] rounded-full" style={{ background: "conic-gradient(from 0deg, rgba(242,200,121,0.28), rgba(7,8,10,0.0) 18%, rgba(7,8,10,0.85) 45%, rgba(7,8,10,0.9) 70%, rgba(242,200,121,0.0) 92%, rgba(242,200,121,0.28))", mixBlendMode: "multiply" }} />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_0_120px_60px_var(--color-void)]" />
        </div>
      </motion.div>
      <div className="relative mx-auto max-w-[1400px] px-4 pt-28 pb-24 sm:px-6 lg:pt-36 lg:pb-32">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">
          <span className="h-px w-8 bg-chrome/50" /> About ShadowAstra
        </motion.div>
        <h1 className="mt-8 max-w-[900px] text-[clamp(40px,6vw,92px)] leading-[0.98] font-medium tracking-[-0.045em]">
          <Words text="We study the shadows" />
          <br />
          <Words text="so crews can walk in the light." className="font-serif font-normal tracking-[-0.02em] text-flare italic" delay={0.3} />
        </h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.7 }} className="mt-8 max-w-[600px] text-[17px] leading-relaxed text-chrome">
          We are ShadowAstra, a six-person team from Dhaka. Our name comes from the place humanity will build its first permanent Moon base, the lunar south pole, where ridges catch the Sun and crater floors stay dark for billions of years.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.1 }} className="mt-12">
          <Astronaut size={86} mood="happy" action="wave" say="That's us. Six crew, one mission." sayAlign="side" />
        </motion.div>
        <div className="mt-16 grid max-w-[720px] grid-cols-3 border-t border-line pt-8">
          {[
            ["6", "people"],
            ["3", "worlds"],
            ["1", "city: Dhaka"],
          ].map(([n, l], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 1 + i * 0.1 }}>
              <div className="font-mono text-[44px] leading-none font-light">{n}</div>
              <div className="mt-2 text-[13px] text-dim">{l}</div>
            </motion.div>
          ))}
        </div>
      </div>
      <style>{`@keyframes sweep{to{transform:rotate(360deg)}}`}</style>
    </section>
  );
}

/* --------------------------------------------------------------------- crew */

function Crew() {
  return (
    <section className="border-b border-line px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="01">The crew</Kicker>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} className="mt-6 text-[clamp(30px,4vw,58px)] leading-[1.03] font-medium tracking-[-0.038em]">
          Six people, <span className="font-serif font-normal text-chrome italic">three worlds.</span>
        </motion.h2>
        <div className="mt-14 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m, k) => (
            <motion.article key={m.id} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="group" transition={{ staggerChildren: 0.1, delayChildren: (k % 3) * 0.1 }}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-panel">
                <motion.div
                  className="absolute inset-0"
                  variants={{ hidden: { clipPath: "inset(100% 0 0 0)" }, show: { clipPath: "inset(0% 0 0 0)" } }}
                  transition={{ duration: 1.3, ease: EASE }}
                >
                  <motion.img
                    src={`/team/${m.id}.webp`}
                    alt={`Portrait of ${m.name}`}
                    variants={{ hidden: { scale: 1.18 }, show: { scale: 1 } }}
                    transition={{ duration: 1.6, ease: EASE }}
                    className="size-full object-cover object-top grayscale transition-[filter] duration-700 group-hover:grayscale-0"
                  />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-void/80 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="absolute top-4 left-4 font-mono text-[11px] text-white/80 mix-blend-difference">{String(k + 1).padStart(2, "0")}</span>
                <p className="absolute inset-x-5 bottom-5 translate-y-3 text-[14px] leading-relaxed text-platinum opacity-0 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-y-0 group-hover:opacity-100">{m.line}</p>
              </div>
              <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.9, ease: EASE }} className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[20px] font-medium tracking-tight">{m.name}</h3>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-flare uppercase">{m.role}</span>
                </div>
                <span className="mt-3 block h-px w-full origin-left scale-x-[0.15] bg-line-2 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-x-100 group-hover:bg-flare/60" />
              </motion.div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- name */

function Name() {
  return (
    <section className="border-b border-line bg-ink px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="02">The name</Kicker>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
          {[
            { w: "Shadow", d: "Permanently shadowed craters at the lunar poles hold water ice in the coldest places in the Solar System. Where the light never reaches is where the future base will find water." },
            { w: "Astra", d: "Latin for “the stars”. The destination, and the reason we practise first, here, on the one world we can walk freely." },
          ].map((x, i) => (
            <motion.div key={x.w} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: i * 0.15 }} className="group relative overflow-hidden bg-panel p-10 md:p-14">
              <div className={`absolute inset-0 opacity-0 transition-opacity duration-1000 group-hover:opacity-100 ${i === 0 ? "bg-[radial-gradient(60%_80%_at_0%_100%,rgba(16,26,58,0.9),transparent)]" : "bg-[radial-gradient(60%_80%_at_100%_0%,rgba(242,200,121,0.14),transparent)]"}`} />
              <div className="relative">
                <div className={`text-[clamp(56px,8vw,120px)] leading-none tracking-[-0.05em] ${i === 0 ? "font-medium text-platinum" : "font-serif text-flare italic"}`}>{x.w}</div>
                <p className="mt-6 max-w-md text-[16px] leading-relaxed text-chrome">{x.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- awards */

function Awards() {
  return (
    <section className="border-b border-line px-4 py-28 sm:px-6">
      <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Kicker n="03">Built for every judging lens</Kicker>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} className="mt-6 text-[clamp(28px,3.4vw,50px)] leading-[1.04] font-medium tracking-[-0.035em]">
            Ten award categories, <span className="font-serif font-normal text-chrome italic">one honest product.</span>
          </motion.h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-chrome">Each category maps to something you can open and test in this prototype, or to a clearly labelled next step.</p>
          <div className="mt-10 hidden lg:block">
            <Astronaut size={110} mood="happy" action="flag" />
          </div>
        </div>
        <ul className="border-t border-line">
          {AWARDS.map((x, k) => (
            <motion.li
              key={x.a}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, ease: EASE, delay: (k % 5) * 0.04 }}
              className="group relative grid gap-2 border-b border-line py-6 pl-6 transition-colors duration-500 hover:bg-panel sm:grid-cols-[240px_1fr]"
            >
              <span className="absolute top-0 bottom-0 left-0 w-px origin-top scale-y-0 bg-flare transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-y-100" />
              <span className="flex items-baseline gap-3 text-[17px] text-platinum">
                <span className="font-mono text-[11px] text-dim transition-colors group-hover:text-flare">{String(k + 1).padStart(2, "0")}</span>
                {x.a}
              </span>
              <span className="pr-4 text-[14px] leading-relaxed text-chrome transition-colors group-hover:text-platinum">{x.f}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- values */

function Values() {
  return (
    <section className="border-b border-line bg-ink px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <Kicker n="04">How we work</Kicker>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="surface lift rounded-2xl p-7"
            >
              <v.icon size={20} strokeWidth={1.5} className="text-flare" />
              <h3 className="mt-10 text-[18px] font-medium tracking-tight">{v.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-chrome">{v.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- timeline */

function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <section className="px-4 py-28 sm:px-6">
      <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <Kicker n="05">Timeline</Kicker>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} className="mt-6 text-[clamp(28px,3.4vw,50px)] leading-[1.04] font-medium tracking-[-0.035em]">
            From a team in Dhaka <span className="font-serif font-normal text-chrome italic">to a method for anyone.</span>
          </motion.h2>
        </div>
        <div ref={ref} className="relative pl-10">
          <div className="absolute top-2 bottom-2 left-[5px] w-px bg-line" />
          <motion.div style={{ scaleY: fill }} className="absolute top-2 bottom-2 left-[5px] w-px origin-top bg-flare" />
          <ol className="space-y-12">
            {TIMELINE.map((t, k) => (
              <motion.li key={t.d} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.9, ease: EASE }} className="relative">
                <span className={`absolute top-1.5 -left-10 size-[11px] rounded-full border ${k <= 2 ? "border-flare bg-flare" : "border-line-2 bg-void"}`} />
                <div className="font-mono text-[11px] tracking-widest text-dim uppercase">{t.d}</div>
                <div className="mt-1 text-[22px] font-medium tracking-tight text-platinum">{t.t}</div>
                <p className="mt-1 max-w-lg text-[14px] text-chrome">{t.s}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
