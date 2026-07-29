import { addDaysISO, toRomeDay, todayISO, type DayISO } from "@/lib/time";
import type { FocusSession, Task } from "@/lib/types";

/**
 * «Realtà vs Piano».
 *
 * Tutto quello che sta qui serve a una cosa sola: smettere di pianificare come
 * se il tempo bastasse sempre. Sono funzioni pure, così i numeri che l'utente
 * si vede addosso — «sottostimi del 40%» — sono verificabili invece che
 * plausibili.
 */

/** Quante sessioni guarda il coefficiente. */
export const WINDOW = 30;

/**
 * Sotto questa soglia non si dice niente. Con tre sessioni il coefficiente
 * esiste ma non significa nulla, e un numero inventato è peggio di nessun
 * numero: verrebbe creduto.
 */
export const MIN_SESSIONS = 5;

/**
 * Ogni rapporto viene limitato a questo intervallo prima della media. Una
 * sessione da cinque minuti pianificati e cinque ore reali è quasi sempre un
 * timer dimenticato aperto, non una stima sbagliata di sessanta volte: senza
 * il limite, un caso solo sposterebbe il coefficiente di tutti.
 */
const MIN_RATIO = 0.25;
const MAX_RATIO = 4;

/**
 * Quanto tempo serve davvero, rispetto a quanto se ne prevede.
 * `1.4` significa che ci vuole il 40% in più. `null` se i dati non bastano.
 */
export function optimismCoefficient(sessions: FocusSession[]): number | null {
  const ratios = sessions
    .slice()
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .filter(
      (session) =>
        session.planned_minutes > 0 &&
        session.actual_minutes !== null &&
        session.actual_minutes > 0 &&
        // Le sessioni abbandonate dicono che è successo altro, non che la
        // stima era sbagliata.
        session.outcome !== "abandoned",
    )
    .slice(0, WINDOW)
    .map((session) =>
      clampRatio((session.actual_minutes as number) / session.planned_minutes),
    );

  if (ratios.length < MIN_SESSIONS) return null;

  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  return Math.round(mean * 100) / 100;
}

function clampRatio(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

/** La frase da mostrare, o null quando non c'è niente di notevole da dire. */
export function optimismMessage(coefficient: number | null): string | null {
  if (coefficient === null) return null;

  const drift = Math.round(Math.abs(coefficient - 1) * 100);
  // Sotto il 10% è rumore: dirlo darebbe importanza a una fluttuazione.
  if (drift < 10) return null;

  return coefficient > 1
    ? `Sottostimi del ${drift}%.`
    : `Sovrastimi del ${drift}%.`;
}

/**
 * La stima corretta dalla realtà: è ciò che il planner userà al posto del
 * numero che hai scritto tu.
 */
export function correctedEstimate(
  minutes: number,
  coefficient: number | null,
): number {
  if (coefficient === null) return minutes;
  return Math.max(5, Math.round((minutes * coefficient) / 5) * 5);
}

/** Percentuale di blocchi pianificati che sono stati poi completati. */
export function completionRate(
  tasks: Task[],
  { days = 14, today = todayISO() }: { days?: number; today?: DayISO } = {},
): { planned: number; done: number; rate: number | null } {
  const from = addDaysISO(today, -days);

  const inWindow = tasks.filter(
    (task) => task.day !== null && task.day >= from && task.day <= today,
  );

  const done = inWindow.filter((task) => task.status === "done").length;
  return {
    planned: inWindow.length,
    done,
    rate: inWindow.length === 0 ? null : done / inWindow.length,
  };
}

export type DayTotals = { day: DayISO; planned: number; done: number };

/**
 * Minuti pianificati contro minuti eseguiti, giorno per giorno.
 *
 * Per gli eseguiti si usa la durata **reale** quando c'è: è il punto di tutto
 * il grafico, e sostituirla con la stima mostrerebbe due volte lo stesso
 * numero facendo sembrare tutto perfettamente calibrato.
 */
export function plannedVsDone(
  tasks: Task[],
  { days = 14, today = todayISO() }: { days?: number; today?: DayISO } = {},
): DayTotals[] {
  const series: DayTotals[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDaysISO(today, -offset);
    const ofDay = tasks.filter((task) => task.day === day);

    series.push({
      day,
      planned: ofDay.reduce((sum, task) => sum + (task.est_minutes ?? 0), 0),
      done: ofDay
        .filter((task) => task.status === "done")
        .reduce(
          (sum, task) =>
            sum + (task.actual_duration_minutes ?? task.est_minutes ?? 0),
          0,
        ),
    });
  }

  return series;
}

/** I task che continui a spostare. */
export function mostPostponed(tasks: Task[], limit = 5): Task[] {
  return tasks
    .filter((task) => task.postpone_count > 0 && task.status !== "done")
    .sort(
      (a, b) =>
        b.postpone_count - a.postpone_count || a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Decadimento
// ---------------------------------------------------------------------------

/** Dopo quanti giorni un task mai pianificato va rivisto. */
export const DECAY_DAYS = 21;

/**
 * I task da rivedere: mai finiti sul calendario da tre settimane.
 *
 * Il criterio è `first_planned_at`, non la data di creazione: un task che è
 * stato pianificato una volta e poi rimandato non è dimenticato — è un
 * problema diverso, e lo racconta il conteggio dei rinvii.
 */
export function isStale(
  task: Task,
  { today = todayISO() }: { today?: DayISO } = {},
): boolean {
  if (task.status === "done" || task.status_review === "archived") return false;
  if (task.day !== null || task.first_planned_at !== null) return false;

  const createdDay = task.created_at ? toRomeDay(task.created_at) : null;
  if (!createdDay) return false;

  return createdDay <= addDaysISO(today, -DECAY_DAYS);
}
