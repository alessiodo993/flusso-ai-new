import type { Json, Tables, Views } from "@/lib/supabase/database.types";
import { uid } from "@/lib/utils";

/**
 * Tipi di dominio.
 *
 * Le righe che arrivano dal database hanno `text` dove noi vogliamo un'unione
 * e `Json` dove vogliamo una forma precisa. Qui le restringiamo una volta
 * sola, all'ingresso, così il resto dell'app non deve più dubitarne.
 */

// ---------------------------------------------------------------------------
// Unioni
// ---------------------------------------------------------------------------

export const ENERGIES = ["alta", "media", "bassa"] as const;
export type Energy = (typeof ENERGIES)[number];

export const TASK_STATUSES = ["inbox", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_REVIEWS = ["active", "stale", "archived"] as const;
export type StatusReview = (typeof STATUS_REVIEWS)[number];

export const FOCUS_OUTCOMES = [
  "completed",
  "partial",
  "abandoned",
  "extended",
] as const;
export type FocusOutcome = (typeof FOCUS_OUTCOMES)[number];

export const REVIEW_TYPES = ["kickoff", "shutdown"] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

export const FREQUENCIES = ["daily", "weekly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Etichette da mostrare: l'interfaccia è in italiano, i valori nel DB anche. */
export const ENERGY_LABEL: Record<Energy, string> = {
  alta: "Alta",
  media: "Media",
  bassa: "Bassa",
};

// ---------------------------------------------------------------------------
// Strutture dentro le colonne jsonb
// ---------------------------------------------------------------------------

export type Subtask = {
  id: string;
  text: string;
  done: boolean;
  /** Un sottotask può scadere prima del task che lo contiene. */
  deadline?: string | null;
};

export type KeyResult = {
  id: string;
  text: string;
  current: number;
  target: number;
  unit: string;
};

// ---------------------------------------------------------------------------
// Entità
// ---------------------------------------------------------------------------

export type Project = Tables<"projects">;

export type Idea = Tables<"ideas">;

export type Task = Omit<
  Tables<"tasks">,
  "status" | "status_review" | "energy" | "subtasks"
> & {
  status: TaskStatus;
  status_review: StatusReview;
  energy: Energy | null;
  subtasks: Subtask[];
};

export type Okr = Omit<Tables<"okrs">, "key_results"> & {
  key_results: KeyResult[];
};

export type FocusSession = Omit<Tables<"focus_sessions">, "outcome"> & {
  outcome: FocusOutcome | null;
};

export type DailyReview = Omit<Tables<"daily_reviews">, "type"> & {
  type: ReviewType;
};

export type Recurring = Omit<
  Tables<"recurring">,
  "freq" | "energy" | "subtasks"
> & {
  freq: Frequency;
  energy: Energy | null;
  subtasks: Subtask[];
};

export type FixedBlock = Tables<"blocks">;

export type GoogleAccount = Views<"google_accounts_public">;
export type GoogleCalendar = Tables<"google_calendars">;
export type GoogleEvent = Tables<"google_events">;

export type UserSettings = Tables<"user_settings">;

// ---------------------------------------------------------------------------
// Normalizzazione all'ingresso
// ---------------------------------------------------------------------------

function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function optionalOneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * I sottotask arrivano come `Json`. Un record malformato non deve far saltare
 * la lista: le voci illeggibili si scartano, quelle parziali si completano.
 */
export function parseSubtasks(value: Json): Subtask[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): Subtask[] => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, Json | undefined>;
    const text = typeof record.text === "string" ? record.text : "";
    if (!text.trim()) return [];

    return [
      {
        id: typeof record.id === "string" ? record.id : uid(),
        text,
        done: record.done === true,
        deadline:
          typeof record.deadline === "string" ? record.deadline : null,
      },
    ];
  });
}

/** Come sopra, per i key result: senza un target il progresso non è calcolabile. */
export function parseKeyResults(value: Json): KeyResult[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): KeyResult[] => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, Json | undefined>;
    const text = typeof record.text === "string" ? record.text : "";
    if (!text.trim()) return [];

    const target = Number(record.target);
    const current = Number(record.current);

    return [
      {
        id: typeof record.id === "string" ? record.id : uid(),
        text,
        current: Number.isFinite(current) ? current : 0,
        target: Number.isFinite(target) && target !== 0 ? target : 1,
        unit: typeof record.unit === "string" ? record.unit : "",
      },
    ];
  });
}

export function toTask(row: Tables<"tasks">): Task {
  return {
    ...row,
    status: oneOf(TASK_STATUSES, row.status, "inbox"),
    status_review: oneOf(STATUS_REVIEWS, row.status_review, "active"),
    energy: optionalOneOf(ENERGIES, row.energy),
    subtasks: parseSubtasks(row.subtasks),
  };
}

export function toOkr(row: Tables<"okrs">): Okr {
  return { ...row, key_results: parseKeyResults(row.key_results) };
}

export function toFocusSession(row: Tables<"focus_sessions">): FocusSession {
  return { ...row, outcome: optionalOneOf(FOCUS_OUTCOMES, row.outcome) };
}

export function toDailyReview(row: Tables<"daily_reviews">): DailyReview {
  return { ...row, type: oneOf(REVIEW_TYPES, row.type, "kickoff") };
}

export function toRecurring(row: Tables<"recurring">): Recurring {
  return {
    ...row,
    freq: oneOf(FREQUENCIES, row.freq, "weekly"),
    energy: optionalOneOf(ENERGIES, row.energy),
    subtasks: parseSubtasks(row.subtasks),
  };
}

// ---------------------------------------------------------------------------
// Predicati di dominio, usati ovunque
// ---------------------------------------------------------------------------

/** Un task è pianificato quando ha un giorno e un orario di inizio. */
export function isScheduled(
  task: Task,
): task is Task & { day: string; start_minute: number; est_minutes: number } {
  return (
    task.day !== null &&
    task.start_minute !== null &&
    task.est_minutes !== null
  );
}

/** Il minuto in cui finisce un blocco pianificato. */
export function taskEnd(task: Task): number | null {
  if (task.start_minute === null || task.est_minutes === null) return null;
  return task.start_minute + task.est_minutes;
}

export function isDone(task: Task): boolean {
  return task.status === "done";
}

/** Quanti sottotask sono spuntati, per il contatore `3/5` sulla card. */
export function subtaskProgress(task: Task): { done: number; total: number } {
  return {
    done: task.subtasks.filter((s) => s.done).length,
    total: task.subtasks.length,
  };
}

/** L'avanzamento di un key result, limitato a 1 anche se lo si è superato. */
export function keyResultProgress(kr: KeyResult): number {
  if (kr.target === 0) return 0;
  return Math.min(1, Math.max(0, kr.current / kr.target));
}

/** Il key result più indietro: quello che il prossimo blocco dovrebbe muovere. */
export function leastAdvancedKeyResult(okr: Okr): KeyResult | null {
  if (okr.key_results.length === 0) return null;
  return okr.key_results.reduce((worst, kr) =>
    keyResultProgress(kr) < keyResultProgress(worst) ? kr : worst,
  );
}

/** Passo dei pulsanti `−` / `+` su un key result. */
export function keyResultStep(kr: KeyResult): number {
  return Math.max(1, Math.round(kr.target / 20));
}
