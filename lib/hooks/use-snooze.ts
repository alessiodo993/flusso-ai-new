"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { useFlussoEvent } from "@/lib/events";
import { useScheduleTask, useTasks } from "@/lib/hooks/use-tasks";
import { fmtMin, snap, DAY_MINUTES } from "@/lib/time";
import { isScheduled } from "@/lib/types";

/**
 * «Rimanda 15 min» dalla notifica di inizio blocco.
 *
 * Spostare un blocco di un quarto d'ora **non è un rinvio** e non incrementa
 * il contatore: rinviare è mandare una cosa a un altro giorno, questo è
 * finire la telefonata prima di cominciare. Confonderli farebbe scattare il
 * dialogo del terzo rinvio per tre pause caffè.
 */
export function useSnooze() {
  const { byId } = useTasks();
  const schedule = useScheduleTask();

  useFlussoEvent(
    "flusso:snooze",
    useCallback(
      ({ taskId, minutes }) => {
        const task = byId.get(taskId);
        if (!task || !isScheduled(task)) return;

        const start = snap(task.start_minute + minutes);
        // Oltre la mezzanotte non si sposta: sarebbe un altro giorno, cioè
        // un'altra decisione.
        if (start + task.est_minutes > DAY_MINUTES) {
          toast("Non c'è più spazio oggi: spostalo a mano.");
          return;
        }

        schedule.mutate({
          id: task.id,
          day: task.day,
          startMinute: start,
          estMinutes: task.est_minutes,
        });
        toast(`«${task.title}» alle ${fmtMin(start)}.`);
      },
      [byId, schedule],
    ),
  );
}
