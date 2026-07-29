"use client";

import { MoonStar, Sunrise, X } from "lucide-react";
import { useState } from "react";

import { emit } from "@/lib/events";
import { useReviews } from "@/lib/hooks/use-reviews";
import { nowRome, todayISO } from "@/lib/time";

/**
 * L'invito ai due riti, quando è il momento.
 *
 * Non si apre da solo. Un rito che compare addosso all'utente appena carica
 * la pagina viene chiuso per riflesso, e dopo tre volte non lo si legge più:
 * meglio una riga che aspetta. Si può togliere per la sessione, e comunque
 * sparisce da sé una volta fatto.
 */
export function RitualPrompt() {
  const today = todayISO();
  const { kickoff, shutdown } = useReviews(today);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const hour = nowRome().getHours();
  const kind =
    hour < 12 && !kickoff
      ? "kickoff"
      : hour >= 17 && !shutdown
        ? "shutdown"
        : null;

  if (!kind) return null;

  const Icon = kind === "kickoff" ? Sunrise : MoonStar;

  return (
    <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
      <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-ink-soft">
        {kind === "kickoff"
          ? "Guardiamo la giornata prima di cominciare?"
          : "È ora di chiudere: cosa è rimasto indietro?"}
      </p>
      <button
        type="button"
        className="btn btn-soft h-8 shrink-0 px-2.5 text-xs"
        onClick={() =>
          emit(kind === "kickoff" ? "flusso:open-kickoff" : "flusso:open-shutdown", {})
        }
      >
        {kind === "kickoff" ? "Apri" : "Chiudi"}
      </button>
      <button
        type="button"
        className="icon-btn size-8 shrink-0"
        aria-label="Non adesso"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
