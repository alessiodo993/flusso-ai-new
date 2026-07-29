"use client";

import { useEffect } from "react";

import { useGoogleSync } from "@/lib/hooks/use-google";

/** Ogni cinque minuti, come da specifica. */
const INTERVAL_MS = 5 * 60_000;

/**
 * Sincronizzazione periodica in primo piano.
 *
 * Si ferma quando la scheda è nascosta e riparte quando torna visibile: tenere
 * un intervallo attivo su una scheda che nessuno guarda consuma quota Google e
 * batteria per niente. Le notifiche push restano la via veloce; questo è il
 * ripiego per quando un canale scade o una notifica si perde.
 */
export function useGooglePolling(enabled: boolean) {
  const sync = useGoogleSync();
  const run = sync.mutate;

  useEffect(() => {
    if (!enabled) return;

    let timer: number | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => run(), INTERVAL_MS);
    };

    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Al ritorno si recupera subito quello che è cambiato nel frattempo.
        run();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, run]);
}
