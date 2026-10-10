import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Eyebrow, Footer, Github, Nav, REPO_URL } from "../components/ui/Chrome";
import { Astronaut } from "../components/ui/Astronaut";

const TEAM = [
  { id: "rubab", name: "Abdullah Rubab", role: "Team lead", line: "Leads the team — scope, architecture and every claim we make." },
  { id: "hossin", name: "Tanvir Hossin", role: "Planetary terrain research", line: "Researches Moon and Mars terrain, targets and the products behind them." },
  { id: "saniul", name: "Mohammad Saniul Alam", role: "Experience design", line: "Designs the experience — maps, comparisons and how a judge reads them." },
  { id: "tasnuva", name: "Tasnuva Arif", role: "Development & testing", line: "Builds and tests the app, and is the voice of our film." },
  { id: "hasan", name: "Md. Tanvir Hasan", role: "Scientific validation", line: "Validates our science — splits, baselines and independent checks." },
  { id: "parvez", name: "Mohammed Mahmud Parvez", role: "Film & motion", line: "Edits our film and shapes the motion language." },
];

const AWARDS = [
  { a: "Best Use of Science", f: "Mission-conditioned scoring; matched-scale terrain statistics; horizon-based shadow model; reality gaps on every site." },
  { a: "Best Use of Data", f: "12 live NASA layers plus LOLA, MOLA & SRTM elevation; ESA, JAXA & ISRO products in the pipeline; every value tagged by source." },
  { a: "Best Use of Technology", f: "WebGL Terrain Twins with real DEMs, browser-side illumination, GIS across three bodies, and a trainable ranker on Kaggle." },
  { a: "Galactic Impact", f: "A reusable method that tells mission teams where — and when — to rehearse, and what the rehearsal can't prove." },
  { a: "Best Mission Concept", f: "“What mission can we test here?” — the Lab turns a target into a field-ready passport with a best season." },
  { a: "Most Inspirational", f: "Astra, our field-test astronaut, shows the search succeed and fail — exploration with honesty." },
  { a: "Best Storytelling", f: "Earth → Moon → Mars, the false-friend reversal, and Light & Shadow as a narrative thread." },
  { a: "Global Connection", f: "Search analogs anywhere; Rehearse-closer works from any team's city, not just from big space agencies." },
  { a: "Art & Technology", f: "Cinematic 3D Earth, Moon and Mars from NASA mosaics; sunlight-and-shadow palette; restrained, premium motion." },
  { a: "Local Impact", f: "Dhaka-first STEM workshops and a Bangla-friendly classroom mode so students can do planetary science from home." },
];

const TIMELINE = [
  { d: "Sep 2026", t: "Team formed in Dhaka; challenge chosen" },
  { d: "1 Oct", t: "Concept film submitted" },
  { d: "Oct", t: "Preliminary prototype — this repository" },
  { d: "Nov", t: "Hackathon: full-precision data, baseline ranker, site passports" },
  { d: "Next", t: "Trained model, expert review, open dataset and classroom pilot" },
];

export default function About() {
  return (
    <div className="bg-void">
      <Nav />
      <section className="relative overflow-hidden border-b border-line px-4 pt-24 pb-20 sm:px-6">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_80%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-[1400px] items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <Eyebrow>About ShadowAstra</Eyebrow>
            <h1 className="mt-8 max-w-[1000px] text-[clamp(38px,5.6vw,84px)] leading-[0.98] font-medium tracking-[-0.045em]">
              We study the shadows <span className="font-serif font-normal text-flare italic">so crews can walk in the light.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-chrome">
              We are ShadowAstra, a six-person team from Dhaka. Our name comes from the place humanity will build its first permanent Moon base: the
              lunar south pole, where ridges catch the Sun and crater floors stay in shadow for billions of years. ShadowAstra Atlas finds where on Earth
              those conditions — and Mars’s — can be rehearsed first.
            </p>
          </div>
          <Astronaut size={150} mood="happy" action="wave" say="That's us. Six crew, one mission." sayAlign="left" className="hidden lg:inline-block" />
        </div>
      </section>

      <section className="border-b border-line px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <Eyebrow>The crew</Eyebrow>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((m, k) => (
              <motion.article
                key={m.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.9, delay: (k % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group overflow-hidden rounded-2xl border border-line bg-panel"
              >
                <div className="aspect-[5/4] overflow-hidden">
                  <img
                    src={`/team/${m.id}.webp`}
                    alt={`Portrait of ${m.name}`}
                    className="size-full object-cover object-top grayscale transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-6">
                  <div className="font-mono text-[10px] tracking-[0.22em] text-flare uppercase">{m.role}</div>
                  <h3 className="mt-2 text-[22px] font-medium tracking-tight">{m.name}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-chrome">{m.line}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-ink px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Built for every judging lens</Eyebrow>
            <h2 className="mt-6 text-[clamp(28px,3.2vw,46px)] leading-[1.05] font-medium tracking-tight">
              Ten award categories, <span className="font-serif font-normal text-chrome italic">one honest product.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-chrome">
              We did not add features to tick boxes. Each category maps to something you can open and test in this prototype — or to a clearly
              labelled next step.
            </p>
          </div>
          <ul className="border-t border-line">
            {AWARDS.map((x, k) => (
              <li key={x.a} className="grid gap-2 border-b border-line py-4 sm:grid-cols-[220px_1fr]">
                <span className="flex items-baseline gap-3 text-[15px] text-platinum">
                  <span className="font-mono text-[11px] text-dim">{String(k + 1).padStart(2, "0")}</span>
                  {x.a}
                </span>
                <span className="text-[14px] leading-relaxed text-chrome">{x.f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-line px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow>How we work</Eyebrow>
            <ul className="mt-8 space-y-5 text-[15px] leading-relaxed text-chrome">
              <li>
                <span className="text-platinum">Evidence over impressions.</span> A site that looks like Mars is not automatically a Mars rehearsal.
              </li>
              <li>
                <span className="text-platinum">Labels you can trust.</span> Computed, demo and reality-gap values never share a colour.
              </li>
              <li>
                <span className="text-platinum">Stewardship first.</span> Sacred, Indigenous and protected land is flagged before anyone plans a trip.
              </li>
              <li>
                <span className="text-platinum">Open by default.</span> Code, method and data lineage are public on GitHub.
              </li>
            </ul>
          </div>
          <div>
            <Eyebrow>Timeline</Eyebrow>
            <ol className="relative mt-8 space-y-6 border-l border-line pl-6">
              {TIMELINE.map((t, k) => (
                <li key={t.d} className="relative">
                  <span className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full border ${k <= 2 ? "border-flare bg-flare" : "border-line-2 bg-void"}`} />
                  <div className="font-mono text-[11px] text-dim">{t.d}</div>
                  <div className="text-[15px] text-platinum">{t.t}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-6">
          <h2 className="text-[clamp(26px,3vw,40px)] font-medium tracking-tight">See the method in action.</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/lab" className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium">
              Open the Analog Lab <ArrowRight size={16} />
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
