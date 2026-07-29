import {
  addDaysISO,
  fmtDuration,
  toRomeDay,
  todayISO,
  type DayISO,
} from "@/lib/time";
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
 * Quante sessioni servono prima di **mostrare la correzione su un task**.
 *
 * Più delle cinque che bastano a calcolare il coefficiente, perché qui il
 * numero non riassume un andamento: contraddice la stima che l'utente ha
 * appena scelto. Per farlo, deve avere ragione.
 */
export const MIN_SESSIONS_TO_SHOW = 10;

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
 * I task in dubbio: mai finiti sul calendario da tre settimane.
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

// ---------------------------------------------------------------------------
// Il tetto realistico della giornata
// ---------------------------------------------------------------------------

/** Il massimo assoluto: sei ore di lavoro profondo sono già molte. */
export const CAP_CEILING = 360;

/**
 * Il tetto per chi non ha ancora storico. Quattro ore, non sei: un utente
 * nuovo non ha idea di quanto riesca a fare, e la prima giornata pianificata
 * troppo piena è anche la prima delusione — quella che fa smettere.
 */
export const CAP_COLD_START = 240;

/**
 * Di quanto si può chiedere più di quello che si è fatto finora.
 *
 * Il 15% è uno strappo, non un salto: abbastanza per crescere, poco perché il
 * piano resti credibile. Senza margine il tetto inseguirebbe la media al
 * ribasso e si stringerebbe da solo giorno per giorno.
 */
export const CAP_STRETCH = 1.15;

export type Cap = {
  minutes: number;
  /** Da cosa deriva: serve a spiegarlo all'utente, non a decorare. */
  source: "storico" | "nuovo" | "impostazioni";
  /** La media su cui si basa, `null` se non c'è. */
  typicalMinutes: number | null;
};

/**
 * Quante ore si possono davvero pianificare in un giorno.
 *
 * La specifica lo dice in una riga — `min(6h, media completata × 1.15)` — ma
 * la parte che conta è **quali giorni entrano nella media**: solo quelli in
 * cui c'era qualcosa in programma. Contare anche le domeniche vuote
 * abbasserebbe la media di chi lavora cinque giorni su sette, e il tetto
 * stringerebbe le giornate lavorative per colpa dei giorni di riposo.
 */
export function realisticCap(
  series: DayTotals[],
  configuredMinutes = CAP_CEILING,
): Cap {
  const worked = series.filter((day) => day.planned > 0);
  const ceiling = Math.min(CAP_CEILING, configuredMinutes);

  if (worked.length < 3) {
    return {
      minutes: Math.min(ceiling, CAP_COLD_START),
      source: "nuovo",
      typicalMinutes: null,
    };
  }

  const typical = Math.round(
    worked.reduce((sum, day) => sum + day.done, 0) / worked.length,
  );

  // Il tetto non scende sotto un'ora: sotto quella soglia non è più un limite
  // realistico, è un'app che si arrende.
  const fromHistory = Math.max(60, Math.round((typical * CAP_STRETCH) / 5) * 5);

  return {
    minutes: Math.min(ceiling, fromHistory),
    source: fromHistory < ceiling ? "storico" : "impostazioni",
    typicalMinutes: typical,
  };
}

/**
 * La frase che spiega il tetto. `null` quando non c'è niente da spiegare —
 * dire «ho pianificato sei ore perché puoi farne sei» è rumore.
 */
export function capExplanation(cap: Cap): string | null {
  if (cap.source === "nuovo") {
    return "Parto da 4h al giorno: quando avrò visto qualche giornata tua, adatterò il tetto a quello che completi davvero.";
  }
  if (cap.source === "storico" && cap.typicalMinutes !== null) {
    return `Ho pianificato al massimo ${fmtDuration(cap.minutes)} al giorno invece di ${fmtDuration(CAP_CEILING)}: ultimamente completi in media ${fmtDuration(cap.typicalMinutes)}.`;
  }
  return null;
}

/**
 * Gli Highlight della settimana: quanti scelti, quanti portati a termine.
 *
 * È la metrica che la specifica chiama «giornata vinta», e vale più del
 * numero totale di task fatti: dodici cose piccole non fanno una settimana
 * riuscita se la cosa che contava è slittata tutti i giorni.
 *
 * Il denominatore è **sette**, non il numero di Highlight scelti: una
 * giornata senza Highlight non è una giornata neutra, è una giornata in cui
 * non si è deciso cosa contava.
 */
export function weeklyHighlights(
  tasks: Task[],
  { from, to }: { from: DayISO; to: DayISO },
): { chosen: number; done: number; days: number } {
  const inWeek = tasks.filter(
    (task) =>
      task.is_daily_highlight &&
      task.highlight_date !== null &&
      task.highlight_date >= from &&
      task.highlight_date <= to,
  );

  return {
    chosen: inWeek.length,
    done: inWeek.filter((task) => task.status === "done").length,
    days: 7,
  };
}
