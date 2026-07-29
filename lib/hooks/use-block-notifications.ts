"use client";

import { useCallback, useEffect, useState } from "react";

import { emit } from "@/lib/events";
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
  }, [permission, tasks]);

  /** Vero quando ha senso proporre di attivare gli avvisi. */
  const shouldOffer =
    permission === "default" &&
    tasks.some(
      (task) => task.day === todayISO() && isScheduled(task),
    );

  return { permission, request, shouldOffer };
}
