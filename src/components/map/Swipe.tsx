import { useRef } from "react";
import { WorldDot } from "../ui/Chrome";

/** Two stacked maps; the top one is clipped by a draggable, keyboard-accessible divider. */
export function SwipeStage({
  value,
  onChange,
  left,
  right,
  leftLabel,
  rightLabel,
  rightWorld,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
  rightWorld: "moon" | "mars";
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    onChange(Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width)));
  };
  return (
    <div
      ref={box}
      className={`relative overflow-hidden ${className}`}
      onPointerMove={(e) => drag.current && move(e.clientX)}
      onPointerUp={() => (drag.current = false)}
      onPointerLeave={() => (drag.current = false)}
    >
      <div className="absolute inset-0">{right}</div>
      <div className="absolute inset-0 z-[400]" style={{ clipPath: `inset(0 ${(1 - value) * 100}% 0 0)` }}>
        {left}
      </div>
      <div className="absolute inset-y-0 z-[700] w-px bg-platinum/70" style={{ left: `${value * 100}%` }}>
        <button
          aria-label="Drag to compare Earth and target imagery"
          role="slider"
          aria-valuenow={Math.round(value * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            drag.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => drag.current && move(e.clientX)}
          onPointerUp={() => (drag.current = false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") onChange(Math.max(0.03, value - 0.05));
            if (e.key === "ArrowRight") onChange(Math.min(0.97, value + 0.05));
          }}
          className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-platinum/70 bg-void/85 text-[13px] text-platinum backdrop-blur"
        >
          ⟷
        </button>
      </div>
      <div className="pointer-events-none absolute top-3 left-3 z-[700] flex items-center gap-2 rounded-full bg-void/80 px-3 py-1.5 text-[12px] backdrop-blur">
        <WorldDot world="earth" /> {leftLabel}
      </div>
      <div className="pointer-events-none absolute top-3 right-3 z-[700] flex items-center gap-2 rounded-full bg-void/80 px-3 py-1.5 text-[12px] backdrop-blur">
        <WorldDot world={rightWorld} /> {rightLabel}
      </div>
    </div>
  );
}
