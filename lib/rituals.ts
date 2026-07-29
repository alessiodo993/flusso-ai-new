import { dowOf, fmtDuration, todayISO, type DayISO } from "@/lib/time";
import type { DailyReview, Task } from "@/lib/types";
import { isScheduled } from "@/lib/types";

/**
 * L'aritmetica dei due riti.
 *
 * Sta fuori dai componenti perché è la parte che dice all'utente delle cose
 * su di sé — «pianifichi cinque ore, di solito ne esegui tre e venti» — e
 * una frase del genere va calcolata bene o non detta affatto.
 */

/** Quanti shutdown servono prima di parlare di abitudini. */
export const MIN_HISTORY = 3;

export type DayTotals = {
  plannedMinutes: number;
  completedMinutes: number;
  tasksPlanned: number;
  tasksCompleted: number;
};

export function dayTotals(tasks: Task[]): DayTotals {
  const scheduled = tasks.filter(isScheduled);
  const done = scheduled.filter((task) => task.status === "done");

  return {
    plannedMinutes: scheduled.reduce((sum, task) => sum + task.est_minutes, 0),
    // Il tempo davvero speso quando c'è; altrimenti la stima, che è comunque
    // meglio di zero per un task spuntato a mano senza timer.
    completedMinutes: done.reduce(
      (sum, task) => sum + (task.actual_duration_minutes ?? task.est_minutes),
      0,
    ),
    tasksPlanned: scheduled.length,
    tasksCompleted: done.length,
  };
}

/** La media dei minuti davvero eseguiti negli ultimi shutdown. */
export function typicalCompleted(history: DailyReview[]): number | null {
  const usable = history.filter((one) => one.tasks_planned > 0);
  if (usable.length < MIN_HISTORY) return null;

  const total = usable.reduce((sum, one) => sum + one.completed_minutes, 0);
  return Math.round(total / usable.length);
}

/**
 * Il confronto del kickoff. Parla **solo** se c'è uno scarto che vale la
 * pena nominare: ripetere «sei in linea» ogni mattina è rumore, e dopo tre
 * giorni non lo legge più nessuno.
 */
export function kickoffMessage({
  plannedMinutes,
  typical,
}: {
  plannedMinutes: number;
  typical: number | null;
}): string | null {
  if (typical === null || plannedMinutes === 0) return null;

  const ratio = plannedMinutes / Math.max(1, typical);
  if (ratio < 1.25) return null;

  return `Stai pianificando ${fmtDuration(plannedMinutes)}, di solito ne esegui ${fmtDuration(typical)}.`;
}

/** Il massimo di task che si possono riportare a domani. */
export const MAX_CARRY_OVER = 3;

export type PendingChoice =
  | "domani"
  | "lista"
  | "fatto"
  | "ridimensiona"
  | "elimina";

/**
 * Quante scelte «domani» sono ancora disponibili.
 *
 * Il tetto è la parte scomoda del rito, ed è voluta: senza, lo shutdown
 * diventa un pulsante «sposta tutto a domani» e domani eredita una giornata
 * già persa.
 */
export function carryOverLeft(choices: Record<string, PendingChoice>): number {
  const used = Object.values(choices).filter((one) => one === "domani").length;
  return Math.max(0, MAX_CARRY_OVER - used);
}

/** Il riepilogo della giornata, in una riga. */
export function shutdownSummary(totals: DayTotals): string {
  if (totals.tasksPlanned === 0) {
    return "Oggi non c'era niente sul calendario.";
  }
  if (totals.tasksCompleted === totals.tasksPlanned) {
    return `Tutto fatto: ${totals.tasksCompleted} blocchi, ${fmtDuration(totals.completedMinutes)}.`;
  }
  return `${totals.tasksCompleted} di ${totals.tasksPlanned} blocchi, ${fmtDuration(totals.completedMinutes)} su ${fmtDuration(totals.plannedMinutes)} pianificati.`;
}

/** Gli spazi liberi di domani, nel formato che il prompt si aspetta. */
export function formatSlots(
  gaps: Array<{ start: number; end: number }>,
  fmt: (minute: number) => string,
): string[] {
  return gaps
    .filter((gap) => gap.end - gap.start >= 15)
    .map((gap) => `${fmt(gap.start)}–${fmt(gap.end)}`);
}

/**
 * Il giorno in cui vale la pena guardare i task in dubbio.
 *
 * Domenica o lunedì: la fine di una settimana o l'inizio di quella dopo sono
 * i due momenti in cui si guarda l'insieme invece del prossimo blocco.
 * Proporlo un mercoledì pomeriggio significa interrompere qualcuno che stava
 * lavorando — l'opposto di quello che serve.
 */
export function isReviewDay(day: DayISO = todayISO()): boolean {
  const dow = dowOf(day);
  return dow === 0 || dow === 1;
}
