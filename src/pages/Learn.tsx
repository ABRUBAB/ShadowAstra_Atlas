import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Check, Flame, Languages, Mountain, Printer, RotateCcw, Snowflake, Sun, X } from "lucide-react";
import { Footer, Nav } from "../components/ui/Chrome";
import { Astronaut } from "../components/ui/Astronaut";
import { EASE, Kicker, Magnetic } from "../components/ui/kit";
import { TargetImage } from "../components/find/pieces";
import { TARGET_BY_ID, type TaskId } from "../data/sites";
import { MODEL_MIX, scoreCell, useGrid, type Grid } from "../lib/grid";
import { FACTORS } from "../lib/mission";
import { useEarthThumb } from "../lib/thumbs";
import { useSmoothScroll } from "../lib/useSmoothScroll";

/**
 * A classroom page in English and Bangla: what an analog is, the four questions, a quiz
 * scored live from the real data, what Earth can't copy, and a printable worksheet.
 */

type Lang = "en" | "bn";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const num = (s: string, lang: Lang) => (lang === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);

const T = {
  en: {
    kicker: "Classroom",
    h1a: "Practise on Earth.",
    h1b: "Then go.",
    intro: "Before people live on the Moon or Mars, they practise here, in places on Earth that are a lot like them. These places are called analogs. Let's find out how we choose them.",
    astra: "Hi! I'm Astra. I test my gear on Earth first.",
    l1t: "What is an analog?",
    l1d: "An analog is a place on Earth that is like a place on the Moon or Mars in some ways: the ground, the rocks, the cold or the light. Teams test rovers, spacesuits and tools there first.",
    l2t: "Four questions for every place",
    l2: ["Ground shape: how steep, and how bumpy?", "Rocks and craters: volcanic rock, craters, bare stone?", "Cold and light: how cold, and how high does the Sun climb?", "Ice and loose ground: rain, plants, snow, and what you could dig"],
    l3t: "Your turn: which place is more alike?",
    l3d: "Tap the place you think is more like the target. Real NASA data gives the answer.",
    round: "Round",
    target: "Target",
    job: "Job",
    which: "Which place is more alike?",
    right: "Correct!",
    wrong: "Not this time.",
    next: "Next round",
    finish: "See my score",
    got: "You got",
    of: "of",
    again: "Play again",
    best: "best at",
    loading: "Loading NASA data…",
    l4t: "What Earth can't copy",
    l4d: "Some things are the same everywhere on Earth. Gravity here is 6 times stronger than on the Moon and 2.6 times stronger than on Mars. We have air to breathe, and a magnetic field that blocks space radiation. Analogs can't change that.",
    gaps: ["Gravity", "Air", "Space radiation"],
    print: "Print a worksheet",
    wsTitle: "Worksheet: Earth analogs for the Moon and Mars",
    wsName: "Name",
    wsClass: "Class",
    ws: [
      "In your own words, what is an analog site?",
      "Write two places on Earth that are like Mars. What makes each one alike?",
      "You are driving a rover. Which of the four questions matters most? Why?",
      "Name three things Earth can't copy.",
      "Open shadowastra-atlas.vercel.app, choose “Find new sites”, and find the best new place near Dhaka to practise living at a Moon base. Write its name and score.",
    ],
    cta: "Find a place near you",
    review: "",
  },
  bn: {
    kicker: "শ্রেণিকক্ষ",
    h1a: "পৃথিবীতে অনুশীলন।",
    h1b: "তারপর যাত্রা।",
    intro: "চাঁদ বা মঙ্গলে বসবাসের আগে মানুষ এখানেই অনুশীলন করে, পৃথিবীর এমন সব জায়গায় যেগুলো অনেকটা ওদের মতো। এই জায়গাগুলোকে বলে অ্যানালগ। চলো দেখি, আমরা কীভাবে এগুলো বাছাই করি।",
    astra: "হাই! আমি অ্যাস্ট্রা। আমি আগে পৃথিবীতে আমার যন্ত্রপাতি পরীক্ষা করি।",
    l1t: "অ্যানালগ কী?",
    l1d: "অ্যানালগ হলো পৃথিবীর এমন একটি জায়গা, যা কিছু দিক দিয়ে চাঁদ বা মঙ্গলের কোনো জায়গার মতো: মাটি, পাথর, ঠান্ডা বা আলো। বিজ্ঞানীরা সেখানে আগে রোভার, স্পেসস্যুট আর যন্ত্রপাতি পরীক্ষা করেন।",
    l2t: "প্রতিটি জায়গার জন্য চারটি প্রশ্ন",
    l2: ["মাটির গঠন: কতটা ঢালু, আর কতটা উঁচু-নিচু?", "পাথর ও গর্ত: আগ্নেয় শিলা, উল্কার গর্ত, খোলা পাথর আছে কি?", "ঠান্ডা ও আলো: কতটা ঠান্ডা, আর সূর্য কত উঁচুতে ওঠে?", "বরফ ও আলগা মাটি: বৃষ্টি, গাছপালা, তুষার, আর কী খুঁড়ে পাওয়া যায়"],
    l3t: "এবার তোমার পালা: কোন জায়গাটা বেশি মেলে?",
    l3d: "যে জায়গাটা লক্ষ্যের সঙ্গে বেশি মেলে বলে মনে হয়, সেটিতে চাপ দাও। নাসার আসল তথ্য উত্তর দেবে।",
    round: "রাউন্ড",
    target: "লক্ষ্য",
    job: "কাজ",
    which: "কোন জায়গাটা বেশি মেলে?",
    right: "ঠিক উত্তর!",
    wrong: "এবার হলো না।",
    next: "পরের রাউন্ড",
    finish: "আমার স্কোর দেখো",
    got: "তুমি পেয়েছ",
    of: "এর মধ্যে",
    again: "আবার খেলো",
    best: "সবচেয়ে ভালো",
    loading: "নাসার তথ্য আসছে…",
    l4t: "পৃথিবী যা নকল করতে পারে না",
    l4d: "কিছু জিনিস পৃথিবীর সব জায়গায় একই রকম। এখানে মাধ্যাকর্ষণ চাঁদের চেয়ে ৬ গুণ আর মঙ্গলের চেয়ে ২.৬ গুণ বেশি। আমাদের শ্বাস নেওয়ার বাতাস আছে, আর আছে চৌম্বক ক্ষেত্র, যা মহাকাশের বিকিরণ আটকায়। অ্যানালগ জায়গা এগুলো বদলাতে পারে না।",
    gaps: ["মাধ্যাকর্ষণ", "বাতাস", "মহাকাশের বিকিরণ"],
    print: "ওয়ার্কশিট প্রিন্ট করো",
    wsTitle: "ওয়ার্কশিট: চাঁদ ও মঙ্গলের জন্য পৃথিবীর অ্যানালগ",
    wsName: "নাম",
    wsClass: "শ্রেণি",
    ws: [
      "নিজের ভাষায় লেখো, অ্যানালগ জায়গা কী?",
      "মঙ্গলের মতো পৃথিবীর দুটি জায়গার নাম লেখো। প্রতিটি কোন দিক দিয়ে মেলে?",
      "তুমি একটি রোভার চালাচ্ছ। চারটি প্রশ্নের মধ্যে কোনটা সবচেয়ে জরুরি? কেন?",
      "পৃথিবী নকল করতে পারে না, এমন তিনটি জিনিসের নাম লেখো।",
      "shadowastra-atlas.vercel.app খোলো, “Find new sites” বেছে নাও, আর ঢাকার কাছে চাঁদের ঘাঁটিতে থাকার অনুশীলনের জন্য সবচেয়ে ভালো নতুন জায়গাটি খুঁজে বের করো। জায়গার নাম আর স্কোর লেখো।",
    ],
    cta: "তোমার কাছের জায়গা খোঁজো",
    review: "",
  },
} as const;

const FACTOR_BN: Record<string, string> = { ground: "মাটির গঠন", rocks: "পাথর ও গর্ত", climate: "ঠান্ডা ও আলো", resources: "বরফ ও আলগা মাটি" };
const JOB: Record<string, { en: string; bn: string }> = {
  astrobio: { en: "Look for signs of life", bn: "জীবনের চিহ্ন খোঁজা" },
  base: { en: "Live and work at a base", bn: "ঘাঁটিতে থাকা ও কাজ করা" },
  caves: { en: "Explore lava tubes", bn: "লাভা সুড়ঙ্গ অনুসন্ধান" },
  traverse: { en: "Drive a rover", bn: "রোভার চালানো" },
  ice: { en: "Find and drill ice", bn: "বরফ খুঁজে খোঁড়া" },
};

interface Place {
  en: string;
  bn: string;
  lat: number;
  lon: number;
}
const ROUNDS: { target: string; task: TaskId; tbn: string; a: Place; b: Place }[] = [
  { target: "jezero", task: "astrobio", tbn: "জেজেরো খাদ, মঙ্গল", a: { en: "Atacama Desert, Chile", bn: "আতাকামা মরুভূমি, চিলি", lat: -24.08, lon: -70.0 }, b: { en: "Sundarbans, Bangladesh", bn: "সুন্দরবন, বাংলাদেশ", lat: 21.95, lon: 89.18 } },
  { target: "shackleton", task: "base", tbn: "শ্যাকলটন খাদের কিনারা, চাঁদ", a: { en: "Dhaka, Bangladesh", bn: "ঢাকা, বাংলাদেশ", lat: 23.81, lon: 90.41 }, b: { en: "Dry Valleys, Antarctica", bn: "ড্রাই ভ্যালিস, অ্যান্টার্কটিকা", lat: -77.5, lon: 161.8 } },
  { target: "marius-pit", task: "caves", tbn: "মারিয়াস পাহাড়ের গর্ত, চাঁদ", a: { en: "Lanzarote, Spain", bn: "লানজারোটে, স্পেন", lat: 29.16, lon: -13.43 }, b: { en: "Bandarban hills, Bangladesh", bn: "বান্দরবানের পাহাড়, বাংলাদেশ", lat: 22.0, lon: 92.3 } },
  { target: "gale", task: "traverse", tbn: "গেল খাদ, মঙ্গল", a: { en: "Amazon rainforest, Brazil", bn: "আমাজন বন, ব্রাজিল", lat: -3.4, lon: -62.2 }, b: { en: "Death Valley, USA", bn: "ডেথ ভ্যালি, যুক্তরাষ্ট্র", lat: 36.25, lon: -116.83 } },
  { target: "arcadia", task: "ice", tbn: "আর্কেডিয়া সমভূমি, মঙ্গল", a: { en: "Svalbard, Norway", bn: "স্ভালবার্ড, নরওয়ে", lat: 79.4, lon: 13.3 }, b: { en: "Cox's Bazar, Bangladesh", bn: "কক্সবাজার, বাংলাদেশ", lat: 21.43, lon: 92.0 } },
];

function score(grid: Grid, p: Place, target: string, task: TaskId) {
  const k = grid.cellAt(p.lat, p.lon, 4);
  const t = grid.targets[target];
  if (k < 0 || !t) return null;
  const cs = scoreCell(grid, k, { target: t, task, modelMix: MODEL_MIX });
  const best = FACTORS.map((f) => ({ f, v: f.dims.reduce((a, d) => a + cs.dims[d as keyof typeof cs.dims], 0) / f.dims.length })).sort((x, y) => y.v - x.v)[0];
  return { total: cs.total, best: best.f };
}

export default function Learn() {
  useSmoothScroll();
  const [params, setParams] = useSearchParams();
  const [lang, setLang] = useState<Lang>(() => {
    if (params.get("lang") === "bn" || params.get("lang") === "en") return params.get("lang") as Lang;
    try {
      return localStorage.getItem("sa-lang") === "bn" ? "bn" : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("sa-lang", lang);
    } catch {
      /* private mode */
    }
    setParams(lang === "bn" ? { lang: "bn" } : {}, { replace: true, preventScrollReset: true });
    document.title = lang === "bn" ? "শিখি · ShadowAstra Atlas" : "Learn · ShadowAstra Atlas";
  }, [lang, setParams]);
  const t = T[lang];
  const bn = lang === "bn";
  return (
    <div className={clsx("bg-void", bn && "font-bn")} lang={bn ? "bn" : "en"}>
      <style>{`@media print { .no-print { display: none !important } .print-only { display: block !important } body::before { display: none } } .print-only { display: none }`}</style>
      <div className="no-print">
        <Nav />
        <section data-theme="dark" className="relative overflow-hidden bg-void px-4 pt-24 pb-20 text-platinum sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_80%_20%,rgba(224,138,95,0.12),transparent_70%),radial-gradient(45%_50%_at_10%_80%,rgba(143,180,234,0.10),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] text-chrome uppercase">
                  <span className="h-px w-8 bg-chrome/50" /> {t.kicker}
                </motion.div>
                <LangSwitch lang={lang} setLang={setLang} />
              </div>
              <AnimatePresence mode="wait">
                <motion.h1 key={lang} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.6, ease: EASE }} className={clsx("mt-7 font-medium", bn ? "text-[clamp(38px,6vw,76px)] leading-[1.15]" : "text-[clamp(44px,7vw,100px)] leading-[0.95] tracking-[-0.05em]")}>
                  {t.h1a}
                  <br />
                  <span className={clsx("text-flare", !bn && "font-serif font-normal tracking-[-0.02em] italic")}>{t.h1b}</span>
                </motion.h1>
              </AnimatePresence>
              <p className={clsx("mt-7 max-w-[600px] text-chrome", bn ? "text-[18px] leading-[1.8]" : "text-[17px] leading-relaxed")}>{t.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Magnetic>
                  <a href="#quiz" className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium">
                    {t.l3t.split(":")[0]} <ArrowRight size={15} />
                  </a>
                </Magnetic>
                <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-line-2 px-6 py-3.5 text-[14px] text-platinum hover:border-chrome">
                  <Printer size={15} /> {t.print}
                </button>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <Astronaut size={190} mood="happy" action="wave" say={t.astra} sayAlign="left" />
            </div>
          </div>
        </section>

        <section className="border-t border-line px-4 py-24 sm:px-6">
          <div className="mx-auto grid max-w-[1200px] gap-4 md:grid-cols-2">
            <LessonCard n="01" title={t.l1t} bn={bn}>
              <p>{t.l1d}</p>
            </LessonCard>
            <LessonCard n="02" title={t.l2t} bn={bn}>
              <ul className="space-y-3">
                {t.l2.map((line, i) => {
                  const Icon = [Mountain, Flame, Sun, Snowflake][i];
                  return (
                    <motion.li key={line} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.5, ease: EASE }} className="flex gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line-2 text-flare">
                        <Icon size={15} />
                      </span>
                      <span>{line}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </LessonCard>
          </div>
        </section>

        <Quiz lang={lang} />

        <section className="border-t border-line px-4 py-24 sm:px-6">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <Kicker n="04">{t.l4t}</Kicker>
              <p className={clsx("mt-6 max-w-[720px] text-platinum", bn ? "text-[19px] leading-[1.8]" : "text-[20px] leading-relaxed")}>{t.l4d}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {t.gaps.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1.5 rounded-full border border-weak/40 bg-weak/10 px-3 py-1.5 text-[13px] text-weak">
                    <X size={13} /> {g}
                  </span>
                ))}
              </div>
            </div>
            <Astronaut size={120} mood="sad" action="slump" />
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-line px-4 py-24 text-center sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_120%,rgba(242,200,121,0.14),transparent_70%)]" />
          <div className="relative mx-auto flex max-w-[900px] flex-col items-center">
            <div className="flex flex-wrap justify-center gap-3">
              <Magnetic>
                <Link to="/discover?step=start" className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-medium">
                  {t.cta} <ArrowRight size={16} />
                </Link>
              </Magnetic>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-4 text-[15px] text-platinum hover:border-chrome">
                <Printer size={16} /> {t.print}
              </button>
            </div>
          </div>
        </section>
        <Footer />
      </div>

      <Worksheet lang={lang} />
    </div>
  );
}

function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line-2 bg-void/60 p-1 backdrop-blur" role="group" aria-label="Language">
      <Languages size={14} className="mx-1.5 text-dim" />
      {(["en", "bn"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={clsx("relative rounded-full px-3 py-1 text-[12.5px] transition-colors", lang === l ? "text-void" : "text-chrome hover:text-platinum")}>
          {lang === l && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-full bg-platinum" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className={clsx("relative", l === "bn" && "font-bn")}>{l === "en" ? "English" : "বাংলা"}</span>
        </button>
      ))}
    </div>
  );
}

function LessonCard({ n, title, children, bn }: { n: string; title: string; children: React.ReactNode; bn: boolean }) {
  return (
    <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, ease: EASE }} className="surface rounded-3xl p-7">
      <div className="font-mono text-[12px] text-flare">{n}</div>
      <h2 className={clsx("mt-2 font-medium text-platinum", bn ? "text-[26px] leading-snug" : "text-[28px] leading-tight tracking-[-0.03em]")}>{title}</h2>
      <div className={clsx("mt-4 text-chrome", bn ? "text-[17px] leading-[1.8]" : "text-[16px] leading-relaxed")}>{children}</div>
    </motion.article>
  );
}

function Quiz({ lang }: { lang: Lang }) {
  const { grid, progress } = useGrid();
  const t = T[lang];
  const bn = lang === "bn";
  const [round, setRound] = useState(0);
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);
  const R = ROUNDS[round];
  const scores = useMemo(() => (grid ? { a: score(grid, R.a, R.target, R.task), b: score(grid, R.b, R.target, R.task) } : null), [grid, R]);
  const win = scores && scores.a && scores.b ? (scores.a.total >= scores.b.total ? "a" : "b") : null;
  const choose = (side: "a" | "b") => {
    if (pick || !win) return;
    setPick(side);
    if (side === win) setPoints((p) => p + 1);
  };
  const next = () => {
    if (round + 1 >= ROUNDS.length) setDone(true);
    else {
      setRound((r) => r + 1);
      setPick(null);
    }
  };
  const restart = () => {
    setRound(0);
    setPick(null);
    setPoints(0);
    setDone(false);
  };
  const target = TARGET_BY_ID[R.target];
  return (
    <section id="quiz" data-theme="dark" className="scroll-mt-20 border-t border-line bg-ink px-4 py-24 text-platinum sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <Kicker n="03">{t.l3t}</Kicker>
        <p className={clsx("mt-5 max-w-[640px] text-chrome", bn ? "text-[17px] leading-[1.8]" : "text-[16px] leading-relaxed")}>{t.l3d}</p>
        {!grid ? (
          <div className="mt-10 text-[13px] text-dim">
            {t.loading} {num(String(Math.round(progress * 100)), lang)}%
          </div>
        ) : done ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 flex flex-col items-center gap-5 rounded-3xl border border-line bg-panel p-10 text-center">
            <Astronaut size={130} mood={points >= 4 ? "happy" : "thinking"} action={points >= 4 ? "celebrate" : "idle"} />
            <div className={clsx("text-[40px] font-medium", !bn && "tracking-[-0.03em]")}>
              {t.got} {num(String(points), lang)} {bn ? `(${num(String(ROUNDS.length), lang)} ${t.of})` : `${t.of} ${ROUNDS.length}`}
            </div>
            <button onClick={restart} className="inline-flex items-center gap-2 rounded-full border border-line-2 px-5 py-3 text-[14px] hover:border-chrome">
              <RotateCcw size={15} /> {t.again}
            </button>
          </motion.div>
        ) : (
          <div className="mt-10">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-1.5">
                {ROUNDS.map((_, i) => (
                  <span key={i} className={clsx("h-1.5 w-8 rounded-full", i < round ? "bg-flare" : i === round ? "bg-platinum" : "bg-line-2")} />
                ))}
              </div>
              <span className="font-mono text-[12px] text-dim">
                {t.round} {num(String(round + 1), lang)} / {num(String(ROUNDS.length), lang)}
              </span>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[0.8fr_1.6fr]">
              <AnimatePresence mode="wait">
                <motion.div key={R.target} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="surface overflow-hidden rounded-3xl">
                  <TargetImage t={target} className="h-48 w-full" span={18} />
                  <div className="p-5">
                    <div className="text-[11px] tracking-[0.2em] text-dim uppercase">{t.target}</div>
                    <div className="mt-1 text-[22px] font-medium">{bn ? R.tbn : `${target.name}, ${target.body === "moon" ? "Moon" : "Mars"}`}</div>
                    <div className="mt-3 text-[11px] tracking-[0.2em] text-dim uppercase">{t.job}</div>
                    <div className="mt-1 text-[15px] text-chrome">{JOB[R.task][lang]}</div>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div>
                <div className={clsx("text-[18px]", bn && "leading-[1.7]")}>{t.which}</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(["a", "b"] as const).map((side) => (
                    <Choice key={`${round}-${side}`} place={R[side]} lang={lang} onPick={() => choose(side)} state={!pick ? "idle" : side === win ? "win" : side === pick ? "wrong" : "lose"} result={pick ? scores?.[side] ?? null : null} />
                  ))}
                </div>
                <AnimatePresence>
                  {pick && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Astronaut size={64} mood={pick === win ? "happy" : "thinking"} action={pick === win ? "celebrate" : "idle"} />
                        <span className="text-[17px]">{pick === win ? t.right : t.wrong}</span>
                      </div>
                      <button onClick={next} className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium">
                        {round + 1 >= ROUNDS.length ? t.finish : t.next} <ArrowRight size={15} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Choice({ place, lang, onPick, state, result }: { place: Place; lang: Lang; onPick: () => void; state: "idle" | "win" | "lose" | "wrong"; result: { total: number; best: (typeof FACTORS)[number] } | null }) {
  const thumb = useEarthThumb(place.lat, place.lon, 360);
  const t = T[lang];
  return (
    <motion.button
      whileHover={state === "idle" ? { y: -4 } : undefined}
      whileTap={state === "idle" ? { scale: 0.98 } : undefined}
      onClick={onPick}
      disabled={state !== "idle"}
      className={clsx(
        "group relative overflow-hidden rounded-3xl border text-left transition-colors",
        state === "idle" && "border-line hover:border-flare/50",
        state === "win" && "border-strong/70",
        state === "wrong" && "border-weak/70",
        state === "lose" && "border-line opacity-70",
      )}
    >
      <div className="relative aspect-[4/3] bg-panel">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="shimmer h-full w-full" />}
        <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/10 to-transparent" />
        {state === "win" && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-strong text-void">
            <Check size={18} />
          </motion.span>
        )}
        {state === "wrong" && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-weak text-void">
            <X size={18} />
          </motion.span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-[17px] font-medium text-white">{place[lang]}</div>
          {result && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1 flex items-center justify-between gap-2 text-[13px] text-white/80">
              <span>
                {t.best}: {lang === "bn" ? FACTOR_BN[result.best.id] : result.best.label.toLowerCase()}
              </span>
              <span className="font-mono text-[18px] text-white">{num(result.total.toFixed(2), lang)}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function Worksheet({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <div className="print-only bg-white p-10 text-[#1c1a16]">
      <div className="flex items-start justify-between border-b border-[#dcd5c7] pb-4">
        <div>
          <div className="text-[11px] tracking-[0.2em] text-[#888275] uppercase">ShadowAstra Atlas</div>
          <h1 className="mt-1 text-[24px] font-medium">{t.wsTitle}</h1>
        </div>
        <div className="text-[13px] leading-8">
          {t.wsName}: ______________________
          <br />
          {t.wsClass}: ____________
        </div>
      </div>
      <ol className="mt-6 space-y-8 text-[15px]">
        {t.ws.map((q, i) => (
          <li key={q}>
            <div>
              {num(String(i + 1), lang)}. {q}
            </div>
            <div className="mt-3 h-16 border-b border-dashed border-[#c9c0ae]" />
          </li>
        ))}
      </ol>
      <div className="mt-8 text-[11px] text-[#888275]">shadowastra-atlas.vercel.app · NASA Space Apps Challenge 2026 · Team ShadowAstra, Dhaka</div>
    </div>
  );
}
