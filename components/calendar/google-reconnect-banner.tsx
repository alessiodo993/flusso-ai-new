"use client";

import { AlertTriangle } from "lucide-react";

import { useGoogleAccounts } from "@/lib/hooks/use-google";

/**
 * Quando Google smette di accettare il refresh token — consenso revocato,
 * password cambiata, token scaduto — la sincronizzazione si ferma in silenzio.
 * Questo banner è ciò che rende visibile quel silenzio: senza, l'utente
 * scoprirebbe il problema solo accorgendosi che il calendario è fermo da
 * giorni.
 */
export function GoogleReconnectBanner() {
  const { needReconnect } = useGoogleAccounts();

  if (needReconnect.length === 0) return null;

  return (
    <div className="border-b border-line bg-warn-soft px-3 py-2.5">
      {needReconnect.map((account) => (
        <div
          key={account.id}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <AlertTriangle
            className="size-4 shrink-0 text-warn"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-ink">
            La sincronizzazione di <strong>{account.email}</strong> si è
            interrotta.
          </span>
          <a
            href="/api/google/connect?aggiungi=1"
            className="btn btn-soft h-8 shrink-0"
          >
            Riconnetti
          </a>
        </div>
      ))}
    </div>
  );
}
