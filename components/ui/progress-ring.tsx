import { cn } from "@/lib/utils";

/**
 * Anello di avanzamento compatto. Il numero al centro perché la percentuale
 * esatta serve, l'anello perché il colpo d'occhio serve di più.
 */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  color,
  className,
  label,
}: {
  /** Da 0 a 1. */
  value: number;
  size?: number;
  stroke?: number;
  /** Colore del progetto; senza, si usa l'accento. */
  color?: string;
  className?: string;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(clamped * 100)}% completato`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color ?? "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>

      <span className="tnum absolute inset-0 flex items-center justify-center text-[11px] font-medium">
        {Math.round(clamped * 100)}
      </span>
    </div>
  );
}
