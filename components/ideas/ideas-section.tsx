"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Lightbulb } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { IdeaCard } from "@/components/ideas/idea-card";
import { CaptureBar } from "@/components/shared/capture-bar";
import { SelectionBar } from "@/components/shared/selection-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionStatus } from "@/components/ui/section-status";
import {
  useCreateIdea,
  useDeleteIdeas,
  useIdeas,
  usePromoteIdeas,
  useRestoreIdeas,
  useSetIdeasProject,
  useUpdateIdea,
} from "@/lib/hooks/use-ideas";
import { useProjects } from "@/lib/hooks/use-projects";
import { useDeleteTasks } from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import type { Idea } from "@/lib/types";

/**
 * Cattura pura: nessun campo obbligatorio, nessuna decisione da prendere.
 * Tutto ciò che è triage — scadenze, stime, energia — vive in Lista.
 *
 * Il riordino trascinabile è qui solo come `SortableContext`: il contesto di
 * trascinamento vero sta nella shell, ed è ciò che permette di portare
 * un'idea fino al calendario dell'altra colonna.
 */
export function IdeasSection() {
  const { ideas, isLoading, isError, error, refetch } = useIdeas();
  const { byId: projectsById } = useProjects();

  const create = useCreateIdea();
  const update = useUpdateIdea();
  const remove = useDeleteIdeas();
  const restore = useRestoreIdeas();
  const promote = usePromoteIdeas();
  const setProject = useSetIdeasProject();
  const removeTasks = useDeleteTasks();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ids = useMemo(() => ideas.map((idea) => idea.id), [ideas]);
  const selectedIdeas = useMemo(
    () => ideas.filter((idea) => selected.has(idea.id)),
    [ideas, selected],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const promoteIdeas = useCallback(
    async (list: Idea[]) => {
      if (list.length === 0) return;
      setSelected(new Set());

      const created = await promote.mutateAsync({ ideas: list });
      undoableToast({
        message:
          list.length === 1
            ? `«${list[0].title}» è in Lista.`
            : `${list.length} idee sono in Lista.`,
        onUndo: () => {
          // Annullare significa disfare entrambi i lati: i task creati vanno
          // via, le idee tornano con lo stesso id.
          removeTasks.mutate({ ids: created.map((task) => task.id) });
          restore.mutate({ ideas: list });
        },
      });
    },
    [promote, removeTasks, restore],
  );

  const deleteIdeas = useCallback(
    (list: Idea[]) => {
      if (list.length === 0) return;
      setSelected(new Set());
      remove.mutate({ ids: list.map((idea) => idea.id) });
      undoableToast({
        message:
          list.length === 1
            ? `«${list[0].title}» eliminata.`
            : `${list.length} idee eliminate.`,
        onUndo: () => restore.mutate({ ideas: list }),
      });
    },
    [remove, restore],
  );

  return (
    <section className="panel overflow-hidden" aria-label="Idee">
      <CaptureBar
        variant="idea"
        placeholder="Cosa ti è appena venuto in mente?"
        onSubmit={({ title, projectId }) => create.mutate({ title, projectId })}
      />

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onSetProject={(projectId) =>
            setProject.mutate({
              ids: selectedIdeas.map((idea) => idea.id),
              projectId,
            })
          }
          onPromote={() => void promoteIdeas(selectedIdeas)}
          onDelete={() => deleteIdeas(selectedIdeas)}
        />
      )}

      {ideas.length === 0 ? (
        <SectionStatus
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => void refetch()}
          empty={
            <EmptyState
              Icon={Lightbulb}
              title="Nessuna idea in attesa"
              description="Scrivi un pensiero appena ti passa per la testa: deciderai dopo se merita un blocco."
            />
          }
        />
      ) : (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul>
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                project={
                  idea.project_id
                    ? projectsById.get(idea.project_id)
                    : undefined
                }
                selected={selected.has(idea.id)}
                selectionActive={selected.size > 0}
                onToggleSelect={toggleSelect}
                onRename={(id, title) => update.mutate({ id, title })}
                onPromote={(one) => void promoteIdeas([one])}
                onDelete={(one) => deleteIdeas([one])}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}
