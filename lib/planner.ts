import { correctedEstimate } from "@/lib/calibration";
import {
  addDaysISO,
  fmtRelativeDay,
  freeGaps,
  parseHHMM,
  SLOT,
  snapUp,
  type DayISO,
  type MinuteRange,
} from "@/lib/time";
import type { Energy, Task } from "@/lib/types";

/**
 * Il solver che colloca i blocchi.
 *
 * **L'AI non calcola gli orari.** Sceglie *quali* task e in *che ordine*; dove
 * finiscono lo decide questo codice. È una separazione voluta: la specifica
 * chiama quei vincoli «rigidi, mai violabili», e un modello linguistico che fa
 * aritmetica su finestre, buffer e tetti giornalieri prima o poi sbaglia in
 * modo plausibile — cioè nel modo peggiore, perché sembra giusto. Qui invece
 * è aritmetica verificabile, e infatti è coperta dai test.
 */

export type PlannerSettings = {
  workStart: number;
  workEnd: number;
  bufferMinutes: number;
  dailyCapMinutes: number;
  peakStart: number | null;
  peakEnd: number | null;
  lowStart: number | null;
  lowEnd: number | null;
};

export type DayContext = {
  day: DayISO;
  /** Impegni già presenti: blocchi fissi, eventi Google, task già pianificati. */
  busy: MinuteRange[];
  /** Minuti già pianificati quel giorno, che erodono il tetto giornaliero. */
  usedMinutes: number;
};

export type Placement = {
  taskId: string;
  day: DayISO;
  startMinute: number;
  estMinutes: number;
  /** La stima originale, prima della correzione dalla realtà. */
  originalMinutes: number;
  reason: string;
};

export type PlanResult = {
  placements: Placement[];
  /** Task che non è stato possibile collocare, con il perché. */
  unplaced: Array<{ taskId: string; reason: string }>;
};

/** Converte `09:00:00` in minuti; `null` se l'orario non è impostato. */
export function timeToMinutes(value: string | null): number | null {
  if (!value) return null;
  return parseHHMM(value.slice(0, 5));
}

/**
 * Quanto pesa un task nella scelta. Più alto, prima viene collocato.
 *
 * L'ordine è quello della specifica: highlight del giorno, poi scadenze
 * imminenti, poi i risultati chiave più indietro, poi i più rinviati.
 */
export function priorityOf(
  task: Task,
  options: {
    today: DayISO;
    /** Progetti legati a un OKR indietro, che meritano una spinta. */
    boostedProjects?: Set<string>;
  },
): number {
  let score = 0;

  if (task.is_daily_highlight) score += 1000;

  if (task.deadline) {
    // Una scadenza fra due giorni pesa più di una fra due settimane, e una
    // già scaduta più di tutte.
    const days = daysBetween(options.today, task.deadline);
    score += Math.max(0, 300 - days * 20);
  }

  if (task.project_id && options.boostedProjects?.has(task.project_id)) {
    score += 120;
  }

  // Ogni rinvio aggiunge peso: è il modo in cui il sistema smette di far
  // scivolare all'infinito le stesse cose.
  score += Math.min(200, task.postpone_count * 40);

  return score;
}

function daysBetween(from: DayISO, to: DayISO): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * La finestra preferita per un livello di energia: le ore di picco per i task
 * pesanti, quelle di calo per i leggeri. È una preferenza, non un vincolo —
 * meglio un blocco fuori fascia che un blocco mai pianificato.
 */
function preferredWindow(
  energy: Energy | null,
  settings: PlannerSettings,
): MinuteRange | null {
  if (energy === "alta" && settings.peakStart !== null && settings.peakEnd !== null) {
    return { start: settings.peakStart, end: settings.peakEnd };
  }
  if (energy === "bassa" && settings.lowStart !== null && settings.lowEnd !== null) {
    return { start: settings.lowStart, end: settings.lowEnd };
  }
  return null;
}

/**
 * Gli spazi liberi di una giornata, già scontati del buffer.
 *
 * Gli impegni si allargano di `bufferMinutes` da entrambi i lati prima di
 * ritagliare i buchi: così un blocco collocato all'inizio di un buco parte
 * comunque a distanza di sicurezza dal precedente, senza doversene ricordare
 * al momento di piazzarlo.
 */
export function availableGaps(
  window: MinuteRange,
  busy: MinuteRange[],
  bufferMinutes: number,
): MinuteRange[] {
  const padded = busy.map((range) => ({
    start: range.start - bufferMinutes,
    end: range.end + bufferMinutes,
  }));
  return freeGaps(window, padded).filter((gap) => gap.end > gap.start);
}

/** Il primo inizio utile dentro i buchi, preferendo la finestra indicata. */
function findStart(
  gaps: MinuteRange[],
  duration: number,
  preferred: MinuteRange | null,
): number | null {
  const fits = (gap: MinuteRange, from: number) => {
    // Verso l'alto, non al più vicino: arrotondare per difetto porterebbe
    // l'inizio *prima* del buco, e un buco che comincia alle 10:40 — capita
    // appena il buffer non è multiplo dello slot — verrebbe scartato invece
    // che usato dalle 10:45.
    const start = snapUp(Math.max(gap.start, from), SLOT);
    return start + duration <= gap.end ? start : null;
  };

  if (preferred) {
    for (const gap of gaps) {
      const start = fits(gap, preferred.start);
      // Deve cominciare dentro la fascia preferita, non solo sfiorarla.
      if (start !== null && start < preferred.end) return start;
    }
  }

  for (const gap of gaps) {
    const start = fits(gap, gap.start);
    if (start !== null) return start;
  }

  return null;
}

/**
 * Distribuisce i task sui giorni indicati, uno dopo l'altro.
 *
 * Il tetto giornaliero è un **massimo, non un obiettivo**: se una giornata si
 * chiude bene in quattro ore, il solver non la riempie fino a sei.
 */
export function planDays({
  tasks,
  days,
  settings,
  coefficient,
  today,
  boostedProjects,
}: {
  /** Già filtrati e nell'ordine in cui vanno considerati, se l'ha scelto l'utente. */
  tasks: Task[];
  days: DayContext[];
  settings: PlannerSettings;
  coefficient: number | null;
  today: DayISO;
  boostedProjects?: Set<string>;
}): PlanResult {
  const window: MinuteRange = {
    start: settings.workStart,
    end: settings.workEnd,
  };

  // Stato mutabile per giorno, così i blocchi appena collocati diventano
  // subito ostacoli per quelli dopo.
  const state = days.map((context) => ({
    day: context.day,
    busy: context.busy.slice(),
    used: context.usedMinutes,
  }));

  const ordered = tasks
    .slice()
    .sort(
      (a, b) =>
        priorityOf(b, { today, boostedProjects }) -
        priorityOf(a, { today, boostedProjects }),
    );

  const placements: Placement[] = [];
  const unplaced: PlanResult["unplaced"] = [];

  for (const task of ordered) {
    const original = task.est_minutes ?? 30;
    const duration = correctedEstimate(original, coefficient);
    let placed = false;

    for (const day of state) {
      if (day.used + duration > settings.dailyCapMinutes) continue;

      const gaps = availableGaps(window, day.busy, settings.bufferMinutes);
      const start = findStart(
        gaps,
        duration,
        preferredWindow(task.energy, settings),
      );
      if (start === null) continue;

      placements.push({
        taskId: task.id,
        day: day.day,
        startMinute: start,
        estMinutes: duration,
        originalMinutes: original,
        reason: reasonFor(task, coefficient, original, duration, today),
      });

      day.busy.push({ start, end: start + duration });
      day.used += duration;
      placed = true;
      break;
    }

    if (!placed) {
      unplaced.push({
        taskId: task.id,
        reason:
          state.length === 0
            ? "Nessun giorno selezionato."
            : "Non c'è spazio nei giorni scelti senza sforare i tuoi limiti.",
      });
    }
  }

  return { placements, unplaced };
}

function reasonFor(
  task: Task,
  coefficient: number | null,
  original: number,
  corrected: number,
  today: DayISO,
): string {
  const parts: string[] = [];
  if (task.is_daily_highlight) parts.push("è l'highlight del giorno");
  // «scade domani» invece di «scade il 2026-07-31»: qui si legge di sfuggita.
  if (task.deadline) parts.push(`scade ${fmtRelativeDay(task.deadline, today)}`);
  if (task.postpone_count >= 2) {
    parts.push(`rinviato ${task.postpone_count} volte`);
  }
  if (coefficient !== null && corrected !== original) {
    parts.push(`stima corretta da ${original} a ${corrected} minuti`);
  }
  return parts.length > 0 ? parts.join(", ") : "spazio disponibile";
}

/** I giorni su cui distribuire, a partire da oggi. */
export function planningDays(from: DayISO, count: number): DayISO[] {
  return Array.from({ length: Math.min(7, Math.max(1, count)) }, (_, i) =>
    addDaysISO(from, i),
  );
}
