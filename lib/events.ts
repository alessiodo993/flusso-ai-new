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
  /** Porta il cursore nella barra di cattura della sezione corrente. */
  "flusso:quick-capture": Record<string, never>;
  /**
   * Apre la cattura magica: una frase intera da far interpretare all'AI,
   * eventualmente dettata. È un'altra cosa dalla cattura rapida — lì si
   * scrive un titolo, qui si scarica un pensiero e si rivede il risultato.
   *
   * `text` porta dentro quello che l'utente aveva già scritto altrove: chi
   * preme la bacchetta a metà frase non deve ricominciare da capo.
   */
  "flusso:magic-capture": { voice?: boolean; text?: string };
  "flusso:open-settings": Record<string, never>;
  /** Realtà vs Piano. */
  "flusso:open-calibration": Record<string, never>;
  /**
   * Sposta un task a un altro giorno **contandolo come rinvio**. Passa sempre
   * di qui e mai dalla mutazione diretta: è il punto in cui scatta il dialogo
   * del terzo rinvio, e scavalcarlo lo renderebbe aggirabile.
   */
  "flusso:postpone": {
    taskId: string;
    day: string | null;
    startMinute?: number | null;
  };
  "flusso:open-palette": Record<string, never>;
  "flusso:open-planner": Record<string, never>;
  /**
   * Crea un progetto senza passare dalle Impostazioni. Con `assignToTaskId` il
   * task ci finisce dentro appena il progetto esiste: chi apre da un task sta
   * archiviando quel task, non configurando l'app.
   */
  "flusso:new-project": { assignToTaskId?: string };
  /** «Rimanda 15 min» dalla notifica di inizio blocco. */
  "flusso:snooze": { taskId: string; minutes: number };
  "flusso:open-kickoff": Record<string, never>;
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
