"use client";

import { useEffect, useRef } from "react";

import { isStale } from "@/lib/calibration";
import { useBulkUpdateTasks, useTasks } from "@/lib/hooks/use-tasks";

/**
 * Marca come «in dubbio» i task mai pianificati da tre settimane.
 *
 * Gira nel browser una volta per sessione, e non in un lavoro pianificato sul
 * server: è un'app monoutente, e far girare un cron per una manciata di righe
 * sarebbe infrastruttura che non ripaga. Se l'utente non apre l'app, quei task
 * possono aspettare — non c'è nessuno a cui mostrarli.
 */
export function useDecaySweep() {
  const { tasks, isLoading } = useTasks();
  const bulk = useBulkUpdateTasks();
  const swept = useRef(false);

  useEffect(() => {
    if (isLoading || swept.current || tasks.length === 0) return;

    const stale = tasks.filter(
      (task) => task.status_review === "active" && isStale(task),
    );
    if (stale.length === 0) {
      swept.current = true;
      return;
    }

    swept.current = true;
    bulk.mutate({
      ids: stale.map((task) => task.id),
      status_review: "stale",
    });
  }, [bulk, isLoading, tasks]);
}
