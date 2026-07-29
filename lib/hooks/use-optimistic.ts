"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { dbErrorMessage } from "@/lib/db-errors";

type OptimisticOptions<TVars, TData, TCache> = {
  /** La query da aggiornare subito e da invalidare alla fine. */
  key: QueryKey;
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Come cambia la cache mentre il server ancora non ha risposto. */
  optimistic?: (current: TCache | undefined, vars: TVars) => TCache | undefined;
  /** Altre query da invalidare quando la mutazione tocca più domini. */
  alsoInvalidate?: QueryKey[];
  /** Testo del toast d'errore, se quello del database non basta. */
  errorMessage?: string;
  onSuccess?: (data: TData, vars: TVars) => void;
};

/**
 * Ogni mutazione di Flusso è ottimistica: l'interfaccia cambia subito, e se il
 * server rifiuta si torna indietro con un toast che dice cosa è successo.
 * Questo helper esiste per non riscrivere quel ciclo in ogni hook — e per non
 * dimenticarsi il rollback in uno di essi.
 */
export function useOptimisticMutation<TVars, TData = unknown, TCache = unknown>(
  options: OptimisticOptions<TVars, TData, TCache>,
): UseMutationResult<TData, unknown, TVars, { previous: TCache | undefined }> {
  const queryClient = useQueryClient();

  return useMutation<
    TData,
    unknown,
    TVars,
    { previous: TCache | undefined }
  >({
    mutationFn: options.mutationFn,

    async onMutate(vars) {
      // Una lettura in volo scriverebbe sopra l'aggiornamento ottimistico.
      await queryClient.cancelQueries({ queryKey: options.key });
      const previous = queryClient.getQueryData<TCache>(options.key);

      if (options.optimistic) {
        queryClient.setQueryData<TCache>(options.key, (current) =>
          options.optimistic!(current, vars),
        );
      }

      return { previous };
    },

    onError(error, _vars, context) {
      if (context) queryClient.setQueryData(options.key, context.previous);
      toast.error(dbErrorMessage(error, options.errorMessage));
    },

    onSuccess(data, vars) {
      options.onSuccess?.(data, vars);
    },

    onSettled() {
      // Invalidazioni mirate: mai `invalidateQueries()` a tappeto.
      void queryClient.invalidateQueries({ queryKey: options.key });
      for (const key of options.alsoInvalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Sostituisce l'elemento con lo stesso id, lasciando il resto com'è. */
export function replaceById<T extends { id: string }>(
  list: T[] | undefined,
  id: string,
  change: (item: T) => T,
): T[] | undefined {
  return list?.map((item) => (item.id === id ? change(item) : item));
}

/** Toglie dalla lista gli elementi indicati. */
export function removeByIds<T extends { id: string }>(
  list: T[] | undefined,
  ids: string[],
): T[] | undefined {
  const set = new Set(ids);
  return list?.filter((item) => !set.has(item.id));
}
