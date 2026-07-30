"use client";

import { Check } from "lucide-react";
import { memo } from "react";

import { eventSurface, safeCalendarColor, withAlpha } from "@/lib/colors";
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
  const color = safeCalendarColor(calendar?.color);

  return (
    <div
      style={{
        top,
        height: Math.max(height, 20),
        left: `${left}%`,
        width: `calc(${width}% - 3px)`,
        // Come per i task: un evento spuntato si smorza nello sfondo, non
        // nel testo, che deve restare leggibile.
        background: eventSurface(calendar?.color, event.local_done),
        // Il filetto tutt'intorno chiude la card: senza, su una fascia
        // colorata il bordo dell'evento è solo il punto in cui una tinta
        // finisce e ne comincia un'altra.
        borderColor: withAlpha(color, 0.45),
        borderLeftColor: color,
      }}
      className={cn(
        "absolute overflow-hidden rounded-flusso-sm border border-l-4 px-1.5 py-1",
      )}
      // Come i blocchi task: l'altezza è la durata, quindi i comandi qui
      // dentro ricadono nell'eccezione dichiarata sui bersagli tattili — 24px
      // invece di 44, con l'azione equivalente a dimensione piena altrove.
      data-blocco="google"
      title={`${event.title} · ${calendar?.name ?? "Google"}`}
    >
      <p
        className={cn(
          "truncate text-[13px] font-medium leading-tight",
          event.local_done ? "text-ink-soft line-through" : "text-ink",
        )}
      >
        {event.title}
      </p>

      {height > 38 && (
        <p className="tnum mt-0.5 text-xs text-ink-soft">
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
          "absolute right-1 top-1 flex size-6 items-center justify-center rounded-full border",
          event.local_done
            ? "border-transparent bg-accent text-accent-ink"
            : "border-line bg-surface text-ink-faint",
        )}
      >
        <Check className="size-3.5" />
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
        const color = safeCalendarColor(calendars.get(event.calendar_id)?.color);
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onToggleDone(event)}
            aria-pressed={event.local_done}
            style={{
              background: eventSurface(
                calendars.get(event.calendar_id)?.color,
                event.local_done,
              ),
              borderColor: withAlpha(color, 0.45),
              borderLeftColor: color,
            }}
            className={cn(
              // Bersaglio pieno sul telefono: qui, a differenza dei blocchi
              // orari, l'altezza non rappresenta una durata e non c'è niente
              // da coprire. Da 1080px in su si stringe, come le altre chip.
              "flex min-h-11 items-center rounded-flusso-sm border border-l-4 px-2.5 text-xs app:min-h-8",
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
