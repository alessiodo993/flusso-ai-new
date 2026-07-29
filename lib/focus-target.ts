import { nowMinutes, todayISO, type DayISO } from "@/lib/time";
import { isScheduled, type Task } from "@/lib/types";

/**
 * Quale task deve partire quando si preme «Adesso», senza chiedere niente.
 *
 * L'ordine è quello che risponde alla domanda «cosa dovrei star facendo?»:
 * prima il blocco in corso, poi il prossimo della giornata, e solo alla fine
 * il primo rimasto — perché se è passata l'ora, la risposta utile è comunque
 * ciò che è rimasto indietro, non «niente».
 */
export type FocusChoice = {
  task: Task;
  reason: "in-corso" | "prossimo" | "primo-rimasto";
};

export function resolveFocusTarget(
  tasks: Task[],
  options: { day?: DayISO; minute?: number } = {},
): FocusChoice | null {
  const day = options.day ?? todayISO();
  const minute = options.minute ?? nowMinutes();

  const candidates = tasks
    .filter(
      (task) => task.day === day && task.status !== "done" && isScheduled(task),
    )
    .sort((a, b) => (a.start_minute ?? 0) - (b.start_minute ?? 0));

  if (candidates.length === 0) return null;

  const running = candidates.find((task) => {
    const start = task.start_minute as number;
    return minute >= start && minute < start + (task.est_minutes as number);
  });
  if (running) return { task: running, reason: "in-corso" };

  const next = candidates.find((task) => (task.start_minute as number) > minute);
  if (next) return { task: next, reason: "prossimo" };

  return { task: candidates[0], reason: "primo-rimasto" };
}

/** Il messaggio da mostrare quando non c'è niente da avviare. */
export const NOTHING_TO_FOCUS =
  "Non c'è nessun blocco per oggi. Pianificane uno e poi torna qui.";
