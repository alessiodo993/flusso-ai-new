"use client";

import { fmtClock } from "@/lib/hooks/use-focus-timer";
import { cn } from "@/lib/utils";

const RADIUS = 84;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 200;

/**
 * L'anello del countdown. Si svuota mentre la sessione avanza, così lo stato
 * si legge con la coda dell'occhio senza mettere a fuoco le cifre — che è il
 * punto di un timer per il lavoro profondo.
 */
export function FocusRing({
  progress,
  remainingSeconds,
  paused,
  label,
}: {
  /** Da 0 a 1. */
  progress: number;
  remainingSeconds: number;
  paused: boolean;
  label?: string;
}) {
  const offset = CIRCUMFERENCE * Math.min(1, Math.max(0, progress));

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        // Ruotato di un quarto: il tempo deve partire da mezzogiorno.
        className="-rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth={8}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-300 ease-out",
            paused && "opacity-40",
          )}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tnum font-display text-5xl leading-none"
          role="timer"
          aria-live="off"
        >
          {fmtClock(remainingSeconds)}
        </span>
        {label && (
          <span className="mt-1.5 text-xs text-ink-faint">{label}</span>
        )}
      </div>
    </div>
  );
}
