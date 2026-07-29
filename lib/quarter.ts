import { addDaysISO, diffDaysISO, todayISO, type DayISO } from "@/lib/time";
import { keyResultProgress, type Okr } from "@/lib/types";

/**
 * Aritmetica dei trimestri.
 *
 * Serve a rispondere a una domanda sola, che è il cuore della sezione
 * Obiettivi: **quanto trimestre è passato, rispetto a quanto sei avanzato?**
 * Un obiettivo al 30% a metà trimestre e uno al 30% l'ultima settimana
 * raccontano due storie opposte, e senza questo confronto sembrerebbero
 * identici.
 */

export const QUARTERS = [1, 2, 3, 4] as const;
export type QuarterNumber = (typeof QUARTERS)[number];

/** Gli anni proposti dai selettori. */
export const YEARS = [2026, 2027, 2028, 2029, 2030] as const;

const PATTERN = /^(\d{4})-Q([1-4])$/;

export type ParsedQuarter = { year: number; quarter: QuarterNumber };

export function parseQuarter(value: string): ParsedQuarter | null {
  const match = PATTERN.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    quarter: Number(match[2]) as QuarterNumber,
  };
}

export function formatQuarter(year: number, quarter: QuarterNumber): string {
  return `${year}-Q${quarter}`;
}

export function isQuarter(value: string): boolean {
  return PATTERN.test(value);
}

/** Primo e ultimo giorno del trimestre. */
export function quarterBounds(value: string): { start: DayISO; end: DayISO } {
  const parsed = parseQuarter(value);
  if (!parsed) {
    const fallback = todayISO();
    return { start: fallback, end: fallback };
  }

  const firstMonth = (parsed.quarter - 1) * 3 + 1;
  const start = `${parsed.year}-${String(firstMonth).padStart(2, "0")}-01`;

  // Il giorno prima dell'inizio del trimestre successivo: evita di doversi
  // ricordare quanti giorni ha febbraio, e negli anni bisestili funziona.
  const nextFirstMonth = firstMonth + 3;
  const nextStart =
    nextFirstMonth > 12
      ? `${parsed.year + 1}-01-01`
      : `${parsed.year}-${String(nextFirstMonth).padStart(2, "0")}-01`;

  return { start, end: addDaysISO(nextStart, -1) };
}

export function previousQuarter(value: string): string {
  const parsed = parseQuarter(value);
  if (!parsed) return value;
  return parsed.quarter === 1
    ? formatQuarter(parsed.year - 1, 4)
    : formatQuarter(parsed.year, (parsed.quarter - 1) as QuarterNumber);
}

export function nextQuarter(value: string): string {
  const parsed = parseQuarter(value);
  if (!parsed) return value;
  return parsed.quarter === 4
    ? formatQuarter(parsed.year + 1, 1)
    : formatQuarter(parsed.year, (parsed.quarter + 1) as QuarterNumber);
}

/**
 * Quanta parte del trimestre è trascorsa, da 0 a 1.
 * Zero prima che cominci, uno quando è finito.
 */
export function quarterProgress(
  value: string,
  today: DayISO = todayISO(),
): number {
  const { start, end } = quarterBounds(value);
  const total = diffDaysISO(start, end) + 1;
  if (total <= 0) return 0;

  const elapsed = diffDaysISO(start, today) + 1;
  return Math.min(1, Math.max(0, elapsed / total));
}

/** Quanti giorni restano, zero se è già chiuso. */
export function daysLeftInQuarter(
  value: string,
  today: DayISO = todayISO(),
): number {
  const { end } = quarterBounds(value);
  return Math.max(0, diffDaysISO(today, end));
}

/** L'avanzamento medio dei risultati chiave di un obiettivo, da 0 a 1. */
export function okrProgress(okr: Okr): number {
  if (okr.key_results.length === 0) return 0;
  const total = okr.key_results.reduce(
    (sum, kr) => sum + keyResultProgress(kr),
    0,
  );
  return total / okr.key_results.length;
}

/** L'avanzamento medio di tutti gli obiettivi del trimestre. */
export function averageProgress(okrs: Okr[]): number {
  const withResults = okrs.filter((okr) => okr.key_results.length > 0);
  if (withResults.length === 0) return 0;
  return (
    withResults.reduce((sum, okr) => sum + okrProgress(okr), 0) /
    withResults.length
  );
}

export type Rhythm = {
  /** Frazione di trimestre trascorsa. */
  elapsed: number;
  /** Avanzamento medio dei risultati. */
  progress: number;
  /** Positivo se si è avanti, negativo se indietro. */
  gap: number;
  status: "avanti" | "in-linea" | "indietro";
  message: string;
};

/** Oltre questo scarto vale la pena dirlo. Sotto, è rumore di calendario. */
const NOTABLE_GAP = 0.1;

/**
 * Il confronto fra tempo trascorso e avanzamento reale.
 *
 * Il messaggio è deliberatamente asciutto: serve a far vedere un fatto, non a
 * far sentire in colpa. Un obiettivo indietro a metà trimestre è ancora
 * recuperabile, e dirlo è più utile che rimproverarlo.
 */
export function rhythmOf(
  okrs: Okr[],
  quarter: string,
  today: DayISO = todayISO(),
): Rhythm {
  const elapsed = quarterProgress(quarter, today);
  const progress = averageProgress(okrs);
  const gap = progress - elapsed;

  const elapsedPct = Math.round(elapsed * 100);
  const progressPct = Math.round(progress * 100);
  const gapPct = Math.round(Math.abs(gap) * 100);

  if (gap < -NOTABLE_GAP) {
    const left = daysLeftInQuarter(quarter, today);
    return {
      elapsed,
      progress,
      gap,
      status: "indietro",
      message:
        left > 0
          ? `Il trimestre è al ${elapsedPct}%, i risultati al ${progressPct}%: sei indietro di ${gapPct} punti, con ${left} giorni davanti.`
          : `Il trimestre è finito con i risultati al ${progressPct}%.`,
    };
  }

  if (gap > NOTABLE_GAP) {
    return {
      elapsed,
      progress,
      gap,
      status: "avanti",
      message: `Il trimestre è al ${elapsedPct}% e i risultati al ${progressPct}%: sei avanti di ${gapPct} punti.`,
    };
  }

  return {
    elapsed,
    progress,
    gap,
    status: "in-linea",
    message: `Trimestre al ${elapsedPct}%, risultati al ${progressPct}%: sei in linea.`,
  };
}
