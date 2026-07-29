"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  addDaysISO,
  fmtDayLetter,
  fmtDayNumber,
  startOfWeekISO,
  todayISO,
  weekDaysISO,
  type DayISO,
} from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * I sette giorni della settimana, sempre visibili sopra la griglia. Cambiare
 * giorno deve costare un tocco, non l'apertura di un calendario.
 */
export function DayStrip({
  day,
  onChange,
  counts,
}: {
  day: DayISO;
  onChange: (day: DayISO) => void;
  /** Quanti blocchi ha ciascun giorno, per il puntino sotto il numero. */
  counts: Map<DayISO, number>;
}) {
  const today = todayISO();
  const week = weekDaysISO(day);
  const monday = startOfWeekISO(day);

  /*
   * Sette giorni da 44px più due frecce da 44 fanno 396: su un telefono da
   * 390 non ci stanno, e stringere i giorni a 43 per far quadrare i conti
   * sarebbe barare. La striscia scorre invece di comprimersi — i giorni
   * restano prendibili col pollice, e la settimana successiva si raggiunge
   * comunque con la freccia.
   */
  return (
    <div className="scroll-quiet flex items-center gap-1 overflow-x-auto px-2 py-2">
      <button
        type="button"
        className="icon-btn shrink-0"
        aria-label="Settimana precedente"
        onClick={() => onChange(addDaysISO(day, -7))}
      >
        <ChevronLeft className="size-[18px]" />
      </button>

      <div className="grid flex-1 grid-cols-7 gap-0.5 app:min-w-0" style={{ minWidth: "20rem" }}>
        {week.map((candidate) => {
          const selected = candidate === day;
          const isToday = candidate === today;
          const count = counts.get(candidate) ?? 0;

          return (
            <button
              key={candidate}
              type="button"
              onClick={() => onChange(candidate)}
              aria-pressed={selected}
              aria-label={candidate}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-flusso-sm py-1.5",
                "transition-colors duration-150 ease-out",
                selected ? "bg-accent text-accent-ink" : "hover:bg-accent-soft",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium uppercase",
                  selected ? "opacity-80" : "text-ink-faint",
                )}
              >
                {fmtDayLetter(candidate)}
              </span>

              <span
                className={cn(
                  "tnum flex size-6 items-center justify-center rounded-full text-sm",
                  !selected && isToday && "bg-accent-soft font-semibold text-accent",
                  selected && "font-semibold",
                )}
              >
                {fmtDayNumber(candidate)}
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  "size-1 rounded-full",
                  count > 0
                    ? selected
                      ? "bg-[var(--accent-ink)] opacity-70"
                      : "bg-accent"
                    : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="icon-btn shrink-0"
        aria-label="Settimana successiva"
        onClick={() => onChange(addDaysISO(day, 7))}
      >
        <ChevronRight className="size-[18px]" />
      </button>

      {monday !== startOfWeekISO(today) && (
        <button
          type="button"
          className="btn btn-ghost h-9 shrink-0 px-2 text-xs"
          onClick={() => onChange(today)}
        >
          Oggi
        </button>
      )}
    </div>
  );
}
