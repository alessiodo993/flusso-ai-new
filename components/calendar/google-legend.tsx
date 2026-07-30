"use client";

import { CalendarClock, X } from "lucide-react";
import { useEffect, useState } from "react";

import { GOOGLE_SOURCE } from "@/components/calendar/google-event-block";

const KEY = "flusso:legenda-google";

/**
 * La riga che spiega, una volta sola, come si leggono i due tipi di blocco.
 *
 * Icona, cornice e nome del calendario dicono *che* un evento viene da fuori;
 * questa riga dice **cosa comporta** — che si sposta da Google e non da qui —
 * e quella è l'unica parte che nessun segnale grafico può trasmettere da sé.
 * Serve una volta: chi l'ha letta la chiude e non la rivede più, perché una
 * spiegazione che torna ogni giorno smette di essere una spiegazione e diventa
 * rumore.
 *
 * Compare solo nei giorni che hanno almeno un evento Google: spiegare una
 * convenzione mentre non se ne vede nessun esempio è tempo perso.
 */
export function GoogleLegend({ show }: { show: boolean }) {
  /*
   * `null` = non ancora saputo. Leggere `localStorage` dentro `useState`
   * darebbe un valore diverso fra server e client e React lo segnalerebbe
   * come mismatch; leggerlo in un effetto partendo da `false` farebbe
   * lampeggiare la riga a chi l'ha già chiusa. Il terzo stato evita entrambi.
   */
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(KEY) === "1");
    } catch {
      // Modalità privata o storage pieno: la riga si mostra, si chiude per la
      // sessione e non è un problema.
      setDismissed(false);
    }
  }, []);

  if (!show || dismissed !== false) return null;

  return (
    <div className="mb-3 flex items-start gap-2 rounded-flusso-md border border-line bg-sunken px-3 py-2 text-xs text-ink-soft">
      <CalendarClock
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-ink-faint"
      />
      <p className="min-w-0 flex-1">
        Le schede con la cornice e questa icona vengono da {GOOGLE_SOURCE}: si
        spostano da Google, non da qui. I blocchi a colore pieno sono i tuoi e
        si trascinano.
      </p>
      <button
        type="button"
        className="icon-btn icon-btn-sm shrink-0"
        aria-label="Ho capito, non mostrare più"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            // Niente da fare: resta chiusa per questa sessione.
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
