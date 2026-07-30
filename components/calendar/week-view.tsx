"use client";

import { CalendarDays, Sparkles } from "lucide-react";
import { useCallback, useMemo } from "react";

import { layoutOverlaps } from "@/lib/calendar-layout";
import { blockSurface, safeColor, readableInk, withAlpha } from "@/lib/colors";
import { emit } from "@/lib/events";
import { useBlocks } from "@/lib/hooks/use-blocks";
import { useGoogleCalendars, useGoogleEvents } from "@/lib/hooks/use-google";
import { useProjects } from "@/lib/hooks/use-projects";
import { useSettings } from "@/lib/hooks/use-settings";
import { useTasks } from "@/lib/hooks/use-tasks";
import {
  fmtDayLetter,
  fmtDayNumber,
  fmtDuration,
  fmtMin,
  todayISO,
  weekDaysISO,
  type DayISO,
} from "@/lib/time";
import { isScheduled, type GoogleEvent, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Altezza di un'ora nella vista settimana: più compatta di quella del giorno. */
const HOUR = 34;

/**
 * La settimana.
 *
 * Non è la vista del giorno moltiplicata per sette: qui i blocchi non si
 * trascinano e non si ridimensionano. Serve a **vedere la forma della
 * settimana** — dove si accumula, dove c'è aria — e per farlo deve stare in
 * uno schermo. Toccare un giorno riporta alla vista del giorno, che è dove
 * si lavora.
 */
export function WeekView({
  day,
  onSelectDay,
  onOpenTask,
}: {
  day: DayISO;
  onSelectDay: (day: DayISO) => void;
  onOpenTask: (task: Task) => void;
}) {
  const today = todayISO();
  const week = useMemo(() => weekDaysISO(day), [day]);

  const { settings } = useSettings();
  const { byDay } = useTasks();
  const { byId: projectsById } = useProjects();
  const { forDay } = useBlocks();
  const { byDay: googleByDay } = useGoogleEvents();
  const { byId: calendarsById } = useGoogleCalendars();

  // La finestra si allarga quanto basta a contenere ciò che esce dagli orari
  // di lavoro: un blocco alle 7 del mattino non deve finire fuori griglia.
  const bounds = useMemo(() => {
    let start = settings.work_start;
    let end = settings.work_end;

    for (const one of week) {
      for (const task of (byDay.get(one) ?? []).filter(isScheduled)) {
        start = Math.min(start, task.start_minute);
        end = Math.max(end, task.start_minute + task.est_minutes);
      }
      for (const block of forDay(one)) {
        start = Math.min(start, block.start_minute);
        end = Math.max(end, block.end_minute);
      }
      for (const event of googleByDay.get(one) ?? []) {
        if (event.all_day) continue;
        start = Math.min(start, event.start_minute);
        end = Math.max(end, event.end_minute);
      }
    }

    return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 };
  }, [byDay, forDay, googleByDay, settings, week]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = bounds.start; m < bounds.end; m += 60) list.push(m);
    return list;
  }, [bounds]);

  /**
   * Task ed eventi Google di un giorno, con le colonne già assegnate.
   *
   * Sono la stessa funzione della vista giorno: due riunioni sovrapposte si
   * dividono la colonna invece di nascondersi a vicenda, e in una vista
   * larga un settimo di schermo nascondersi significherebbe sparire.
   */
  const layout = useCallback(
    (one: DayISO) =>
      layoutOverlaps<Task | GoogleEvent>([
        ...(byDay.get(one) ?? []).filter(isScheduled).map((task) => ({
          item: task as Task,
          start: task.start_minute,
          end: task.start_minute + task.est_minutes,
        })),
        ...(googleByDay.get(one) ?? [])
          .filter((event) => !event.all_day)
          .map((event) => ({
            item: event as GoogleEvent,
            start: event.start_minute,
            end: event.end_minute,
          })),
      ]),
    [byDay, googleByDay],
  );

  // Vuota davvero: né task né eventi Google. Guardare i soli minuti
  // pianificati faceva dichiarare «libera» una settimana piena di riunioni.
  const vuota = useMemo(
    () => week.every((one) => layout(one).length === 0),
    [layout, week],
  );

  const total = week.reduce(
    (sum, one) =>
      sum +
      (byDay.get(one) ?? [])
        .filter(isScheduled)
        .reduce((inner, task) => inner + task.est_minutes, 0),
    0,
  );

  const height = (bounds.end - bounds.start) * (HOUR / 60);

  return (
    <div className="p-3">
      {/*
        La griglia resta anche a settimana vuota: sette colonne di ore vuote
        dicono *dove* c'è spazio, uno stato vuoto a tutta altezza no. Il
        conteggio, per giunta, guardava solo i task: una settimana di sole
        riunioni Google si dichiarava libera.
      */}
      {vuota && (
        <div className="mb-3 flex flex-col gap-2 rounded-flusso-md border border-dashed border-line-strong px-3 py-2.5 sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-soft">
            <CalendarDays className="size-4 shrink-0 text-ink-faint" />
            Sette giorni liberi. È un&apos;occasione o una svista: decidi tu.
          </p>
          <button
            type="button"
            className="btn btn-soft h-10 shrink-0 px-3 text-sm"
            onClick={() => emit("flusso:open-planner", {})}
          >
            <Sparkles className="size-4" />
            Pianifica con AI
          </button>
        </div>
      )}

      <div className="flex gap-1">
        {/* Colonna delle ore */}
        <div className="w-10 shrink-0 pt-8">
          <div className="relative" style={{ height }}>
            {hours.map((minute) => (
              <span
                key={minute}
                className="tnum absolute -translate-y-1/2 text-[11px] text-ink-faint"
                style={{ top: (minute - bounds.start) * (HOUR / 60) }}
              >
                {fmtMin(minute)}
              </span>
            ))}
          </div>
        </div>

        {week.map((one) => {
          const scheduled = (byDay.get(one) ?? []).filter(isScheduled);
          const minutes = scheduled.reduce(
            (sum, task) => sum + task.est_minutes,
            0,
          );

          return (
            <div key={one} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelectDay(one)}
                className={cn(
                  "mb-1 flex h-7 w-full flex-col items-center justify-center gap-px rounded-flusso-sm text-xs leading-none",
                  one === today ? "bg-accent text-accent-ink" : "text-ink-soft",
                  one === day && one !== today && "bg-sunken",
                )}
                aria-label={`Vai al ${one}${minutes > 0 ? `, ${fmtDuration(minutes)} pianificati` : ""}`}
              >
                <span>{fmtDayLetter(one)}</span>
                <span className="tnum font-medium">{fmtDayNumber(one)}</span>
              </button>

              <div
                className="relative rounded-flusso-sm bg-sunken/50"
                style={{ height }}
              >
                {hours.map((minute) => (
                  <div
                    key={minute}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-line/60"
                    style={{ top: (minute - bounds.start) * (HOUR / 60) }}
                  />
                ))}

                {forDay(one).map((block) => (
                  <div
                    key={block.id}
                    aria-hidden="true"
                    className="absolute inset-x-0 rounded-[3px] bg-line-strong/40"
                    style={{
                      top: (block.start_minute - bounds.start) * (HOUR / 60),
                      height: Math.max(
                        3,
                        (block.end_minute - block.start_minute) * (HOUR / 60),
                      ),
                    }}
                  />
                ))}

                {layout(one).map(({ item, start, end, column, columns }) => {
                  const width = `${100 / columns}%`;
                  const offset = `${(100 / columns) * column}%`;
                  const top = (start - bounds.start) * (HOUR / 60);
                  const height = Math.max(8, (end - start) * (HOUR / 60));

                  if ("calendar_id" in item) {
                    const color = safeColor(
                      calendarsById.get(item.calendar_id)?.color,
                    );
                    return (
                      <div
                        key={item.id}
                        title={`${fmtMin(start)} · ${item.title}`}
                        className="absolute overflow-hidden rounded-[3px] border-l-2 px-0.5 text-[10px] leading-tight"
                        style={{
                          top,
                          height,
                          left: offset,
                          width,
                          background: withAlpha(color, 0.18),
                          borderColor: color,
                        }}
                      >
                        <span className="line-clamp-1 text-ink-soft">
                          {item.title}
                        </span>
                      </div>
                    );
                  }

                  const color = item.project_id
                    ? blockSurface(projectsById.get(item.project_id)?.color ?? "")
                    : "var(--line-strong)";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenTask(item)}
                      title={`${fmtMin(start)} · ${item.title}`}
                      className={cn(
                        "absolute overflow-hidden rounded-[3px] px-0.5 text-left text-[10px] leading-tight",
                        item.status === "done" && "opacity-50",
                      )}
                      style={{
                        top,
                        height,
                        left: offset,
                        width,
                        background: color,
                        color: item.project_id ? readableInk(color) : "var(--ink)",
                      }}
                    >
                      <span className="line-clamp-2">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center text-xs text-ink-faint">
        {fmtDuration(total)} pianificati questa settimana
      </p>
    </div>
  );
}
