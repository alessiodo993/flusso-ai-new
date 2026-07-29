"use client";

import { fmtDayShort, fmtDuration, toRomeDay } from "@/lib/time";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Lo storico di esecuzione del task: stimato contro reale, quante volte è
 * stato rinviato, da quando è in giro.
 *
 * È il pezzo che rende visibile la calibrazione sul singolo task, e serve a
 * rispondere alla domanda che di solito nessuno si pone: «quanto ci ho messo
 * davvero l'ultima volta?».
 */
export function TaskHistory({ task }: { task: Task }) {
  const hasHistory =
    task.actual_duration_minutes !== null ||
    task.postpone_count > 0 ||
    task.first_planned_at !== null;

  if (!hasHistory) return null;

  const drift =
    task.est_minutes && task.actual_duration_minutes
      ? task.actual_duration_minutes / task.est_minutes
      : null;

  return (
    <div className="panel-soft p-3">
      <p className="label mb-2">Come è andata finora</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {task.est_minutes !== null && (
          <Row label="Stimato" value={fmtDuration(task.est_minutes)} />
        )}

        {task.actual_duration_minutes !== null && (
          <Row
            label="Reale"
            value={fmtDuration(task.actual_duration_minutes)}
            tone={drift !== null && drift > 1.2 ? "warn" : undefined}
          />
        )}

        {task.postpone_count > 0 && (
          <Row
            label="Rinvii"
            value={String(task.postpone_count)}
            tone={task.postpone_count >= 3 ? "danger" : undefined}
          />
        )}

        {task.first_planned_at && (
          <Row
            label="Prima pianificazione"
            value={fmtDayShort(toRomeDay(task.first_planned_at))}
          />
        )}
      </dl>

      {drift !== null && drift > 1.2 && (
        <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
          Ci hai messo il {Math.round((drift - 1) * 100)}% in più di quanto
          avevi previsto. La prossima stima parte da qui.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "danger";
}) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd
        className={cn(
          "tnum font-medium",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
