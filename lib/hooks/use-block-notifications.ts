"use client";

import { useCallback, useEffect, useState } from "react";

import { emit } from "@/lib/events";
import { useServiceWorker } from "@/lib/hooks/use-service-worker";
import { canSnooze, readSnoozeLog, SNOOZE_MINUTES } from "@/lib/snooze";
import { nowMinutes, todayISO } from "@/lib/time";
import { isScheduled, type Task } from "@/lib/types";

const ASKED_KEY = "flusso:notifiche-chieste";

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

function currentPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Avvisi all'inizio di ogni blocco.
 *
 * Il permesso **non si chiede al primo caricamento**: una richiesta che arriva
 * prima di aver capito cosa fa l'app viene negata per riflesso, e negata resta
 * — il browser non la ripropone. Si chiede solo dopo che c'è qualcosa da
 * annunciare, e solo su gesto esplicito.
 */
export function useBlockNotifications(tasks: Task[]) {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    "unsupported",
  );
  const { notify } = useServiceWorker();

  useEffect(() => setPermission(currentPermission()), []);

  const request = useCallback(async () => {
    if (currentPermission() === "unsupported") return;
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      // Preferenza non persistita: al massimo si riproporrà l'offerta.
    }
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;

    const today = todayISO();
    const minute = nowMinutes();

    const upcoming = tasks.filter(
      (task) =>
        task.day === today &&
        task.status !== "done" &&
        isScheduled(task) &&
        task.start_minute > minute,
    );

    /*
     * Un timer per blocco invece di un intervallo che controlla l'orologio:
     * così l'avviso arriva al minuto esatto e non fino a un minuto dopo.
     * `setTimeout` non è affidabile oltre le poche ore, ma qui la giornata
     * finisce prima.
     */
    const timers = upcoming.map((task) =>
      window.setTimeout(
        () => {
          /*
           * Prima si prova col service worker: è l'unico modo di avere i
           * pulsanti «Inizia» e «Rimanda 15 min», perché una notifica creata
           * dal documento non supporta le azioni. Se il worker non c'è —
           * sviluppo, browser senza supporto, registrazione fallita — si
           * ripiega sull'avviso semplice, che almeno avvisa.
           */
          /*
           * Le azioni cambiano con la storia del blocco. Dopo due micro-rinvii
           * nello stesso giorno «Rimanda 15 min» sparisce: al terzo quarto
           * d'ora non si sta più gestendo un imprevisto, si sta rimandando la
           * giornata quindici minuti per volta. Resta «Inizia» e resta
           * «Sposta», che però è un rinvio vero e come tale viene contato.
           */
          const ancoraRimandabile = canSnooze(
            readSnoozeLog(),
            today,
            task.id,
          );

          const shown = notify({
            title: task.title,
            body: ancoraRimandabile
              ? "È l'ora di questo blocco."
              : "Terzo tentativo. Dieci minuti bastano per cominciare.",
            tag: `flusso-${task.id}`,
            taskId: task.id,
            actions: ancoraRimandabile
              ? [
                  { action: "inizia", title: "Inizia" },
                  { action: "rimanda", title: `Rimanda ${SNOOZE_MINUTES} min` },
                ]
              : [
                  { action: "inizia", title: "Inizia" },
                  { action: "sposta", title: "Sposta il task" },
                ],
          });
          if (shown) return;

          const notification = new Notification(task.title, {
            body: "È l'ora di questo blocco.",
            tag: `flusso-${task.id}`,
            icon: "/icon.svg",
          });
          notification.onclick = () => {
            window.focus();
            emit("flusso:focus-now", { taskId: task.id });
            notification.close();
          };
        },
        ((task.start_minute as number) - minute) * 60_000,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [notify, permission, tasks]);

  /** Vero quando ha senso proporre di attivare gli avvisi. */
  const shouldOffer =
    permission === "default" &&
    tasks.some(
      (task) => task.day === todayISO() && isScheduled(task),
    );

  return { permission, request, shouldOffer };
}
