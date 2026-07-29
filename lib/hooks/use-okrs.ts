"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { qk } from "@/lib/hooks/query-keys";
import { useOptimisticMutation } from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import { quarterOf, todayISO } from "@/lib/time";
import {
  leastAdvancedKeyResult,
  toOkr,
  type KeyResult,
  type Okr,
} from "@/lib/types";

/** Il trimestre corrente, nel formato `2026-Q3`. */
export function currentQuarter(): string {
  return quarterOf(todayISO());
}

export function useOkrs(quarter: string = currentQuarter()) {
  const query = useQuery({
    queryKey: qk.okrs(quarter),
    queryFn: async (): Promise<Okr[]> => {
      const { data, error } = await supabaseBrowser()
        .from("okrs")
        .select("*")
        .eq("quarter", quarter)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toOkr);
    },
    staleTime: 5 * 60_000,
  });

  const okrs = useMemo(() => query.data ?? [], [query.data]);

  const byProject = useMemo(() => {
    const map = new Map<string, Okr>();
    for (const okr of okrs) {
      if (okr.project_id) map.set(okr.project_id, okr);
    }
    return map;
  }, [okrs]);

  /**
   * Il key result che un blocco di quel progetto farebbe avanzare: il più
   * indietro fra quelli dell'obiettivo. È la riga «Questo blocco avanza: …»
   * del Focus, ed è il solo punto in cui la strategia tocca l'esecuzione.
   */
  const leastAdvancedFor = useCallback(
    (projectId: string | null): { okr: Okr; kr: KeyResult } | null => {
      if (!projectId) return null;
      const okr = byProject.get(projectId);
      if (!okr) return null;
      const kr = leastAdvancedKeyResult(okr);
      return kr ? { okr, kr } : null;
    },
    [byProject],
  );

  return { ...query, okrs, byProject, leastAdvancedFor, quarter };
}

/** Aggiorna il valore corrente di un key result dentro il suo obiettivo. */
export function useUpdateKeyResult(quarter: string = currentQuarter()) {
  return useOptimisticMutation<
    { okrId: string; keyResultId: string; current: number },
    void,
    Okr[]
  >({
    key: qk.okrs(quarter),
    errorMessage: "Non è stato possibile aggiornare il risultato chiave.",
    async mutationFn({ okrId, keyResultId, current }) {
      const supabase = supabaseBrowser();

      // I key result vivono in una colonna jsonb: si rilegge, si cambia la
      // voce e si riscrive l'array intero.
      const { data: row, error: readError } = await supabase
        .from("okrs")
        .select("key_results")
        .eq("id", okrId)
        .single();
      if (readError) throw readError;

      const next = toOkr({ ...row, id: okrId } as never).key_results.map((kr) =>
        kr.id === keyResultId ? { ...kr, current } : kr,
      );

      const { error } = await supabase
        .from("okrs")
        .update({ key_results: next })
        .eq("id", okrId);
      if (error) throw error;
    },
    optimistic(okrs, { okrId, keyResultId, current }) {
      return okrs?.map((okr) =>
        okr.id === okrId
          ? {
              ...okr,
              key_results: okr.key_results.map((kr) =>
                kr.id === keyResultId ? { ...kr, current } : kr,
              ),
            }
          : okr,
      );
    },
  });
}
