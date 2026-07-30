"use client";

import { CalendarDays, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { DayGrid } from "@/components/calendar/day-grid";
import { WeekView } from "@/components/calendar/week-view";
import { DayStrip } from "@/components/calendar/day-strip";
import { AllDayStrip } from "@/components/calendar/google-event-block";
import { GoogleReconnectBanner } from "@/components/calendar/google-reconnect-banner";
import { NotificationOptIn } from "@/components/calendar/notification-opt-in";
import { RitualPrompt } from "@/components/rituals/ritual-prompt";
import { ScheduleSheet } from "@/components/list/schedule-sheet";
import { TaskSheet } from "@/components/list/task-sheet";
import { ZOOMS, type Zoom } from "@/lib/calendar-layout";
import { emit } from "@/lib/events";
import { useBlocks } from "@/lib/hooks/use-blocks";
import {
  useGoogleCalendars,
  useGoogleEvents,
  useToggleGoogleEventDone,
} from "@/lib/hooks/use-google";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useProjects } from "@/lib/hooks/use-projects";
import { useSettings } from "@/lib/hooks/use-settings";
import { useTaskQuickActions } from "@/lib/hooks/use-task-quick-actions";
import { useScheduleTask, useTasks, useUpdateTask } from "@/lib/hooks/use-tasks";
import { fmtDayLong, fmtDayShort, fmtDuration, todayISO, type DayISO } from "@/lib/time";
import { moveTask } from "@/lib/postpone";
import { timeToMinutes } from "@/lib/planner";
import { isScheduled, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * La verità del giorno. Tutto quello che è stato deciso vive qui: se non c'è,
 * non succede.
 */
export function CalendarSection() {
  const [day, setDay] = useState<DayISO>(todayISO());
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [scheduling, setScheduling] = useState<Task | null>(null);

  const isDesktop = useIsDesktop();
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [view, setView] = useState<"giorno" | "settimana">("giorno");

  const { settings } = useSettings();
  const { tasks, byDay } = useTasks();
  const { byId: projectsById } = useProjects();
  const { forDay } = useBlocks();
  const { byDay: googleByDay } = useGoogleEvents();
  const { byId: calendarsById } = useGoogleCalendars();
  const toggleGoogleDone = useToggleGoogleEventDone();
  const update = useUpdateTask();
  const schedule = useScheduleTask();
  const actions = useTaskQuickActions({
    onOpen: setOpenTask,
    onSchedule: setScheduling,
  });

  // Default 30 su desktop, 60 su telefono. `useIsDesktop` parte da `false`,
  // quindi lo zoom si fissa alla prima misura e poi resta scelta dell'utente.
  const effectiveZoom: Zoom = zoom ?? (isDesktop ? 30 : 60);

  const dayTasks = useMemo(() => byDay.get(day) ?? [], [byDay, day]);
  const scheduled = useMemo(() => dayTasks.filter(isScheduled), [dayTasks]);
  const fixed = useMemo(() => forDay(day), [forDay, day]);

  const googleEvents = useMemo(
    () => googleByDay.get(day) ?? [],
    [googleByDay, day],
  );
  const allDayEvents = useMemo(
    () => googleEvents.filter((event) => event.all_day),
    [googleEvents],
  );

  const counts = useMemo(() => {
    const map = new Map<DayISO, number>();
    for (const [key, list] of byDay) {
      map.set(key, list.filter(isScheduled).length);
    }
    return map;
  }, [byDay]);

  const vuoto =
    scheduled.length === 0 && fixed.length === 0 && googleEvents.length === 0;

  const plannedMinutes = scheduled.reduce(
    (total, task) => total + (task.est_minutes ?? 0),
    0,
  );
  const overCap = plannedMinutes > settings.daily_cap_minutes;

  return (
    <section className="panel overflow-hidden" aria-label="Calendario">
      <div className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-md">
        <DayStrip day={day} onChange={setDay} counts={counts} />

        {/*
          Va a capo, e non è un ripiego: a 390px la data, il totale e i due
          selettori non ci stanno su una riga sola — con `overflow-hidden` sul
          pannello i livelli di zoom finivano **tagliati fuori dallo schermo**,
          irraggiungibili col dito. Da 1080px in su tornano tutti in linea.
        */}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          {/* Su schermi stretti la data si accorcia invece di andare a capo:
              una riga in più nell'intestazione è una riga in meno di giornata. */}
          <p className="min-w-0 flex-1 truncate text-sm first-letter:uppercase">
            <span className="sm:hidden">{fmtDayShort(day)}</span>
            <span className="hidden sm:inline">{fmtDayLong(day)}</span>
          </p>

          {plannedMinutes > 0 && (
            <span
              className={cn("chip tnum shrink-0", overCap && "chip-warn")}
              title={
                overCap
                  ? `Oltre il tetto di ${fmtDuration(settings.daily_cap_minutes)}`
                  : "Tempo pianificato"
              }
            >
              {fmtDuration(plannedMinutes)}
            </span>
          )}

          <div className="flex w-full items-center gap-2 app:w-auto">
          <div className="seg shrink-0" role="group" aria-label="Vista">
            <button
              type="button"
              data-on={view === "giorno"}
              aria-pressed={view === "giorno"}
              onClick={() => setView("giorno")}
            >
              Giorno
            </button>
            <button
              type="button"
              data-on={view === "settimana"}
              aria-pressed={view === "settimana"}
              onClick={() => setView("settimana")}
            >
              Settimana
            </button>
          </div>

          {/* L'etichetta dello zoom resta leggibile anche sul telefono: senza,
              i tre numeri da soli non direbbero cosa stanno regolando. Nella
              vista settimana non c'è niente da ingrandire: sparisce. */}
          {view === "giorno" && (
            <div
              className="seg ml-auto shrink-0"
              role="group"
              aria-label="Livello di zoom"
            >
              {ZOOMS.map((level) => (
                <button
                  key={level}
                  type="button"
                  data-on={effectiveZoom === level}
                  aria-pressed={effectiveZoom === level}
                  onClick={() => setZoom(level)}
                  // Senza il suffisso il pulsante scendeva a 29px di larghezza:
                  // alto abbastanza per il dito, stretto no.
                  className="tnum min-w-11 px-1.5"
                >
                  {level}
                  {/*
                    Il suffisso sparisce sotto i 640px, e non è una svista: a
                    390px i due selettori con «min» sforano la cornice, che ha
                    `overflow-hidden`, e il livello da 60 finiva **tagliato**.
                    Meglio tre numeri interi che un comando dimezzato; il senso
                    resta nell'`aria-label` del gruppo.
                    Senza opacità: al 70% questo suffisso scendeva sotto il
                    4.5:1, e la gerarchia la fa già la dimensione.
                  */}
                  <span className="ml-0.5 hidden text-[11px] sm:inline">
                    min
                  </span>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      <GoogleReconnectBanner />
      <RitualPrompt />
      <NotificationOptIn tasks={tasks} />

      {view === "settimana" ? (
        <WeekView day={day} onSelectDay={(next) => { setDay(next); setView("giorno"); }} onOpenTask={setOpenTask} />
      ) : (
        <div className="p-3">
          {/*
            La griglia c'è **anche quando il giorno è vuoto**. Prima al suo
            posto compariva uno stato vuoto a tutta altezza, e con due
            conseguenze: le ore sparivano proprio quando servono di più — per
            decidere *dove* mettere qualcosa bisogna vedere la giornata — e
            l'invito a «trascinare qui un task» toglieva di mezzo l'unica
            superficie su cui si può trascinare. L'invito resta, ma come riga
            sopra la griglia, non al posto suo.
          */}
          {vuoto && (
            <div className="mb-3 flex flex-col gap-2 rounded-flusso-md border border-dashed border-line-strong px-3 py-2.5 sm:flex-row sm:items-center">
              <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-soft">
                <CalendarDays className="size-4 shrink-0 text-ink-faint" />
                Giornata libera: trascina qui un task, o fatti proporre gli
                orari.
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

          <AllDayStrip
            events={allDayEvents}
            calendars={calendarsById}
            onToggleDone={(event) =>
              toggleGoogleDone.mutate({ id: event.id, done: !event.local_done })
            }
          />

          <DayGrid
            day={day}
            zoom={effectiveZoom}
            tasks={dayTasks}
            fixed={fixed}
            googleEvents={googleEvents}
            googleCalendars={calendarsById}
            projectsById={projectsById}
            bufferMinutes={settings.buffer_minutes}
            workStart={settings.work_start}
            workEnd={settings.work_end}
            peakStart={timeToMinutes(settings.peak_hours_start)}
            peakEnd={timeToMinutes(settings.peak_hours_end)}
            onOpenTask={setOpenTask}
            onToggleDone={actions.toggleDone}
            onStartFocus={actions.startFocus}
            onMicroStart={actions.microStart}
            onResize={(task, estMinutes) =>
              update.mutate({ id: task.id, est_minutes: estMinutes })
            }
            onToggleGoogleDone={(event) =>
              toggleGoogleDone.mutate({ id: event.id, done: !event.local_done })
            }
          />
        </div>
      )}

      <TaskSheet
        task={openTask}
        open={openTask !== null}
        onOpenChange={(next) => !next && setOpenTask(null)}
        onSchedule={(task) => {
          setOpenTask(null);
          setScheduling(task);
        }}
      />

      <ScheduleSheet
        task={scheduling}
        open={scheduling !== null}
        onOpenChange={(next) => !next && setScheduling(null)}
        onConfirm={(input) => {
          const target = tasks.find((one) => one.id === input.id);
          if (!target) return;
          moveTask({
            task: target,
            day: input.day,
            startMinute: input.startMinute,
            schedule: () => schedule.mutate(input),
          });
        }}
        onBackToList={actions.backToList}
      />
    </section>
  );
}
