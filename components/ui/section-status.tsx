"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { dbErrorMessage } from "@/lib/db-errors";

/**
 * Cosa mostrare quando una sezione non ha niente da mostrare.
 *
 * Sono **tre** casi diversi, e vanno distinti: sto caricando, il caricamento è
 * fallito, oppure davvero non c'è nulla. Scriverli come `!isLoading && <Vuoto/>`
 * ne copre due su tre e lascia la terza — l'errore — come un pannello bianco
 * per sempre, che è il modo peggiore di dire che qualcosa non va.
 */
export function SectionStatus({
  isLoading,
  isError,
  error,
  onRetry,
  empty,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Lo stato vuoto vero e proprio, con la sua chiamata all'azione. */
  empty: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Caricamento…</span>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-11 animate-pulse rounded-flusso-sm bg-sunken"
            style={{ animationDelay: `${row * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        Icon={AlertTriangle}
        title="Non è stato possibile caricare"
        description={dbErrorMessage(error, "Controlla la connessione e riprova.")}
        action={
          onRetry && (
            <button type="button" className="btn btn-soft" onClick={onRetry}>
              <RefreshCw className="size-4" />
              Riprova
            </button>
          )
        }
      />
    );
  }

  return <>{empty}</>;
}
