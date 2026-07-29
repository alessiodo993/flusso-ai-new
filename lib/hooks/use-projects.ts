"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DEFAULT_PROJECT_COLOR } from "@/lib/colors";
import { qk } from "@/lib/hooks/query-keys";
import {
  removeByIds,
  replaceById,
  useOptimisticMutation,
} from "@/lib/hooks/use-optimistic";
import { orderBetween } from "@/lib/sort-order";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { uid } from "@/lib/utils";

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabaseBrowser()
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useProjects() {
  const query = useQuery({
    queryKey: qk.projects,
    queryFn: fetchProjects,
    // I progetti cambiano di rado: rileggerli spesso è solo traffico.
    staleTime: 5 * 60_000,
  });

  const projects = useMemo(() => query.data ?? [], [query.data]);

  /** Indice per id: le card di task e idee lo interrogano di continuo. */
  const byId = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const active = useMemo(
    () => projects.filter((project) => !project.archived),
    [projects],
  );

  return { ...query, projects, active, byId };
}

export function useCreateProject() {
  return useOptimisticMutation<
    { name: string; color?: string; deadline?: string | null },
    Project,
    Project[]
  >({
    key: qk.projects,
    errorMessage: "Non è stato possibile creare il progetto.",
    async mutationFn(input) {
      const { data, error } = await supabaseBrowser()
        .from("projects")
        .insert({
          name: input.name.trim(),
          color: input.color ?? DEFAULT_PROJECT_COLOR,
          deadline: input.deadline ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    optimistic(current, input) {
      const draft: Project = {
        id: `bozza-${uid()}`,
        user_id: "",
        name: input.name.trim(),
        color: input.color ?? DEFAULT_PROJECT_COLOR,
        deadline: input.deadline ?? null,
        archived: false,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
      };
      return [...(current ?? []), draft];
    },
  });
}

export function useUpdateProject() {
  return useOptimisticMutation<
    { id: string } & Partial<Omit<Project, "id" | "user_id">>,
    Project,
    Project[]
  >({
    key: qk.projects,
    // Il colore del progetto tinge blocchi e card ovunque.
    alsoInvalidate: [qk.tasks, qk.ideas],
    errorMessage: "Non è stato possibile aggiornare il progetto.",
    async mutationFn({ id, ...changes }) {
      const { data, error } = await supabaseBrowser()
        .from("projects")
        .update(changes)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    optimistic(current, { id, ...changes }) {
      return replaceById(current, id, (project) => ({ ...project, ...changes }));
    },
  });
}

export function useDeleteProject() {
  return useOptimisticMutation<{ id: string }, void, Project[]>({
    key: qk.projects,
    // I task e le idee del progetto restano, ma senza progetto.
    alsoInvalidate: [qk.tasks, qk.ideas, qk.okrsAll],
    errorMessage: "Non è stato possibile eliminare il progetto.",
    async mutationFn({ id }) {
      const { error } = await supabaseBrowser()
        .from("projects")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id }) {
      return removeByIds(current, [id]);
    },
  });
}

/** Sposta un progetto fra due vicini, riscrivendo solo la sua chiave. */
export function useReorderProject() {
  return useOptimisticMutation<
    { id: string; before: number | null; after: number | null },
    void,
    Project[]
  >({
    key: qk.projects,
    errorMessage: "Non è stato possibile riordinare i progetti.",
    async mutationFn({ id, before, after }) {
      const { error } = await supabaseBrowser()
        .from("projects")
        .update({ sort_order: orderBetween(before, after) })
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id, before, after }) {
      const next = replaceById(current, id, (project) => ({
        ...project,
        sort_order: orderBetween(before, after),
      }));
      return next?.slice().sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}
