import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { it } from "date-fns/locale";

/**
 * Regole temporali di Flusso, non negoziabili:
 * - il fuso è SEMPRE Europe/Rome, mai quello del browser;
 * - un giorno è una stringa `YYYY-MM-DD`;
 * - un orario è un intero di minuti dalla mezzanotte (0–1439).
 * Nessun oggetto Date finisce nello state o nel database per gli slot.
 */
export const TZ = "Europe/Rome";

/** Granularità minima di uno slot di calendario, in minuti. */
export const SLOT = 15;

/** Minuti in un giorno. */
export const DAY_MINUTES = 1440;

/** Un giorno nel formato `YYYY-MM-DD`. */
export type DayISO = string;

/** Intervallo di minuti dalla mezzanotte, `end` escluso. */
export type MinuteRange = { start: number; end: number };

// ---------------------------------------------------------------------------
// Adesso, a Roma
// ---------------------------------------------------------------------------

/**
 * L'istante corrente espresso con i campi locali di Roma: `getHours()` e simili
 * restituiscono l'ora romana anche se il server sta in UTC. Da usare solo per
 * leggere i campi, mai da serializzare.
 */
export function nowRome(): Date {
  return toZonedTime(new Date(), TZ);
}

/** Il giorno corrente a Roma. */
export function todayISO(): DayISO {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

/** Il giorno romano in cui cade un istante. */
export function toRomeDay(date: Date | string | number): DayISO {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM-dd");
}

/** I minuti dalla mezzanotte romana in cui cade un istante. */
export function toRomeMinute(date: Date | string | number): number {
  const hhmm = formatInTimeZone(new Date(date), TZ, "HH:mm");
  return parseHHMM(hhmm) ?? 0;
}

/** I minuti dalla mezzanotte romana in questo momento. */
export function nowMinutes(): number {
  return toRomeMinute(new Date());
}

// ---------------------------------------------------------------------------
// Conversioni giorno + minuto <-> istante
// ---------------------------------------------------------------------------

/**
 * L'istante UTC corrispondente a un orario romano. Gestisce correttamente i
 * cambi di ora legale perché delega a `fromZonedTime`.
 */
export function romeInstant(day: DayISO, minute: number): Date {
  const m = clampMinute(minute);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return fromZonedTime(`${day}T${hh}:${mm}:00`, TZ);
}

/** Da un istante alla coppia giorno + minuto romani. */
export function toRomeSlot(date: Date | string | number): {
  day: DayISO;
  minute: number;
} {
  return { day: toRomeDay(date), minute: toRomeMinute(date) };
}

// ---------------------------------------------------------------------------
// Aritmetica sui giorni — calcolata in UTC, quindi immune all'ora legale
// ---------------------------------------------------------------------------

function dayToUTC(day: DayISO): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function utcToDay(date: Date): DayISO {
  return date.toISOString().slice(0, 10);
}

/** Vero se la stringa è un giorno `YYYY-MM-DD` valido. */
export function isDayISO(value: unknown): value is DayISO {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return utcToDay(dayToUTC(value)) === value;
}

/** Somma (o sottrae) giorni di calendario. */
export function addDaysISO(day: DayISO, amount: number): DayISO {
  const d = dayToUTC(day);
  d.setUTCDate(d.getUTCDate() + amount);
  return utcToDay(d);
}

/** Giorni di distanza fra due date: `to - from`. Negativo se `to` è passato. */
export function diffDaysISO(from: DayISO, to: DayISO): number {
  const ms = dayToUTC(to).getTime() - dayToUTC(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Giorno della settimana: 0 = domenica … 6 = sabato (convenzione JS). */
export function dowOf(day: DayISO): number {
  return dayToUTC(day).getUTCDay();
}

/** Il lunedì della settimana che contiene `day`. */
export function startOfWeekISO(day: DayISO): DayISO {
  const dow = dowOf(day);
  return addDaysISO(day, dow === 0 ? -6 : 1 - dow);
}

/** I sette giorni della settimana che contiene `day`, da lunedì a domenica. */
export function weekDaysISO(day: DayISO): DayISO[] {
  const monday = startOfWeekISO(day);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

/** `n` giorni consecutivi a partire da `day` incluso. */
export function nextDaysISO(day: DayISO, n: number): DayISO[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDaysISO(day, i));
}

/** Il trimestre di un giorno, nel formato `2026-Q3`. */
export function quarterOf(day: DayISO): string {
  const [y, m] = day.split("-").map(Number);
  return `${y}-Q${Math.floor(((m ?? 1) - 1) / 3) + 1}`;
}

// ---------------------------------------------------------------------------
// Minuti
// ---------------------------------------------------------------------------

/** Riporta un minuto dentro l'intervallo valido di una giornata. */
export function clampMinute(minute: number): number {
  if (!Number.isFinite(minute)) return 0;
  return Math.min(DAY_MINUTES - 1, Math.max(0, Math.round(minute)));
}

/** `fmtMin(480) === "08:00"`. Oltre la mezzanotte resta su 24:00. */
export function fmtMin(minute: number): string {
  const m = Math.min(DAY_MINUTES, Math.max(0, Math.round(minute)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** `parseHHMM("08:30") === 510`. Restituisce null se il formato non è valido. */
export function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

/** Arrotonda al passo più vicino (default: uno slot da 15 minuti). */
export function snap(minute: number, step: number = SLOT): number {
  const s = step > 0 ? step : SLOT;
  return Math.round(minute / s) * s;
}

/** Arrotonda per difetto al passo indicato. */
export function snapDown(minute: number, step: number = SLOT): number {
  const s = step > 0 ? step : SLOT;
  return Math.floor(minute / s) * s;
}

/** Arrotonda per eccesso al passo indicato. */
export function snapUp(minute: number, step: number = SLOT): number {
  const s = step > 0 ? step : SLOT;
  return Math.ceil(minute / s) * s;
}

/** Vero se i due intervalli si sovrappongono: gli estremi che si toccano no. */
export function overlaps(a: MinuteRange, b: MinuteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Minuti di sovrapposizione fra due intervalli, 0 se sono disgiunti. */
export function overlapMinutes(a: MinuteRange, b: MinuteRange): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Vero se `inner` sta interamente dentro `outer`. */
export function contains(outer: MinuteRange, inner: MinuteRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/**
 * Sottrae gli intervalli occupati da una finestra e restituisce i buchi
 * rimasti, ordinati. È la base del calcolo degli slot liberi del planner.
 */
export function freeGaps(
  window: MinuteRange,
  busy: MinuteRange[],
): MinuteRange[] {
  const sorted = busy
    .filter((b) => overlaps(window, b))
    .sort((a, b) => a.start - b.start);

  const gaps: MinuteRange[] = [];
  let cursor = window.start;

  for (const block of sorted) {
    if (block.start > cursor) gaps.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
    if (cursor >= window.end) break;
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });

  return gaps;
}

// ---------------------------------------------------------------------------
// Formattazione in italiano
// ---------------------------------------------------------------------------

/** `fmtDuration(80) === "1h 20m"`. */
export function fmtDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** L'intervallo di un blocco: `"09:00–10:30"`. */
export function fmtRange(range: MinuteRange): string {
  return `${fmtMin(range.start)}–${fmtMin(range.end)}`;
}

/** Etichetta compatta di un giorno: `"gio 4 giu"`. */
export function fmtDayShort(day: DayISO): string {
  return formatInTimeZone(dayToUTC(day), "UTC", "EEE d MMM", { locale: it });
}

/** Etichetta estesa di un giorno: `"giovedì 4 giugno"`. */
export function fmtDayLong(day: DayISO): string {
  return formatInTimeZone(dayToUTC(day), "UTC", "EEEE d MMMM", { locale: it });
}

/** Iniziale del giorno della settimana, per la striscia dei giorni. */
export function fmtDayLetter(day: DayISO): string {
  return formatInTimeZone(dayToUTC(day), "UTC", "EEEEE", {
    locale: it,
  }).toUpperCase();
}

/** Numero del giorno nel mese. */
export function fmtDayNumber(day: DayISO): string {
  return formatInTimeZone(dayToUTC(day), "UTC", "d");
}

/**
 * Come si dice una scadenza a voce: "oggi", "domani", "fra 3 giorni",
 * "2 giorni fa". Oltre la settimana passa alla data compatta.
 */
export function fmtRelativeDay(day: DayISO, from: DayISO = todayISO()): string {
  const delta = diffDaysISO(from, day);
  if (delta === 0) return "oggi";
  if (delta === 1) return "domani";
  if (delta === -1) return "ieri";
  if (delta === 2) return "dopodomani";
  if (delta > 0 && delta <= 7) return `fra ${delta} giorni`;
  if (delta < 0 && delta >= -7) return `${-delta} giorni fa`;
  return fmtDayShort(day);
}

/** Urgenza di una scadenza, usata per il semaforo delle chip. */
export type DeadlineTone = "overdue" | "soon" | "later";

/**
 * Rosso se scaduta o in giornata, ambra entro due giorni, neutro oltre.
 * Vedi §6.2: la chip scadenza deve essere leggibile senza aprire il task.
 */
export function deadlineTone(
  deadline: DayISO,
  from: DayISO = todayISO(),
): DeadlineTone {
  const delta = diffDaysISO(from, deadline);
  if (delta <= 0) return "overdue";
  if (delta <= 2) return "soon";
  return "later";
}
