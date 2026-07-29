"use client";

import { AlertTriangle, CreditCard, Hourglass, RefreshCw } from "lucide-react";

import { AiRequestError } from "@/lib/hooks/use-ai";

/**
 * Come si mostra un errore dell'AI.
 *
 * Distinguere i casi non è pedanteria: aspettare, ricaricare il credito e
 * riprovare sono tre reazioni diverse, e un unico «qualcosa è andato storto»
 * lascia l'utente a indovinare quale. Quello che aveva scritto resta dov'è,
 * sempre: questo riquadro non sostituisce mai il campo di testo.
 */
export function AiErrorNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  if (!error) return null;

  const kind = error instanceof AiRequestError ? error.kind : "unknown";
  const message =
    error instanceof Error ? error.message : "Richiesta non riuscita.";

  const Icon =
    kind === "rate_limit"
      ? Hourglass
      : kind === "credit"
        ? CreditCard
        : AlertTriangle;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-flusso-md border border-danger/30 bg-danger/5 p-3"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{message}</p>
        {onRetry && kind !== "credit" && kind !== "config" && (
          <button
            type="button"
            className="btn btn-soft mt-2 h-8 px-2.5 text-xs"
            onClick={onRetry}
          >
            <RefreshCw className="size-3.5" />
            Riprova
          </button>
        )}
      </div>
    </div>
  );
}
