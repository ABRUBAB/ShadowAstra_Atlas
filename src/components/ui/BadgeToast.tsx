import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Award } from "lucide-react";
import { Astronaut } from "./Astronaut";
import { BADGES, type BadgeId } from "../../lib/fieldlog";
import { EASE } from "./kit";

/** Astra pops up to hand over a badge. */
export function BadgeToast() {
  const [id, setId] = useState<BadgeId | null>(null);
  useEffect(() => {
    let t = 0;
    const on = (e: Event) => {
      setId((e as CustomEvent<{ id: BadgeId }>).detail.id);
      clearTimeout(t);
      t = window.setTimeout(() => setId(null), 4200);
    };
    window.addEventListener("sa-badge", on);
    return () => {
      window.removeEventListener("sa-badge", on);
      clearTimeout(t);
    };
  }, []);
  const b = BADGES.find((x) => x.id === id);
  return (
    <AnimatePresence>
      {b && (
        <motion.div
          key={b.id}
          role="status"
          initial={{ opacity: 0, x: -30, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="glass fixed bottom-5 left-5 z-[1150] flex items-center gap-3 rounded-2xl py-2 pr-5 pl-2"
        >
          <span className="-my-4">
            <Astronaut size={64} mood="happy" action="celebrate" />
          </span>
          <span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-flare uppercase">
              <Award size={12} /> Badge earned
            </span>
            <span className="block text-[14px] text-platinum">{b.title}</span>
            <span className="block text-[11.5px] text-dim">{b.how}</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
