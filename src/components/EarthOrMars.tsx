import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Check, Eye, RotateCcw, X } from "lucide-react";
import { Astronaut, type Reaction } from "./ui/Astronaut";
import { Chip, EASE } from "./ui/kit";
import { EARTH_SITES, TARGET_BY_ID, type EarthSite, type TargetSite } from "../data/sites";
import { earthVisible, IMAGERY, sampleImagery } from "../lib/terrain";
import { logBadge } from "../lib/fieldlog";

interface Round {
  earth: EarthSite;
  target: TargetSite;
  earthLeft: boolean;
}
interface Loaded extends Round {
  e: string;
  t: string;
}

const FOOT_KM = 60;

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function makeRounds(): Round[] {
  const all: Round[] = [];
  for (const e of EARTH_SITES)
    for (const id of e.pairs) {
      const t = TARGET_BY_ID[id];
      if (t && Math.abs(t.lat) < 80) all.push({ earth: e, target: t, earthLeft: Math.random() < 0.5 });
    }
  return shuffle(all);
}

async function load(r: Round): Promise<Loaded> {
  // Earth imagery is much sharper, so we sample it coarser to keep the game fair.
  const [e, t] = await Promise.all([
    sampleImagery(earthVisible(r.earth.lat), r.earth.lat, r.earth.lon, FOOT_KM, r.target.body === "mars" ? 150 : 240),
    sampleImagery(IMAGERY[r.target.body].visible, r.target.lat, r.target.lon, FOOT_KM, 300),
  ]);
  return { ...r, e: e.toDataURL("image/jpeg", 0.85), t: t.toDataURL("image/jpeg", 0.85) };
}

/** "Earth or Mars?" Two real images at the same scale, colour off. Spot the other world. */
export function EarthOrMars() {
  const rounds = useMemo(makeRounds, []);
  const [i, setI] = useState(0);
  const [cur, setCur] = useState<Loaded | null>(null);
  const next = useRef<Promise<Loaded> | null>(null);
  const [picked, setPicked] = useState<"left" | "right" | null>(null);
  const [colour, setColour] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [played, setPlayed] = useState(0);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  const begin = useCallback(
    (k: number) => {
      setCur(null);
      setPicked(null);
      setColour(false);
      setFailed(false);
      const r = rounds[k % rounds.length];
      const p = next.current ?? load(r);
      next.current = null;
      p.then((l) => {
        setCur(l);
        next.current = load(rounds[(k + 1) % rounds.length]);
        next.current.catch(() => (next.current = null));
      }).catch(() => setFailed(true));
    },
    [rounds],
  );

  // Start loading only when the game scrolls near the view.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting && !started.current) {
          started.current = true;
          begin(0);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [begin]);

  const world = cur?.target.body === "moon" ? "the Moon" : "Mars";
  const answer = cur ? (cur.earthLeft ? "right" : "left") : null;
  const pick = (side: "left" | "right") => {
    if (!cur || picked) return;
    setPicked(side);
    setPlayed((n) => n + 1);
    if (side === answer) {
      const pts = colour ? 1 : 2;
      setScore((s) => {
        if (s + pts >= 10) logBadge("game10");
        return s + pts;
      });
      setStreak((s) => {
        if (s + 1 >= 3) logBadge("game3");
        return s + 1;
      });
    } else setStreak(0);
  };

  const react: Reaction = !cur
    ? { mood: "focused", action: "scan", say: failed ? "The image server is slow. Try the next pair." : "Fetching two real images from orbit…" }
    : !picked
      ? { mood: "thinking", action: "binoculars", say: `Which one is ${world}? Colour is off, so look at the shapes.` }
      : picked === answer
        ? { mood: "happy", action: "celebrate", say: streak >= 3 ? `${streak} in a row! You have a geologist's eye.` : `Yes! That one is ${cur.target.name}.` }
        : { mood: "wow", action: "point", say: `Tricky! That was ${cur.earth.name.split(",")[0]} on Earth. They really look alike.` };

  const tiles: { side: "left" | "right"; src: string; isEarth: boolean }[] = cur
    ? [
        { side: "left", src: cur.earthLeft ? cur.e : cur.t, isEarth: cur.earthLeft },
        { side: "right", src: cur.earthLeft ? cur.t : cur.e, isEarth: !cur.earthLeft },
      ]
    : [];

  return (
    <div ref={box} className="grid items-center gap-10 lg:grid-cols-[1fr_300px]">
      <div className="surface rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[15px] text-platinum">
            Which one is <span className={cur?.target.body === "moon" ? "text-moon" : "text-mars"}>{cur ? world : "…"}</span>?
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="flare">Score {score}</Chip>
            <Chip>Streak {streak}</Chip>
            <Chip>{played} played</Chip>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
          {(tiles.length ? tiles : [null, null]).map((t, k) => (
            <button
              key={k}
              disabled={!t || !!picked}
              onClick={() => t && pick(t.side)}
              className={clsx(
                "group relative aspect-square overflow-hidden rounded-2xl border-2 bg-ink transition-colors",
                !t && "shimmer border-line",
                t && !picked && "border-line hover:border-flare/70",
                t && picked && (t.side === answer ? "border-strong" : t.side === picked ? "border-weak" : "border-line"),
              )}
              aria-label={t ? `Image ${k + 1}` : "Loading image"}
            >
              {t && (
                <motion.img
                  key={t.src.slice(-40)}
                  src={t.src}
                  alt=""
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="size-full object-cover transition-[filter] duration-700"
                  style={{ filter: colour || picked ? "none" : "grayscale(1) contrast(1.15)" }}
                  draggable={false}
                />
              )}
              <AnimatePresence>
                {t && picked && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="absolute inset-x-2 bottom-2 rounded-xl bg-void/85 px-3 py-2 text-left backdrop-blur">
                    <div className="flex items-center gap-1.5 text-[12.5px] text-platinum">
                      {t.side === answer ? <Check size={13} className="text-strong" /> : null}
                      {t.isEarth ? cur!.earth.name.split(",")[0] : cur!.target.name}
                    </div>
                    <div className="text-[10.5px] text-dim">{t.isEarth ? `Earth · ${cur!.earth.country}` : `${cur!.target.body === "moon" ? "Moon" : "Mars"} · ${cur!.target.region}`}</div>
                  </motion.div>
                )}
              </AnimatePresence>
              {t && !picked && <span className="absolute top-2 left-2 rounded-full bg-void/70 px-2 py-0.5 font-mono text-[10px] text-platinum">{k === 0 ? "A" : "B"}</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <span className="text-dim">Both images: {FOOT_KM} × {FOOT_KM} km, north up, real NASA and ESA imagery.</span>
          <div className="flex items-center gap-2">
            {!picked && cur && !colour && (
              <button onClick={() => setColour(true)} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-chrome hover:text-platinum">
                <Eye size={13} /> Show colour (1 point)
              </button>
            )}
            {(picked || failed) && (
              <button onClick={() => (setI((n) => n + 1), begin(i + 1))} className="btn-primary flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium">
                Next pair <ArrowRight size={13} />
              </button>
            )}
            {picked && (
              <Link to={`/lab?earth=${cur!.earth.id}&target=${cur!.target.id}`} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-chrome hover:text-platinum">
                Compare in 3D
              </Link>
            )}
            {played > 0 && !picked && (
              <button
                onClick={() => {
                  setScore(0);
                  setStreak(0);
                  setPlayed(0);
                }}
                aria-label="Reset score"
                className="p-1.5 text-dim hover:text-platinum"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center text-center">
        <Astronaut size={170} mood={react.mood} action={react.action} />
        <AnimatePresence mode="wait">
          <motion.p key={react.say} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }} className="mt-4 max-w-[280px] text-[15px] leading-snug text-platinum">
            {react.say}
          </motion.p>
        </AnimatePresence>
        {picked && picked !== answer && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-dim">
            <X size={12} className="text-weak" /> That is why teams train there.
          </p>
        )}
      </div>
    </div>
  );
}
