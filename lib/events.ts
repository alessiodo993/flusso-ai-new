"use client";

import { useEffect } from "react";

/**
 * Le sezioni comunicano fra loro con eventi sul `window`, non con uno store
 * condiviso: l'header deve poter aprire la Lista filtrata, il calendario deve
 * poter avviare il focus, la palette deve poter fare entrambe le cose, e
 * nessuno dei tre deve conoscere gli altri.
 */

export const SECTIONS = ["idee", "lista", "calendario", "obiettivi"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  idee: "Idee",
  lista: "Lista",
  calendario: "Pianifica",
  obiettivi: "Obiettivi",
};

/** Filtri che una sezione può ricevere da chi la apre. */
export type ListFilter = { deadlineSoon?: boolean; projectId?: string | null };

type EventMap = {
  "flusso:goto": { section: Section; filter?: ListFilter };
  "flusso:focus-now": {
    taskId?: string;
    /** Micro-avvio: un solo sottotask, durata ridotta. */
    micro?: boolean;
    autoStart?: boolean;
  };
  "flusso:focus-project": { projectId: string };
  /** Apre la cattura rapida, eventualmente già in ascolto della voce. */
  "flusso:quick-capture": { voice?: boolean };
  "flusso:open-settings": Record<string, never>;
  "flusso:open-palette": Record<string, never>;
  "flusso:open-planner": Record<string, never>;
  "flusso:open-shutdown": Record<string, never>;
};

type EventName = keyof EventMap;

export function emit<K extends EventName>(name: K, detail: EventMap[K]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Scorciatoia per l'evento più usato. */
export function goto(section: Section, filter?: ListFilter): void {
  emit("flusso:goto", { section, filter });
}

/**
 * Ascolta un evento di Flusso. L'handler sta in una ref implicita tramite le
 * dipendenze: passalo memoizzato, o accetta che si riagganci a ogni render.
 */
export function useFlussoEvent<K extends EventName>(
  name: K,
  handler: (detail: EventMap[K]) => void,
): void {
  useEffect(() => {
    const listener = (event: Event) => {
      handler((event as CustomEvent<EventMap[K]>).detail);
    };
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [name, handler]);
}
