"use client";

import { Check } from "lucide-react";
import { memo } from "react";

import { safeColor, withAlpha } from "@/lib/colors";
import { fmtMin } from "@/lib/time";
import type { GoogleCalendar, GoogleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Un evento Google sulla griglia.
 *
 * Volutamente **diverso da un blocco task**: sfondo tenue e bordo laterale
 * saturo, invece del colore pieno. Deve leggersi a colpo d'occhio che è
 * qualcosa che *subisci*, non qualcosa che hai deciso — e che trascinarlo qui
 * non serve a niente, perché lo governa Google.
 */
export const GoogleEventBlock = memo(function GoogleEventBlock({
  event,
  calendar,
  top,
  height,
  left,
  width,
  onToggleDone,
}: {
  event: GoogleEvent;
  calendar: GoogleCalendar | undefined;
  top: number;
  height: number;
  left: number;
  width: number;
  onToggleDone: (event: GoogleEvent) => void;
}) {
  const color = safeColor(calendar?.color);

  return (
    <div
      style={{
        top,
        height: Math.max(height, 20),
        left: `${left}%`,
        width: `calc(${width}% - 3px)`,
        // Come per i task: un evento spuntato si smorza nello sfondo, non
        // nel testo, che deve restare leggibile.
        background: withAlpha(color, event.local_done ? 0.07 : 0.14),
        borderLeftColor: color,
      }}
      className={cn(
        "absolute overflow-hidden rounded-flusso-sm border-l-[3px] px-1.5 py-1",
      )}
      title={`${event.title} · ${calendar?.name ?? "Google"}`}
    >
      <p
        className={cn(
          "truncate text-[12px] font-medium leading-tight",
          event.local_done ? "text-ink-soft line-through" : "text-ink",
        )}
      >
        {event.title}
      </p>

      {height > 38 && (
        <p className="tnum mt-0.5 text-[11px] text-ink-soft">
          {fmtMin(event.start_minute)}–{fmtMin(event.end_minute)}
        </p>
      )}

      {/* La spunta è locale e non viene mai scritta su Google: serve a te per
          sapere che quell'evento è archiviato, non a cambiare il calendario. */}
      <button
        type="button"
        onClick={() => onToggleDone(event)}
        aria-label={
          event.local_done
            ? `Riapri «${event.title}»`
            : `Segna «${event.title}» come fatto`
        }
        aria-pressed={event.local_done}
        className={cn(
          "absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border",
          event.local_done
            ? "border-transparent bg-accent text-accent-ink"
            : "border-line bg-surface text-ink-faint",
        )}
      >
        <Check className="size-3" />
      </button>
    </div>
  );
});

/**
 * Gli eventi che durano tutto il giorno, in una striscia sopra la griglia.
 *
 * Non stanno nella griglia di proposito: un compleanno non è un ostacolo alto
 * dodici ore, e disegnarlo così renderebbe illeggibile la giornata sotto.
 */
export function AllDayStrip({
  events,
  calendars,
  onToggleDone,
}: {
  events: GoogleEvent[];
  calendars: Map<string, GoogleCalendar>;
  onToggleDone: (event: GoogleEvent) => void;
}) {
  if (events.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-line pb-2">
      <span className="label shrink-0">Tutto il giorno</span>

      {events.map((event) => {
        const color = safeColor(calendars.get(event.calendar_id)?.color);
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onToggleDone(event)}
            aria-pressed={event.local_done}
            style={{
              // Come per i task: un evento spuntato si smorza nello sfondo, non
        // nel testo, che deve restare leggibile.
        background: withAlpha(color, event.local_done ? 0.07 : 0.14),
              borderLeftColor: color,
            }}
            className={cn(
              "flex min-h-7 items-center rounded-flusso-sm border-l-[3px] px-2 text-xs",
              event.local_done && "text-ink-faint line-through opacity-70",
            )}
          >
            {event.title}
          </button>
        );
      })}
    </div>
  );
}
