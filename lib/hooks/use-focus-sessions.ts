"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { qk } from "@/lib/hooks/query-keys";
import { useOptimisticMutation } from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toFocusSession, type FocusOutcome, type FocusSession } from "@/lib/types";

/** Quante sessioni guarda la calibrazione. */
export const CALIBRATION_WINDOW = 30;

export function useFocusSessions() {
  const query = useQuery({
    queryKey: qk.focusSessions,
    queryFn: async (): Promise<FocusSession[]> => {
      const { data, error } = await supabaseBrowser()
        .from("focus_sessions")
        .select("*")
        .not("actual_minutes", "is", null)
        .order("started_at", { ascending: false })
        .limit(CALIBRATION_WINDOW * 4);
      if (error) throw error;
      return (data ?? []).map(toFocusSession);
    },
    staleTime: 60_000,
  });

  const sessions = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, sessions };
}

/**
 * Apre una sessione appena si preme «Inizia».
 *
 * Si scrive subito, non alla fine: se l'utente chiude la scheda a metà, quella
 * sessione deve comunque esistere. Meglio una riga senza esito che nessuna
 * traccia di un'ora di lavoro.
 */
export function useStartFocusSession() {
  return useOptimisticMutation<
    { taskId: string | null; plannedMinutes: number; micro: boolean },
    FocusSession,
    FocusSession[]
  >({
    key: qk.focusSessions,
    errorMessage: "Non è stato possibile avviare la sessione.",
    async mutationFn({ taskId, plannedMinutes, micro }) {
      const { data, error } = await supabaseBrowser()
        .from("focus_sessions")
        .insert({
          task_id: taskId,
          planned_minutes: plannedMinutes,
          was_micro_start: micro,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return toFocusSession(data);
    },
  });
}

/** Chiude una sessione con il tempo davvero speso e come è finita. */
export function useCloseFocusSession() {
  return useOptimisticMutation<
    {
      sessionId: string;
      actualMinutes: number;
      pausedSeconds: number;
      outcome: FocusOutcome;
      plannedMinutes?: number;
    },
    void,
    FocusSession[]
  >({
    key: qk.focusSessions,
    alsoInvalidate: [qk.calibration, qk.tasks],
    errorMessage: "Non è stato possibile chiudere la sessione.",
    async mutationFn({
      sessionId,
      actualMinutes,
      pausedSeconds,
      outcome,
      plannedMinutes,
    }) {
      const { error } = await supabaseBrowser()
        .from("focus_sessions")
        .update({
          ended_at: new Date().toISOString(),
          actual_minutes: actualMinutes,
          paused_seconds: pausedSeconds,
          outcome,
          // Con i +15 minuti il piano cambia in corsa: va aggiornato, o il
          // coefficiente di ottimismo confronterebbe numeri sbagliati.
          ...(plannedMinutes ? { planned_minutes: plannedMinutes } : {}),
        })
        .eq("id", sessionId);
      if (error) throw error;
    },
  });
}
