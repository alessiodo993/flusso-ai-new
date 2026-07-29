"use client";

import { Check } from "lucide-react";

import { safeColor } from "@/lib/colors";
import { fmtDuration } from "@/lib/time";
import type { Project, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * «Scelgo io»: la spunta sui task da mettere in giornata.
 *
 * L'ordine è quello della Lista, non un ordine nuovo: chi arriva qui ha già
 * in testa la sua lista, e ritrovarla mescolata sarebbe un piccolo tradimento.
 */
export function PlannerTaskPicker({
  tasks,
  picked,
  projectsById,
  onToggle,
}: {
  tasks: Task[];
  picked: Set<string>;
  projectsById: Map<string, Project>;
  onToggle: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-flusso-md bg-sunken p-3 text-sm text-ink-soft">
        La Lista è vuota: non c&apos;è niente da pianificare.
      </p>
    );
  }

  const totalPicked = tasks
    .filter((task) => picked.has(task.id))
    .reduce((sum, task) => sum + (task.est_minutes ?? 30), 0);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="label">Task da pianificare</p>
        {picked.size > 0 && (
          <span className="tnum text-xs text-ink-faint">
            {picked.size} · {fmtDuration(totalPicked)}
          </span>
        )}
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto scroll-quiet">
        {tasks.map((task) => {
          const on = picked.has(task.id);
          const project = task.project_id
            ? projectsById.get(task.project_id)
            : undefined;

          return (
            <li key={task.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(task.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-flusso-md border p-2.5 text-left transition-colors duration-150",
                  on
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-flusso-sm border",
                    on ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm">
                  {task.title}
                </span>

                {project && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: safeColor(project.color) }}
                  />
                )}

                <span className="tnum shrink-0 text-xs text-ink-faint">
                  {fmtDuration(task.est_minutes ?? 30)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
