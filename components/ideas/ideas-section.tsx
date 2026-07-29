"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
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
import {
  useCreateIdea,
  useDeleteIdeas,
  useIdeas,
  usePromoteIdeas,
  useReorderIdea,
  useRestoreIdeas,
  useSetIdeasProject,
  useUpdateIdea,
} from "@/lib/hooks/use-ideas";
import { useProjects } from "@/lib/hooks/use-projects";
import { useDeleteTasks } from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { neighboursForMove } from "@/lib/sort-order";
import type { Idea } from "@/lib/types";
import { haptic } from "@/lib/utils";

/**
 * Cattura pura: nessun campo obbligatorio, nessuna decisione da prendere.
 * Tutto ciò che è triage — scadenze, stime, energia — vive in Lista.
 */
export function IdeasSection() {
  const { ideas, isLoading } = useIdeas();
  const { byId: projectsById } = useProjects();

  const create = useCreateIdea();
  const update = useUpdateIdea();
  const remove = useDeleteIdeas();
  const restore = useRestoreIdeas();
  const promote = usePromoteIdeas();
  const reorder = useReorderIdea();
  const setProject = useSetIdeasProject();
  const removeTasks = useDeleteTasks();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Su touch il trascinamento parte solo dopo una pausa: senza questo
    // ritardo ogni scorrimento della lista diventerebbe un trascinamento.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
  );

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

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const from = ideas.findIndex((idea) => idea.id === active.id);
      const to = ideas.findIndex((idea) => idea.id === over.id);
      if (from < 0 || to < 0) return;

      haptic();
      const { before, after } = neighboursForMove(ideas, from, to);
      reorder.mutate({ id: String(active.id), before, after });
    },
    [ideas, reorder],
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
        !isLoading && (
          <EmptyState
            Icon={Lightbulb}
            title="Nessuna idea in attesa"
            description="Scrivi un pensiero appena ti passa per la testa: deciderai dopo se merita un blocco."
          />
        )
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={() => haptic()}
          onDragEnd={onDragEnd}
        >
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
        </DndContext>
      )}
    </section>
  );
}
