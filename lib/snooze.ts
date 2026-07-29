import type { DayISO } from "@/lib/time";

/**
 * I micro-rinvii: quante volte si è premuto «Rimanda 15 min» su un blocco.
 *
 * Sono una cosa diversa dai rinvii veri, e per questo non stanno nel
 * database. Rimandare di un quarto d'ora è legittimo — si finisce la
 * telefonata, si arriva in ufficio — e non deve sporcare il contatore che fa
 * scattare il dialogo del terzo rinvio.
 *
 * Ma legittimo due volte, non infinite. Alla terza il quarto d'ora non è più
 * un imprevisto, è il modo in cui si rimanda una giornata quindici minuti per
 * volta: da lì la notifica smette di offrirlo e chiede una decisione.
 */

/** Quante volte si può rimandare di un quarto d'ora lo stesso blocco in un giorno. */
export const MAX_SNOOZES = 2;

/** Di quanto sposta un micro-rinvio. */
export const SNOOZE_MINUTES = 15;

/** Il conteggio, per giorno e per task. */
export type SnoozeLog = Record<DayISO, Record<string, number>>;

export function snoozesUsed(
  log: SnoozeLog,
  day: DayISO,
  taskId: string,
): number {
  return log[day]?.[taskId] ?? 0;
}

export function canSnooze(log: SnoozeLog, day: DayISO, taskId: string): boolean {
  return snoozesUsed(log, day, taskId) < MAX_SNOOZES;
}

/**
 * Registra un micro-rinvio.
 *
 * Tiene solo il giorno che riceve il conteggio: le giornate passate non
 * servono a nessuno, e senza questa potatura il registro crescerebbe per
 * sempre in un posto — il `localStorage` — che nessuno svuota mai.
 */
export function withSnooze(
  log: SnoozeLog,
  day: DayISO,
  taskId: string,
): SnoozeLog {
  const ofDay = log[day] ?? {};
  return {
    [day]: { ...ofDay, [taskId]: (ofDay[taskId] ?? 0) + 1 },
  };
}

/**
 * Azzera il conteggio di un task.
 *
 * Lo chiama il micro-avvio quando finisce: chi ha lavorato dieci minuti su una
 * cosa si è guadagnato di poterla rimandare ancora. È l'incentivo scritto nel
 * codice — cominciare *ripulisce*, rimandare *consuma*.
 */
export function withoutSnoozes(
  log: SnoozeLog,
  day: DayISO,
  taskId: string,
): SnoozeLog {
  const ofDay = { ...(log[day] ?? {}) };
  delete ofDay[taskId];
  return { [day]: ofDay };
}

// ---------------------------------------------------------------------------
// Persistenza
// ---------------------------------------------------------------------------

const KEY = "flusso:micro-rinvii";

export function readSnoozeLog(): SnoozeLog {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    // Registro illeggibile: si riparte da zero. Perdere questo conteggio
    // costa un micro-rinvio in più, non un dato dell'utente.
    return {};
  }
}

export function writeSnoozeLog(log: SnoozeLog): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Spazio esaurito o modalità privata: pazienza.
  }
}
