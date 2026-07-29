"use client";

import { CalendarX2, Info, X } from "lucide-react";

import { SelectField } from "@/components/ui/select-field";
import { safeColor } from "@/lib/colors";
import type { Placement, PlannerSettings } from "@/lib/planner";
import { fmtDayShort, fmtDuration, fmtMin, SLOT } from "@/lib/time";
import type { Project, Task } from "@/lib/types";

/**
 * La revisione del piano, raggruppata per giorno.
 *
 * Ogni blocco si può togliere o spostare a mano prima di confermare: senza
 * questa schermata «pianifica con AI» sarebbe una scrittura automatica con
 * un passaggio di cortesia davanti.
 */
export function PlacementList({
  placements,
  unplaced,
  note,
  tasksById,
  projectsById,
  settings,
  onRemove,
  onMove,
}: {
  placements: Placement[];
  unplaced: Array<{ taskId: string; reason: string }>;
  note: string;
  tasksById: Map<string, Task>;
  projectsById: Map<string, Project>;
  settings: PlannerSettings;
  onRemove: (taskId: string) => void;
  onMove: (taskId: string, changes: Partial<Placement>) => void;
}) {
  const days = [...new Set(placements.map((one) => one.day))].sort();

  const starts: number[] = [];
  for (let m = settings.workStart; m + SLOT <= settings.workEnd; m += SLOT) {
    starts.push(m);
  }

  return (
    <div className="space-y-3 pb-1">
      {note && (
        <p className="flex items-start gap-2 rounded-flusso-md bg-sunken p-3 text-sm text-ink-soft">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          {note}
        </p>
      )}

      {placements.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-soft">
          Non è rimasto niente da mettere sul calendario.
        </p>
      )}

      {days.map((day) => {
        const ofDay = placements
          .filter((one) => one.day === day)
          .sort((a, b) => a.startMinute - b.startMinute);
        const total = ofDay.reduce((sum, one) => sum + one.estMinutes, 0);

        return (
          <section key={day}>
            <header className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium first-letter:uppercase">
                {fmtDayShort(day)}
              </h3>
              <span className="tnum text-xs text-ink-faint">
                {ofDay.length === 1 ? "1 blocco" : `${ofDay.length} blocchi`} ·{" "}
                {fmtDuration(total)}
              </span>
            </header>

            <ul className="space-y-1.5">
              {ofDay.map((placement) => {
                const task = tasksById.get(placement.taskId);
                const project = task?.project_id
                  ? projectsById.get(task.project_id)
                  : undefined;

                return (
                  <li
                    key={placement.taskId}
                    className="flex items-center gap-2 rounded-flusso-md border border-line bg-surface p-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{
                        background: project
                          ? safeColor(project.color)
                          : "var(--line-strong)",
                      }}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {task?.title ?? "Task"}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {fmtDuration(placement.estMinutes)}
                        {placement.reason ? ` · ${placement.reason}` : ""}
                      </p>
                    </div>

                    <SelectField
                      ariaLabel={`Orario di ${task?.title ?? "questo blocco"}`}
                      className="w-24 shrink-0"
                      value={String(placement.startMinute)}
                      onChange={(value) =>
                        onMove(placement.taskId, { startMinute: Number(value) })
                      }
                      options={starts.map((minute) => ({
                        value: String(minute),
                        label: fmtMin(minute),
                      }))}
                    />

                    <button
                      type="button"
                      className="icon-btn size-8 shrink-0"
                      aria-label={`Togli ${task?.title ?? "questo blocco"} dal piano`}
                      onClick={() => onRemove(placement.taskId)}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {unplaced.length > 0 && (
        <section className="rounded-flusso-md border border-line bg-sunken p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <CalendarX2 className="size-4 text-ink-faint" />
            Non ci stanno
          </h3>
          <ul className="mt-1.5 space-y-1">
            {unplaced.map((one) => (
              <li key={one.taskId} className="text-xs text-ink-soft">
                <span className="text-ink">
                  {tasksById.get(one.taskId)?.title ?? "Task"}
                </span>{" "}
                — {one.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
