"use client";

import { Battery, CalendarClock, ListTree, RotateCcw, Timer } from "lucide-react";

import {
  deadlineTone,
  fmtDuration,
  fmtRelativeDay,
  todayISO,
  type DayISO,
} from "@/lib/time";
import { ENERGY_LABEL, subtaskProgress, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Le informazioni che devono leggersi **senza aprire nulla**: scadenza col
 * semaforo, energia, stima, avanzamento dei sottotask, quante volte il task è
 * già stato rinviato.
 *
 * Sta qui e non nelle card perché le stesse chip compaiono in Lista, in Idee e
 * sui blocchi del calendario: tre copie divergerebbero al primo ritocco.
 */
export function TaskMetaChips({
  task,
  today = todayISO(),
  compact = false,
  className,
}: {
  task: Task;
  today?: DayISO;
  /** Sui blocchi stretti del calendario si tiene solo l'essenziale. */
  compact?: boolean;
  className?: string;
}) {
  const subtasks = subtaskProgress(task);
  const tone = task.deadline ? deadlineTone(task.deadline, today) : null;

  const chips: React.ReactNode[] = [];

  if (task.deadline && tone) {
    chips.push(
      <span
        key="deadline"
        className={cn(
          "chip",
          tone === "overdue" && "chip-danger",
          tone === "soon" && "chip-warn",
        )}
        title={`Scadenza: ${task.deadline}`}
      >
        <CalendarClock className="size-3" aria-hidden="true" />
        {fmtRelativeDay(task.deadline, today)}
      </span>,
    );
  }

  if (task.est_minutes) {
    chips.push(
      <span key="est" className="chip tnum">
        <Timer className="size-3" aria-hidden="true" />
        {fmtDuration(task.est_minutes)}
      </span>,
    );
  }

  if (!compact && task.energy) {
    chips.push(
      <span key="energy" className="chip">
        <Battery className="size-3" aria-hidden="true" />
        {ENERGY_LABEL[task.energy]}
      </span>,
    );
  }

  if (subtasks.total > 0) {
    chips.push(
      <span
        key="subtasks"
        className="chip tnum"
        title={`${subtasks.done} di ${subtasks.total} sottotask completati`}
      >
        <ListTree className="size-3" aria-hidden="true" />
        {subtasks.done}/{subtasks.total}
      </span>,
    );
  }

  // Dal secondo rinvio in poi il conteggio diventa visibile: è un segnale,
  // non una decorazione.
  if (task.postpone_count >= 2) {
    chips.push(
      <span
        key="postpone"
        className="chip chip-warn tnum"
        title={`Rinviato ${task.postpone_count} volte`}
      >
        <RotateCcw className="size-3" aria-hidden="true" />
        {task.postpone_count}
      </span>,
    );
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {chips}
    </div>
  );
}
