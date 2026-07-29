"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { qk } from "@/lib/hooks/query-keys";
import { useOptimisticMutation, replaceById } from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Inserts } from "@/lib/supabase/database.types";
import { toRecurring, type Recurring } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * I modelli ricorrenti: «ogni lunedì e giovedì, palestra».
 *
 * Sono modelli, non task: generano righe quando servono e restano dove sono.
 * Tenere le due cose separate è ciò che permette di saltare un'occorrenza
 * senza cancellare la ricorrenza, e di cambiare l'orario di tutte senza
 * toccare quelle già fatte.
 */
export function useRecurring() {
  const query = useQuery({
    queryKey: qk.recurring,
    queryFn: async (): Promise<Recurring[]> => {
      const { data, error } = await supabaseBrowser()
        .from("recurring")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toRecurring);
    },
    staleTime: 5 * 60_000,
  });

  const recurring = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, recurring };
}

export type NewRecurring = {
  title: string;
  projectId?: string | null;
  estMinutes?: number | null;
  energy?: string | null;
  freq: "daily" | "weekly";
  dow?: number[];
  startMinute?: number | null;
};

export function useCreateRecurring() {
  return useOptimisticMutation<NewRecurring, Recurring, Recurring[]>({
    key: qk.recurring,
    errorMessage: "Non è stato possibile salvare la ricorrenza.",
    async mutationFn(input) {
      const row: Inserts<"recurring"> = {
        title: input.title.trim(),
        project_id: input.projectId ?? null,
        est_minutes: input.estMinutes ?? null,
        energy: input.energy ?? null,
        freq: input.freq,
        dow: input.freq === "weekly" ? (input.dow ?? []) : [],
        start_minute: input.startMinute ?? null,
      };

      const { data, error } = await supabaseBrowser()
        .from("recurring")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return toRecurring(data);
    },
    optimistic(current, input) {
      const draft: Recurring = {
        id: `bozza-${uid()}`,
        user_id: "",
        title: input.title.trim(),
        project_id: input.projectId ?? null,
        est_minutes: input.estMinutes ?? null,
        energy: (input.energy ?? null) as Recurring["energy"],
        subtasks: [],
        freq: input.freq,
        dow: input.dow ?? [],
        start_minute: input.startMinute ?? null,
        skip: [],
        created_at: new Date().toISOString(),
      };
      return [...(current ?? []), draft];
    },
  });
}

export function useUpdateRecurring() {
  return useOptimisticMutation<
    { id: string } & Partial<
      Pick<Recurring, "title" | "project_id" | "est_minutes" | "freq" | "dow" | "start_minute">
    >,
    Recurring,
    Recurring[]
  >({
    key: qk.recurring,
    errorMessage: "Non è stato possibile aggiornare la ricorrenza.",
    async mutationFn({ id, ...changes }) {
      const { data, error } = await supabaseBrowser()
        .from("recurring")
        .update(changes)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return toRecurring(data);
    },
    optimistic(current, { id, ...changes }) {
      return replaceById(current, id, (one) => ({ ...one, ...changes }));
    },
  });
}

export function useDeleteRecurring() {
  return useOptimisticMutation<{ id: string }, void, Recurring[]>({
    key: qk.recurring,
    errorMessage: "Non è stato possibile eliminare la ricorrenza.",
    async mutationFn({ id }) {
      const { error } = await supabaseBrowser()
        .from("recurring")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id }) {
      return (current ?? []).filter((one) => one.id !== id);
    },
  });
}
