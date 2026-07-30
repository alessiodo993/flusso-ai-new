"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Mostra l'esito del collegamento Google.
 *
 * Il ritorno da Google è un **redirect del browser**, non una chiamata: non
 * c'è nessuna promise da attendere e nessun `catch` in cui finire. L'unico
 * modo che il server ha di parlare è scrivere il messaggio nell'URL — e
 * finché nessuno lo legge, l'utente torna sull'app e non succede niente
 * visibile. Che è esattamente com'era: successo e fallimento indistinguibili.
 *
 * Il messaggio si consuma una volta sola e l'URL si ripulisce, altrimenti
 * ricaricare la pagina lo riproporrebbe all'infinito.
 */
export function useGoogleOutcome() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("google");
    if (!message) return;

    // Gli errori restano finché non li si chiude: qui c'è quasi sempre
    // qualcosa da fare — una variabile da aggiungere, un indirizzo da
    // registrare — e cinque secondi non bastano nemmeno a leggerlo.
    const failed = /fallit|manca|non combacia|rifiutat|non valid|annullat/i.test(
      message,
    );

    /*
     * Il rinvio di un giro non è cautela: è necessario. Sonner **non ha
     * replay** — `subscribe` si limita a mettere in coda l'ascoltatore — e gli
     * effetti dei figli girano prima di quello del `<Toaster>`, che nel
     * provider è un fratello successivo. Un toast lanciato qui, al montaggio,
     * verrebbe pubblicato a zero ascoltatori e perso: l'utente tornerebbe da
     * Google e non vedrebbe niente. Visto succedere, in questo stesso punto.
     */
    const timer = setTimeout(() => {
      if (failed) {
        toast.error(message, { duration: Infinity, closeButton: true });
      } else {
        toast.success(message, { duration: 8000 });
      }
    }, 0);

    params.delete("google");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );

    return () => clearTimeout(timer);
  }, []);
}
