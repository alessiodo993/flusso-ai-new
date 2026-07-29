"use client";

import { useMutation } from "@tanstack/react-query";

import type { AiErrorKind } from "@/lib/ai/client";
import type { CaptureProposal, KeyResultAnalysis } from "@/lib/ai/schemas";
import type { DayISO } from "@/lib/time";

/**
 * Il lato client delle chiamate AI.
 *
 * Nessuna di queste mutation scrive niente: restituiscono proposte. Le
 * scritture partono dagli hook di dominio — `useTasks`, `useOkrs` — solo dopo
 * che l'utente ha confermato la revisione. È la regola che tiene in piedi
 * «nessuna scrittura AI senza conferma umana»: se la scrittura la facesse
 * questo file, la conferma sarebbe una cortesia dell'interfaccia invece che
 * un fatto dell'architettura.
 */

export class AiRequestError extends Error {
  readonly kind: AiErrorKind;

  constructor(message: string, kind: AiErrorKind) {
    super(message);
    this.name = "AiRequestError";
    this.kind = kind;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiRequestError(
      "Connessione assente: quello che hai scritto è ancora qui, riprova appena torni online.",
      "unknown",
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    errore?: string;
    tipo?: AiErrorKind;
  } | null;

  if (!response.ok) {
    throw new AiRequestError(
      payload?.errore ?? "Richiesta all'AI non riuscita.",
      payload?.tipo ?? "unknown",
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------

export function useAiCapture() {
  return useMutation({
    mutationFn: (testo: string) =>
      post<{ proposte: CaptureProposal[] }>("/api/ai/capture", { testo }),
  });
}

export type PlanChoice = { taskId: string; motivo: string };

export function useAiPlan() {
  return useMutation({
    mutationFn: (input: {
      giorni: DayISO[];
      minutiDisponibili: number;
      coefficiente: number | null;
      progettiIndietro: string[];
    }) => post<{ scelte: PlanChoice[]; nota: string }>("/api/ai/plan", input),
  });
}

export function useAiOkrAnalysis() {
  return useMutation({
    mutationFn: (okrId: string) =>
      post<{ analisi: KeyResultAnalysis[]; commento: string }>("/api/ai/okr", {
        okrId,
      }),
  });
}

export type ShutdownSuggestion = {
  taskId: string;
  startMinute: number;
  motivo: string;
};

export function useAiShutdown() {
  return useMutation({
    mutationFn: (input: {
      domani: DayISO;
      taskIds: string[];
      slotLiberi: string[];
    }) =>
      post<{ suggerimenti: ShutdownSuggestion[]; commento: string }>(
        "/api/ai/shutdown",
        input,
      ),
  });
}
