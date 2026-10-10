import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import type { Fit } from "../../data/sites";
import { FIT_LABEL } from "../../data/sites";

export function Github({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export const REPO_URL = "https://github.com/ABRUBAB/ShadowAstra_Atlas";

export function Logo({ size = 34, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="ShadowAstra Atlas home">
      <img
        src="/brand/shadowastra-logo.jpg"
        alt=""
        width={size}
        height={size}
        className="rounded-full mix-blend-screen transition-transform duration-500 ease-out group-hover:rotate-[20deg]"
        style={{ width: size, height: size }}
      />
      {withWord && (
        <span className="font-wide text-[12px] tracking-[0.18em] text-platinum">
          SHADOWASTRA <span className="text-earth">ATLAS</span>
        </span>
      )}
    </Link>
  );
}

const LINKS = [
  { to: "/atlas", label: "Atlas" },
  { to: "/compare", label: "Compare" },
  { to: "/methods", label: "Data & Method" },
];

export function Nav({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={clsx(
        "z-50 w-full transition-colors duration-300",
        overlay ? "fixed top-0" : "sticky top-0",
        overlay && !scrolled ? "bg-transparent" : "border-b border-line bg-void/80 backdrop-blur-xl",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                clsx(
                  "rounded-full px-4 py-2 text-[13px] transition-colors duration-150",
                  isActive ? "bg-white/[0.07] text-platinum" : "text-chrome hover:text-platinum",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-2 inline-flex items-center gap-2 rounded-full border border-line-2 px-4 py-2 text-[13px] text-chrome transition-colors hover:border-chrome hover:text-platinum"
          >
            <Github size={15} /> Source
          </a>
        </nav>
        <button
          className="rounded-full border border-line-2 p-2 text-chrome md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="border-t border-line bg-void/95 px-4 pb-4 backdrop-blur-xl md:hidden"
          >
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="block border-b border-line py-3 text-sm text-chrome">
                {l.label}
              </Link>
            ))}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="block py-3 text-sm text-chrome">
              Source on GitHub
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-void">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo size={40} />
          <p className="max-w-md text-sm leading-relaxed text-chrome">
            Built by team ShadowAstra in Dhaka, Bangladesh for the 2026 NASA Space Apps Challenge — “Identify Earth
            Locations that Analog the Permanent Moon Base Locations and Mars.”
          </p>
          <p className="max-w-md text-xs leading-relaxed text-dim">
            Prototype for the preliminary round. Imagery: NASA GIBS, NASA Solar System Treks (LRO, MGS, Viking, Mars
            Odyssey). NASA does not endorse this project. Site ratings are a literature-informed prototype, not model output.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="font-mono text-[11px] tracking-widest text-dim uppercase">Explore</div>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="block text-chrome hover:text-platinum">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="space-y-3 text-sm">
          <div className="font-mono text-[11px] tracking-widest text-dim uppercase">Project</div>
          <a href={REPO_URL} className="block text-chrome hover:text-platinum" target="_blank" rel="noreferrer">
            GitHub repository
          </a>
          <a
            href="https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/"
            className="block text-chrome hover:text-platinum"
            target="_blank"
            rel="noreferrer"
          >
            The challenge
          </a>
          <a href="https://earthdata.nasa.gov/gibs" className="block text-chrome hover:text-platinum" target="_blank" rel="noreferrer">
            NASA GIBS
          </a>
          <a href="https://trek.nasa.gov" className="block text-chrome hover:text-platinum" target="_blank" rel="noreferrer">
            NASA Solar System Treks
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-[11px] text-dim sm:px-6">
          <span>© 2026 ShadowAstra · Dhaka</span>
          <span>v0.1 · preliminary-round prototype</span>
        </div>
      </div>
    </footer>
  );
}

const FIT_STYLE: Record<Fit, string> = {
  strong: "text-strong border-strong/40 bg-strong/10",
  partial: "text-partial border-partial/40 bg-partial/10",
  weak: "text-weak border-weak/40 bg-weak/10",
  unknown: "text-chrome border-dashed border-line-2 bg-transparent",
};
const FIT_GLYPH: Record<Fit, string> = { strong: "●", partial: "◐", weak: "○", unknown: "?" };

export function FitBadge({ fit }: { fit: Fit }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", FIT_STYLE[fit])}>
      <span aria-hidden>{FIT_GLYPH[fit]}</span>
      {FIT_LABEL[fit]}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-chrome uppercase", className)}>
      <span className="h-px w-8 bg-chrome/50" />
      {children}
    </div>
  );
}

export const WORLD_COLOR = { earth: "#75bbff", moon: "#d6dbe4", mars: "#e08a5f" } as const;

export function WorldDot({ world, className }: { world: keyof typeof WORLD_COLOR; className?: string }) {
  return (
    <span
      className={clsx("inline-block size-2 rounded-full", className)}
      style={{ background: WORLD_COLOR[world], boxShadow: `0 0 10px ${WORLD_COLOR[world]}` }}
    />
  );
}
