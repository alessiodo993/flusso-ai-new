"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  completionRate,
  mostPostponed,
  optimismCoefficient,
  optimismMessage,
  plannedVsDone,
  weeklyHighlights,
} from "@/lib/calibration";
import { qk } from "@/lib/hooks/query-keys";
import { useFocusSessions } from "@/lib/hooks/use-focus-sessions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDaysISO, startOfWeekISO, todayISO } from "@/lib/time";
import { toTask, type Task } from "@/lib/types";

/** Quanto indietro guarda il grafico. */
const CHART_DAYS = 14;

/**
 * I numeri della calibrazione.
 *
 * I task li rilegge con una query propria invece di riusare `useTasks`: quella
 * carica una finestra pensata per l'interfaccia, mentre qui serve esattamente
 * il periodo del grafico, compreso ciò che è già stato chiuso.
 */
export function useCalibration() {
  const today = todayISO();
  const { sessions, isLoading: loadingSessions } = useFocusSessions();

  const history = useQuery({
    queryKey: qk.calibration,
    queryFn: async (): Promise<Task[]> => {
      const from = addDaysISO(today, -CHART_DAYS);
      const { data, error } = await supabaseBrowser()
        .from("tasks")
        .select("*")
        .gte("day", from)
        .lte("day", today);
      if (error) throw error;
      return (data ?? []).map(toTask);
    },
    staleTime: 5 * 60_000,
  });

  const scheduled = useMemo(() => history.data ?? [], [history.data]);

  return useMemo(() => {
    const coefficient = optimismCoefficient(sessions);

    return {
      isLoading: loadingSessions || history.isLoading,
      sessionCount: sessions.length,
      coefficient,
      message: optimismMessage(coefficient),
      completion: completionRate(scheduled, { days: CHART_DAYS, today }),
      highlights: weeklyHighlights(scheduled, {
        from: startOfWeekISO(today),
        to: addDaysISO(startOfWeekISO(today), 6),
      }),
      series: plannedVsDone(scheduled, { days: CHART_DAYS, today }),
    };
  }, [history.isLoading, loadingSessions, scheduled, sessions, today]);
}

/** La classifica dei rinvii, che legge i task già in memoria. */
export function usePostponeRanking(tasks: Task[], limit = 5) {
  return useMemo(() => mostPostponed(tasks, limit), [limit, tasks]);
}
