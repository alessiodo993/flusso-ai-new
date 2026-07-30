"use client";

import { useDroppable } from "@dnd-kit/core";
import { useEffect, useState } from "react";

import { GoogleEventBlock } from "@/components/calendar/google-event-block";
import { TaskBlock } from "@/components/calendar/task-block";
import {
  bufferStrips,
  layoutOverlaps,
  pxPerMinute as pxFor,
  visibleWindow,
  type Zoom,
} from "@/lib/calendar-layout";
import { fmtMin, nowMinutes, SLOT, todayISO, type DayISO } from "@/lib/time";
import {
  isScheduled,
  type FixedBlock,
  type GoogleCalendar,
  type GoogleEvent,
  type Project,
  type Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const GUTTER = "3.25rem";

/** Sulla griglia convivono blocchi di Flusso ed eventi Google. */
type Entry =
  | { kind: "task"; task: Task }
  | { kind: "google"; event: GoogleEvent };

/**
 * La griglia di una giornata. Le ore sono righe piene, le mezz'ore tratteggiate
 * e la riga rossa dice dove siamo adesso: le stesse convenzioni di Google
 * Calendar, perché sono quelle che chiunque sa già leggere, ma disegnate con
 * i token di Flusso.
 */
export function DayGrid({
  day,
  zoom,
  tasks,
  fixed,
  googleEvents,
  googleCalendars,
  projectsById,
  bufferMinutes,
  workStart,
  workEnd,
  peakStart,
  peakEnd,
  onOpenTask,
  onToggleDone,
  onStartFocus,
  onMicroStart,
  onResize,
  onToggleGoogleDone,
}: {
  day: DayISO;
  zoom: Zoom;
  tasks: Task[];
  fixed: FixedBlock[];
  googleEvents: GoogleEvent[];
  googleCalendars: Map<string, GoogleCalendar>;
  projectsById: Map<string, Project>;
  bufferMinutes: number;
  workStart: number;
  workEnd: number;
  /** La fascia in cui l'utente rende di più, in minuti dalla mezzanotte. */
  peakStart: number | null;
  peakEnd: number | null;
  onOpenTask: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onStartFocus: (task: Task) => void;
  onMicroStart: (task: Task) => void;
  onResize: (task: Task, estMinutes: number) => void;
  onToggleGoogleDone: (event: GoogleEvent) => void;
}) {
  const px = pxFor(zoom);
  const scheduled = tasks.filter(isScheduled);
  // Gli *all day* non entrano nella griglia: hanno la loro striscia sopra.
  const timedEvents = googleEvents.filter((event) => !event.all_day);

  const taskRanges = scheduled.map((task) => ({
    start: task.start_minute,
    end: task.start_minute + task.est_minutes,
  }));

  // Non si chiama `window`: quel nome è già del browser, e oscurarlo qui
  // renderebbe irraggiungibile `setInterval` più sotto.
  const view = visibleWindow({
    workStart,
    workEnd,
    ranges: [
      ...taskRanges,
      ...fixed.map((block) => ({
        start: block.start_minute,
        end: block.end_minute,
      })),
      ...timedEvents.map((event) => ({
        start: event.start_minute,
        end: event.end_minute,
      })),
    ],
  });
  const height = (view.end - view.start) * px;

  /*
   * Task ed eventi si dispongono **insieme**: un blocco di lavoro e una
   * riunione alla stessa ora devono stare affiancati, non uno sopra l'altro.
   * Calcolarli separatamente li farebbe sovrapporre, nascondendo il primo.
   */
  const placed = layoutOverlaps<Entry>([
    ...scheduled.map((task) => ({
      item: { kind: "task" as const, task },
      start: task.start_minute,
      end: task.start_minute + task.est_minutes,
    })),
    ...timedEvents.map((event) => ({
      item: { kind: "google" as const, event },
      start: event.start_minute,
      end: event.end_minute,
    })),
  ]);

  const buffers = bufferStrips(taskRanges, bufferMinutes);

  const hours: number[] = [];
  for (let m = view.start; m <= view.end; m += 60) hours.push(m);

  // Gli slot su cui si può lasciare qualcosa: sempre da un quarto d'ora,
  // qualunque sia lo zoom, così la precisione del gesto non cambia.
  const slots: number[] = [];
  for (let m = view.start; m < view.end; m += SLOT) slots.push(m);

  return (
    <div className="relative flex">
      <div className="shrink-0" style={{ width: GUTTER }}>
        {hours.map((minute) => (
          <div
            key={minute}
            style={{ top: (minute - view.start) * px }}
            className="tnum absolute -translate-y-1/2 pl-2 text-xs text-ink-faint"
          >
            {fmtMin(minute)}
          </div>
        ))}
      </div>

      <div className="relative flex-1" style={{ height }}>
        {/* Righe: ora piena continua, suddivisioni dello zoom tratteggiate. */}
        {slots.map((minute) => {
          const isHour = minute % 60 === 0;
          const isZoomLine = (minute - view.start) % zoom === 0;
          if (!isHour && !isZoomLine) return null;
          return (
            <div
              key={`line-${minute}`}
              aria-hidden="true"
              style={{ top: (minute - view.start) * px }}
              className={cn(
                "absolute inset-x-0 border-t",
                isHour ? "border-line" : "border-dashed border-line/60",
              )}
            />
          );
        })}

        {/*
          La fascia di picco: lo sfondo appena più caldo, come le ore
          lavorative in Google Calendar. È un'informazione che serve **mentre**
          si trascina — «questo pezzo di giornata rende più degli altri» — e per
          questo va nel calendario e non in una spiegazione altrove. Sta sotto
          tutto il resto e non intercetta il puntatore: non deve mai rubare un
          drop al blocco che copre.
        */}
        {peakStart !== null &&
          peakEnd !== null &&
          peakEnd > view.start &&
          peakStart < view.end && (
            <div
              aria-hidden="true"
              style={{
                top: (Math.max(peakStart, view.start) - view.start) * px,
                height:
                  (Math.min(peakEnd, view.end) - Math.max(peakStart, view.start)) *
                  px,
              }}
              className="pointer-events-none absolute inset-x-0 bg-accent-soft"
            />
          )}

        {/* Fuori orario di lavoro: sfondo più cupo, senza scritte. */}
        {view.start < workStart && (
          <div
            aria-hidden="true"
            style={{ top: 0, height: (workStart - view.start) * px }}
            className="absolute inset-x-0 bg-sunken/60"
          />
        )}
        {view.end > workEnd && (
          <div
            aria-hidden="true"
            style={{
              top: (workEnd - view.start) * px,
              height: (view.end - workEnd) * px,
            }}
            className="absolute inset-x-0 bg-sunken/60"
          />
        )}

        {fixed.map((block) => (
          <div
            key={block.id}
            style={{
              top: (block.start_minute - view.start) * px,
              height: (block.end_minute - block.start_minute) * px,
            }}
            className="absolute inset-x-0 flex items-start rounded-flusso-sm border border-dashed border-line-strong bg-sunken px-2 py-1"
          >
            <span className="truncate text-xs text-ink-soft">
              {block.label ?? block.type}
            </span>
          </div>
        ))}

        {buffers.map((strip) => (
          <div
            key={`buffer-${strip.start}`}
            style={{
              top: (strip.start - view.start) * px,
              height: (strip.end - strip.start) * px,
            }}
            className="absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--line)_4px,var(--line)_5px)]"
            title={`Buffer di ${strip.end - strip.start} minuti`}
          >
            <span className="rounded-full bg-bg px-1.5 text-[10px] text-ink-faint">
              buffer
            </span>
          </div>
        ))}

        {/* Le zone di rilascio stanno sotto ai blocchi: dnd-kit fa da sé la
            rilevazione, quindi non serve che siano cliccabili. */}
        {slots.map((minute) => (
          <DropSlot
            key={`slot-${minute}`}
            day={day}
            minute={minute}
            top={(minute - view.start) * px}
            height={SLOT * px}
          />
        ))}

        {placed.map((entry) =>
          entry.item.kind === "task" ? (
            <TaskBlock
              key={entry.item.task.id}
              task={entry.item.task}
              project={
                entry.item.task.project_id
                  ? projectsById.get(entry.item.task.project_id)
                  : undefined
              }
              top={(entry.start - view.start) * px}
              height={(entry.end - entry.start) * px}
              left={(entry.column / entry.columns) * 100}
              width={100 / entry.columns}
              pxPerMinute={px}
              onOpen={onOpenTask}
              onToggleDone={onToggleDone}
              onStartFocus={onStartFocus}
              onMicroStart={onMicroStart}
              onResize={onResize}
            />
          ) : (
            <GoogleEventBlock
              key={entry.item.event.id}
              event={entry.item.event}
              calendar={googleCalendars.get(entry.item.event.calendar_id)}
              top={(entry.start - view.start) * px}
              height={(entry.end - entry.start) * px}
              left={(entry.column / entry.columns) * 100}
              width={100 / entry.columns}
              onToggleDone={onToggleGoogleDone}
            />
          ),
        )}

        <NowLine day={day} range={view} px={px} />
      </div>
    </div>
  );
}

function DropSlot({
  day,
  minute,
  top,
  height,
}: {
  day: DayISO;
  minute: number;
  top: number;
  height: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${day}:${minute}`,
    data: { kind: "slot", day, minute },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ top, height }}
      aria-hidden="true"
      className={cn(
        "absolute inset-x-0",
        isOver && "bg-accent-soft ring-1 ring-inset ring-accent",
      )}
    />
  );
}

/** La riga dell'ora corrente, solo sul giorno di oggi. */
function NowLine({
  day,
  range,
  px,
}: {
  day: DayISO;
  /** Deliberatamente non si chiama `window`: quel nome è già del browser. */
  range: { start: number; end: number };
  px: number;
}) {
  const [minute, setMinute] = useState<number | null>(null);

  useEffect(() => {
    if (day !== todayISO()) {
      setMinute(null);
      return;
    }
    const tick = () => setMinute(nowMinutes());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [day]);

  if (minute === null || minute < range.start || minute > range.end) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{ top: (minute - range.start) * px }}
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
    >
      <span className="-ml-1 size-2 rounded-full bg-[var(--danger)]" />
      <span className="h-px flex-1 bg-[var(--danger)]" />
    </div>
  );
}
