import { z } from "zod";

import { ENERGIES, type Energy } from "@/lib/types";

/**
 * Gli schemi degli output del modello.
 *
 * **Schemi piatti, senza vincoli.** Niente `.min()`, `.max()`, enum lunghi o
 * annidamenti profondi: un vincolo dentro lo schema trasforma una risposta
 * quasi giusta — energia `"molto alta"`, stima di 900 minuti — in un errore
 * secco, e all'utente tocca riscrivere tutto. I limiti si dichiarano nel
 * prompt e si fanno rispettare qui sotto, clampando invece di rifiutare.
 */

// ---------------------------------------------------------------------------
// Cattura magica
// ---------------------------------------------------------------------------

const captureItem = z.object({
  azione: z.string(),
  titolo: z.string().nullish(),
  taskId: z.string().nullish(),
  progetto: z.string().nullish(),
  scadenza: z.string().nullish(),
  stimaMinuti: z.number().nullish(),
  energia: z.string().nullish(),
  sottotask: z.array(z.string()).nullish(),
  note: z.string().nullish(),
  motivo: z.string().nullish(),
});

export const captureSchema = z.object({
  proposte: z.array(captureItem).nullish(),
});

export type CaptureAction = "crea" | "unisci" | "completa" | "elimina";

export type CaptureProposal = {
  /** Identificativo locale, per accettare o rifiutare la singola proposta. */
  id: string;
  action: CaptureAction;
  title: string;
  /** Il task esistente coinvolto: da unire, completare o eliminare. */
  taskId: string | null;
  projectId: string | null;
  deadline: string | null;
  estMinutes: number | null;
  energy: Energy | null;
  subtasks: string[];
  notes: string;
  /** Perché l'AI propone questo: mostrato all'utente, mai salvato. */
  reason: string;
};

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export const planSchema = z.object({
  scelte: z
    .array(
      z.object({
        taskId: z.string(),
        motivo: z.string().nullish(),
      }),
    )
    .nullish(),
  /** Il modello può dire che qualcosa non torna: lo mostriamo com'è. */
  nota: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Analisi dei risultati chiave
// ---------------------------------------------------------------------------

export const okrSchema = z.object({
  analisi: z
    .array(
      z.object({
        keyResultId: z.string(),
        misurabile: z.boolean().nullish(),
        problema: z.string().nullish(),
        riformulazione: z.string().nullish(),
      }),
    )
    .nullish(),
  commento: z.string().nullish(),
});

export type KeyResultAnalysis = {
  keyResultId: string;
  measurable: boolean;
  problem: string;
  rewrite: string | null;
};

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

export const shutdownSchema = z.object({
  suggerimenti: z
    .array(
      z.object({
        taskId: z.string(),
        oraInizio: z.string().nullish(),
        motivo: z.string().nullish(),
      }),
    )
    .nullish(),
  commento: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Normalizzazione: qui si fanno rispettare i limiti dichiarati nel prompt
// ---------------------------------------------------------------------------

/** Massimo di proposte accettate da una sola cattura. */
export const MAX_PROPOSALS = 12;

/**
 * Quanto testo può entrare in una cattura sola.
 *
 * Lo conoscono sia la route sia il campo di testo: se lo sapesse solo il
 * server, una dettatura lunga si scoprirebbe troppo lunga **dopo** averla
 * fatta, con un errore invece che con un limite visibile.
 */
export const MAX_CAPTURE_CHARS = 4000;

/** Estremi di una stima, in minuti. */
export const MIN_EST = 5;
export const MAX_EST = 480;

const ACTIONS: Record<string, CaptureAction> = {
  crea: "crea",
  creare: "crea",
  nuovo: "crea",
  unisci: "unisci",
  merge: "unisci",
  completa: "completa",
  completare: "completa",
  fatto: "completa",
  elimina: "elimina",
  eliminare: "elimina",
  cancella: "elimina",
};

/** L'azione richiesta, `crea` se il modello ha inventato un verbo suo. */
export function toAction(value: string | null | undefined): CaptureAction {
  return ACTIONS[(value ?? "").trim().toLowerCase()] ?? "crea";
}

/** Un livello di energia valido, `null` se non lo è. */
export function toEnergy(value: string | null | undefined): Energy | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return (ENERGIES as readonly string[]).includes(normalized)
    ? (normalized as Energy)
    : null;
}

/** Una stima dentro i limiti, arrotondata a cinque minuti. */
export function toEstimate(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const rounded = Math.round(value / 5) * 5;
  return Math.min(MAX_EST, Math.max(MIN_EST, rounded));
}

/** Una data `YYYY-MM-DD` che esiste davvero: il 31 febbraio non passa. */
export function toDeadline(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === raw ? raw : null;
}

/** Testo ripulito e accorciato: i titoli lunghi rompono le card. */
export function toText(
  value: string | null | undefined,
  maxLength: number,
): string {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
    : trimmed;
}
