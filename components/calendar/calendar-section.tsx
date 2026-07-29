"use client";

import { CalendarDays, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { DayGrid } from "@/components/calendar/day-grid";
import { DayStrip } from "@/components/calendar/day-strip";
import { AllDayStrip } from "@/components/calendar/google-event-block";
import { GoogleReconnectBanner } from "@/components/calendar/google-reconnect-banner";
import { NotificationOptIn } from "@/components/calendar/notification-opt-in";
import { ScheduleSheet } from "@/components/list/schedule-sheet";
import { TaskSheet } from "@/components/list/task-sheet";
import { EmptyState } from "@/components/ui/empty-state";
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

  const plannedMinutes = scheduled.reduce(
    (total, task) => total + (task.est_minutes ?? 0),
    0,
  );
  const overCap = plannedMinutes > settings.daily_cap_minutes;

  return (
    <section className="panel overflow-hidden" aria-label="Calendario">
      <div className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-md">
        <DayStrip day={day} onChange={setDay} counts={counts} />

        <div className="flex items-center gap-2 px-3 pb-2">
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

          {/* L'etichetta dello zoom resta leggibile anche sul telefono: senza,
              i tre numeri da soli non direbbero cosa stanno regolando. */}
          <div className="seg shrink-0" role="group" aria-label="Livello di zoom">
            {ZOOMS.map((level) => (
              <button
                key={level}
                type="button"
                data-on={effectiveZoom === level}
                aria-pressed={effectiveZoom === level}
                onClick={() => setZoom(level)}
                className="tnum px-2"
              >
                {level}
                <span className="ml-0.5 text-[10px] opacity-70">min</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <GoogleReconnectBanner />
      <NotificationOptIn tasks={tasks} />

      {scheduled.length === 0 && fixed.length === 0 && googleEvents.length === 0 ? (
        <EmptyState
          Icon={CalendarDays}
          title="Giornata libera"
          description="Trascina qui un task dalla Lista o da Idee, oppure lascia che sia l'AI a trovare gli slot."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => emit("flusso:open-planner", {})}
            >
              <Sparkles className="size-4" />
              Pianifica con AI
            </button>
          }
        />
      ) : (
        <div className="p-3">
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
            onOpenTask={setOpenTask}
            onToggleDone={actions.toggleDone}
            onStartFocus={actions.startFocus}
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
        onConfirm={(input) => schedule.mutate(input)}
        onBackToList={actions.backToList}
      />
    </section>
  );
}
