"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { qk } from "@/lib/hooks/query-keys";
import { supabaseBrowser } from "@/lib/supabase/client";
import { todayISO, type DayISO } from "@/lib/time";
import { toDailyReview, type DailyReview, type ReviewType } from "@/lib/types";

/**
 * I due riti della giornata, kickoff e shutdown.
 *
 * Salvarli serve a due cose: sapere se sono già stati fatti oggi — così il
 * rito non si ripropone a ogni ricarica — e tenere una traccia di quanto si
 * pianifica rispetto a quanto si esegue, che è il numero su cui poggia il
 * confronto storico del kickoff.
 */
export function useReviews(day: DayISO = todayISO()) {
  const query = useQuery({
    queryKey: qk.reviews(day),
    queryFn: async (): Promise<DailyReview[]> => {
      const { data, error } = await supabaseBrowser()
        .from("daily_reviews")
        .select("*")
        .eq("date", day);
      if (error) throw error;
      return (data ?? []).map(toDailyReview);
    },
    staleTime: 60_000,
  });

  const reviews = useMemo(() => query.data ?? [], [query.data]);

  return {
    ...query,
    reviews,
    kickoff: reviews.find((one) => one.type === "kickoff") ?? null,
    shutdown: reviews.find((one) => one.type === "shutdown") ?? null,
  };
}

export type ReviewInput = {
  type: ReviewType;
  date?: DayISO;
  plannedMinutes: number;
  completedMinutes: number;
  tasksPlanned: number;
  tasksCompleted: number;
  notes?: string | null;
};

/**
 * Salva il rito. Una sola riga per giorno e per tipo — lo garantisce
 * l'indice unico — quindi rifarlo lo aggiorna invece di duplicarlo: chi
 * riapre lo shutdown dopo aver cambiato idea non deve trovarsi due
 * riepiloghi contraddittori.
 */
export function useSaveReview() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReviewInput): Promise<DailyReview> => {
      const supabase = supabaseBrowser();
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) throw new Error("Sessione scaduta. Accedi di nuovo.");

      const date = input.date ?? todayISO();
      const { data, error } = await supabase
        .from("daily_reviews")
        .upsert(
          {
            user_id: userId,
            date,
            type: input.type,
            planned_minutes: input.plannedMinutes,
            completed_minutes: input.completedMinutes,
            tasks_planned: input.tasksPlanned,
            tasks_completed: input.tasksCompleted,
            notes: input.notes ?? null,
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,date,type" },
        )
        .select()
        .single();

      if (error) throw error;
      return toDailyReview(data);
    },
    onSuccess: (review) => {
      void client.invalidateQueries({ queryKey: qk.reviews(review.date) });
    },
  });
}

/** Gli ultimi shutdown, per il confronto «di solito ne esegui…». */
export function useReviewHistory(days = 14) {
  const query = useQuery({
    queryKey: ["reviews", "history", days] as const,
    queryFn: async (): Promise<DailyReview[]> => {
      const { data, error } = await supabaseBrowser()
        .from("daily_reviews")
        .select("*")
        .eq("type", "shutdown")
        .order("date", { ascending: false })
        .limit(days);
      if (error) throw error;
      return (data ?? []).map(toDailyReview);
    },
    staleTime: 5 * 60_000,
  });

  return { ...query, history: query.data ?? [] };
}
