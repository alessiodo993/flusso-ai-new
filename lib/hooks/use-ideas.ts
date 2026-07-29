"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { qk } from "@/lib/hooks/query-keys";
import {
  removeByIds,
  replaceById,
  useOptimisticMutation,
} from "@/lib/hooks/use-optimistic";
import { orderBetween } from "@/lib/sort-order";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Idea } from "@/lib/types";
import { uid } from "@/lib/utils";

async function fetchIdeas(): Promise<Idea[]> {
  const { data, error } = await supabaseBrowser()
    .from("ideas")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useIdeas() {
  const query = useQuery({ queryKey: qk.ideas, queryFn: fetchIdeas });
  const ideas = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, ideas };
}

export function useCreateIdea() {
  return useOptimisticMutation<
    { title: string; projectId?: string | null },
    Idea,
    Idea[]
  >({
    key: qk.ideas,
    errorMessage: "Non è stato possibile salvare l'idea.",
    async mutationFn(input) {
      const { data, error } = await supabaseBrowser()
        .from("ideas")
        .insert({
          title: input.title.trim(),
          project_id: input.projectId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    optimistic(current, input) {
      // Le nuove idee vanno in cima: la cattura a raffica deve vedersi subito.
      const first = current?.[0]?.sort_order ?? null;
      const draft: Idea = {
        id: `bozza-${uid()}`,
        user_id: "",
        title: input.title.trim(),
        project_id: input.projectId ?? null,
        sort_order: orderBetween(null, first),
        created_at: new Date().toISOString(),
      };
      return [draft, ...(current ?? [])];
    },
  });
}

export function useUpdateIdea() {
  return useOptimisticMutation<
    { id: string; title?: string; project_id?: string | null },
    Idea,
    Idea[]
  >({
    key: qk.ideas,
    errorMessage: "Non è stato possibile aggiornare l'idea.",
    async mutationFn({ id, ...changes }) {
      const { data, error } = await supabaseBrowser()
        .from("ideas")
        .update(changes)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    optimistic(current, { id, ...changes }) {
      return replaceById(current, id, (idea) => ({ ...idea, ...changes }));
    },
  });
}

export function useDeleteIdeas() {
  return useOptimisticMutation<{ ids: string[] }, void, Idea[]>({
    key: qk.ideas,
    errorMessage: "Non è stato possibile eliminare.",
    async mutationFn({ ids }) {
      const { error } = await supabaseBrowser()
        .from("ideas")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    optimistic(current, { ids }) {
      return removeByIds(current, ids);
    },
  });
}

/** Cambia progetto a più idee in un colpo solo. */
export function useSetIdeasProject() {
  return useOptimisticMutation<
    { ids: string[]; projectId: string | null },
    void,
    Idea[]
  >({
    key: qk.ideas,
    errorMessage: "Non è stato possibile cambiare progetto.",
    async mutationFn({ ids, projectId }) {
      const { error } = await supabaseBrowser()
        .from("ideas")
        .update({ project_id: projectId })
        .in("id", ids);
      if (error) throw error;
    },
    optimistic(current, { ids, projectId }) {
      const set = new Set(ids);
      return current?.map((idea) =>
        set.has(idea.id) ? { ...idea, project_id: projectId } : idea,
      );
    },
  });
}

export function useReorderIdea() {
  return useOptimisticMutation<
    { id: string; before: number | null; after: number | null },
    void,
    Idea[]
  >({
    key: qk.ideas,
    errorMessage: "Non è stato possibile riordinare le idee.",
    async mutationFn({ id, before, after }) {
      const { error } = await supabaseBrowser()
        .from("ideas")
        .update({ sort_order: orderBetween(before, after) })
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id, before, after }) {
      const next = replaceById(current, id, (idea) => ({
        ...idea,
        sort_order: orderBetween(before, after),
      }));
      return next?.slice().sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}
