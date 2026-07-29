"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { qk } from "@/lib/hooks/query-keys";
import {
  removeByIds,
  useOptimisticMutation,
} from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Inserts } from "@/lib/supabase/database.types";
import { dowOf, type DayISO } from "@/lib/time";
import type { FixedBlock } from "@/lib/types";

async function fetchBlocks(): Promise<FixedBlock[]> {
  const { data, error } = await supabaseBrowser()
    .from("blocks")
    .select("*")
    .order("start_minute", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Impegni fissi che non sono task: pranzo, palestra, un treno. Per il
 * calendario e per il planner sono ostacoli, non cose da fare.
 */
export function useBlocks() {
  const query = useQuery({
    queryKey: qk.blocks,
    queryFn: fetchBlocks,
    staleTime: 5 * 60_000,
  });

  const blocks = useMemo(() => query.data ?? [], [query.data]);

  /** Quelli che cadono in un dato giorno, ricorrenti inclusi. */
  const forDay = useCallback(
    (day: DayISO): FixedBlock[] => {
      const dow = dowOf(day);
      return blocks.filter((block) =>
        block.recur ? block.dow.includes(dow) : block.day === day,
      );
    },
    [blocks],
  );

  return { ...query, blocks, forDay };
}

export function useCreateBlock() {
  return useOptimisticMutation<Inserts<"blocks">, FixedBlock, FixedBlock[]>({
    key: qk.blocks,
    errorMessage: "Non è stato possibile salvare l'impegno.",
    async mutationFn(input) {
      const { data, error } = await supabaseBrowser()
        .from("blocks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteBlock() {
  return useOptimisticMutation<{ id: string }, void, FixedBlock[]>({
    key: qk.blocks,
    errorMessage: "Non è stato possibile eliminare l'impegno.",
    async mutationFn({ id }) {
      const { error } = await supabaseBrowser()
        .from("blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id }) {
      return removeByIds(current, [id]);
    },
  });
}
