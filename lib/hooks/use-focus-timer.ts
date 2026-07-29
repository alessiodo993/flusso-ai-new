"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Il cronometro del focus.
 *
 * Regola non negoziabile: **il tempo in pausa non conta**. Il contatore non è
 * una sottrazione fra due orologi — sarebbe l'errore facile — ma una somma di
 * intervalli davvero trascorsi in esecuzione. Così mettere in pausa e tornare
 * mezz'ora dopo non brucia mezz'ora di sessione.
 */
export type TimerState = "idle" | "running" | "paused" | "expired";

export function useFocusTimer(plannedMinutes: number) {
  const [state, setState] = useState<TimerState>("idle");
  const [elapsedSeconds, setElapsed] = useState(0);
  const [pausedSeconds, setPaused] = useState(0);
  const [plannedSeconds, setPlanned] = useState(plannedMinutes * 60);

  // L'istante in cui è ripartito l'ultimo tratto di esecuzione.
  const startedAt = useRef<number | null>(null);
  // Quanto era già stato accumulato prima di quel tratto.
  const accumulated = useRef(0);
  const pausedAt = useRef<number | null>(null);

  useEffect(() => {
    setPlanned(plannedMinutes * 60);
  }, [plannedMinutes]);

  // Un solo intervallo, che legge gli orologi invece di contare i tick: un
  // `setInterval` che incrementa una variabile perde tempo quando la scheda
  // passa in secondo piano, e il timer arriverebbe a fine sessione in ritardo.
  useEffect(() => {
    if (state !== "running") return;

    const tick = () => {
      if (startedAt.current === null) return;
      const seconds =
        accumulated.current + (Date.now() - startedAt.current) / 1000;
      setElapsed(Math.floor(seconds));
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state]);

  // Scaduto: si ferma da sé e lo segnala, invece di andare in negativo.
  useEffect(() => {
    if (state === "running" && elapsedSeconds >= plannedSeconds) {
      accumulated.current = plannedSeconds;
      startedAt.current = null;
      setElapsed(plannedSeconds);
      setState("expired");
    }
  }, [elapsedSeconds, plannedSeconds, state]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setState("running");
  }, []);

  const pause = useCallback(() => {
    if (startedAt.current !== null) {
      accumulated.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    }
    pausedAt.current = Date.now();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (pausedAt.current !== null) {
      setPaused((total) =>
        Math.round(total + (Date.now() - (pausedAt.current ?? Date.now())) / 1000),
      );
      pausedAt.current = null;
    }
    startedAt.current = Date.now();
    setState("running");
  }, []);

  /** Allunga la sessione: riparte anche se era scaduta. */
  const extend = useCallback((minutes: number) => {
    setPlanned((seconds) => seconds + minutes * 60);
    setState((current) => {
      if (current === "expired") {
        startedAt.current = Date.now();
        return "running";
      }
      return current;
    });
  }, []);

  const reset = useCallback((minutes: number) => {
    accumulated.current = 0;
    startedAt.current = null;
    pausedAt.current = null;
    setElapsed(0);
    setPaused(0);
    setPlanned(minutes * 60);
    setState("idle");
  }, []);

  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const progress = plannedSeconds > 0 ? elapsedSeconds / plannedSeconds : 0;

  return {
    state,
    elapsedSeconds,
    remainingSeconds,
    pausedSeconds,
    plannedMinutes: Math.round(plannedSeconds / 60),
    elapsedMinutes: Math.round(elapsedSeconds / 60),
    progress: Math.min(1, progress),
    start,
    pause,
    resume,
    extend,
    reset,
  };
}

/** `MM:SS`, e `H:MM:SS` oltre l'ora. */
export function fmtClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
