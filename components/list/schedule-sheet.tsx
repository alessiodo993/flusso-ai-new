"use client";

import { useEffect, useMemo, useState } from "react";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { SelectField } from "@/components/ui/select-field";
import { useSettings } from "@/lib/hooks/use-settings";
import { useTasks } from "@/lib/hooks/use-tasks";
import {
  addDaysISO,
  fmtDayShort,
  fmtDuration,
  fmtMin,
  overlaps,
  snap,
  todayISO,
  type DayISO,
} from "@/lib/time";
import { isScheduled, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 25, 30, 45, 60, 90, 120, 180, 240];
const STEP = 30;

/**
 * Scelta di giorno e ora per un blocco.
 *
 * Gli orari già occupati restano cliccabili ma marcati: sovrapporre due
 * blocchi è a volte quello che si vuole, nasconderlo non lo impedirebbe e
 * renderebbe solo più difficile capire perché un orario è sparito.
 */
export function ScheduleSheet({
  task,
  open,
  onOpenChange,
  onConfirm,
  onBackToList,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    id: string;
    day: DayISO;
    startMinute: number;
    estMinutes: number;
  }) => void;
  onBackToList: (task: Task) => void;
}) {
  const { settings } = useSettings();
  const { byDay } = useTasks();
  const today = todayISO();

  const [day, setDay] = useState<DayISO>(today);
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [estMinutes, setEstMinutes] = useState(30);

  // Riapre sempre sui valori del task, non su quelli dell'apertura scorsa.
  useEffect(() => {
    if (!task || !open) return;
    setDay(task.day ?? today);
    setStartMinute(task.start_minute);
    setEstMinutes(task.est_minutes ?? 30);
  }, [open, task, today]);

  const busy = useMemo(() => {
    const others = (byDay.get(day) ?? []).filter(
      (other) => other.id !== task?.id && isScheduled(other),
    );
    return others.map((other) => ({
      start: other.start_minute as number,
      end: (other.start_minute as number) + (other.est_minutes as number),
    }));
  }, [byDay, day, task?.id]);

  const slots = useMemo(() => {
    const list: Array<{ minute: number; taken: boolean }> = [];
    for (let m = snap(settings.work_start, STEP); m < settings.work_end; m += STEP) {
      list.push({
        minute: m,
        taken: busy.some((block) => overlaps(block, { start: m, end: m + estMinutes })),
      });
    }
    return list;
  }, [busy, estMinutes, settings.work_end, settings.work_start]);

  const quickDays: DayISO[] = [today, addDaysISO(today, 1), addDaysISO(today, 2)];

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={task ? task.title : "Pianifica"}
      description="Scegli quando ci lavori."
      footer={
        <div className="flex items-center gap-2">
          {task && isScheduled(task) && (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                onBackToList(task);
                onOpenChange(false);
              }}
            >
              Riporta in Lista
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary ml-auto"
            disabled={startMinute === null || !task}
            onClick={() => {
              if (!task || startMinute === null) return;
              onConfirm({ id: task.id, day, startMinute, estMinutes });
              onOpenChange(false);
            }}
          >
            Pianifica
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div>
          <p className="label mb-1.5">Giorno</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {quickDays.map((candidate, index) => (
              <button
                key={candidate}
                type="button"
                data-on={day === candidate}
                onClick={() => setDay(candidate)}
                className={cn(
                  "chip min-h-9 px-3",
                  day === candidate && "chip-accent font-medium",
                )}
              >
                {["Oggi", "Domani", "Dopodomani"][index]}
              </button>
            ))}

            <input
              type="date"
              aria-label="Un altro giorno"
              className="field h-9 min-h-9 w-auto py-0 text-sm"
              value={day}
              min={today}
              onChange={(event) => event.target.value && setDay(event.target.value)}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-faint first-letter:uppercase">
            {fmtDayShort(day)}
          </p>
        </div>

        <div>
          <p className="label mb-1.5">Durata</p>
          <SelectField
            ariaLabel="Durata del blocco"
            value={String(estMinutes)}
            onChange={(value) => setEstMinutes(Number(value))}
            options={DURATIONS.map((minutes) => ({
              value: String(minutes),
              label: fmtDuration(minutes),
            }))}
          />
        </div>

        <div>
          <p className="label mb-1.5">Ora di inizio</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((slot) => (
              <button
                key={slot.minute}
                type="button"
                onClick={() => setStartMinute(slot.minute)}
                aria-pressed={startMinute === slot.minute}
                title={slot.taken ? "In questa fascia c'è già un blocco" : undefined}
                className={cn(
                  "tnum min-h-10 rounded-flusso-sm border text-sm transition-colors duration-150 ease-out",
                  startMinute === slot.minute
                    ? "border-transparent bg-accent font-medium text-accent-ink"
                    : slot.taken
                      ? "border-line bg-sunken text-ink-faint line-through"
                      : "border-line text-ink hover:border-line-strong",
                )}
              >
                {fmtMin(slot.minute)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
