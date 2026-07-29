"use client";

import { useCallback, useEffect, useState } from "react";

import { emit } from "@/lib/events";
import { SNOOZE_MINUTES } from "@/lib/snooze";
import { addDaysISO, todayISO } from "@/lib/time";

/**
 * Registrazione del service worker e ascolto dei suoi messaggi.
 *
 * La registrazione parte **dopo** il primo caricamento, non durante: in fase
 * di avvio il browser ha già abbastanza da fare, e un worker registrato
 * mezzo secondo più tardi non cambia nulla per l'utente.
 *
 * In sviluppo non si registra affatto. Un worker che serve una cache mentre
 * si ricompila è il modo più rapido per inseguire un difetto che non esiste
 * — ci sono già cascato una volta con un server di sviluppo appeso a una
 * `.next` cancellata.
 */
export function useServiceWorker() {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => !cancelled && setRegistration(reg))
        .catch(() => {
          // Senza worker l'app funziona lo stesso: si perdono i pulsanti
          // nelle notifiche e la pagina di cortesia offline.
        });
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Le azioni premute sulla notifica tornano indietro da qui.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; action?: string; taskId?: string }
        | undefined;
      if (data?.type !== "flusso:azione-notifica") return;
      handleAction(data.action, data.taskId);
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  /*
   * Se l'app non era aperta, l'azione arriva nell'URL. Si consuma una volta
   * sola e si ripulisce la barra degli indirizzi: ricaricare la pagina non
   * deve far ripartire un focus o rinviare di nuovo un blocco.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("azione");
    const taskId = params.get("task");
    if (!action) return;

    handleAction(action, taskId ?? undefined);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  /** Mostra un avviso tramite il worker, con i pulsanti azione. */
  const notify = useCallback(
    (input: {
      title: string;
      body: string;
      tag: string;
      taskId: string;
      actions: Array<{ action: string; title: string }>;
    }) => {
      const worker = registration?.active ?? navigator.serviceWorker?.controller;
      if (!worker) return false;

      worker.postMessage({ type: "flusso:notifica", ...input });
      return true;
    },
    [registration],
  );

  return { registration, notify };
}

function handleAction(action: string | undefined, taskId: string | undefined) {
  if (!taskId) return;

  if (action === "rimanda") {
    emit("flusso:snooze", { taskId, minutes: SNOOZE_MINUTES });
    return;
  }
  if (action === "sposta") {
    // Questo sì che è un rinvio: sposta il task a domani passando dal
    // contatore, quindi al terzo scatta il dialogo dell'attrito.
    emit("flusso:postpone", { taskId, day: addDaysISO(todayISO(), 1) });
    return;
  }
  // «Inizia» e il tocco sul corpo della notifica fanno la stessa cosa: chi
  // tocca un avviso di un blocco vuole cominciare quel blocco.
  emit("flusso:focus-now", { taskId, autoStart: action === "inizia" });
}
