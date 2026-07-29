"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";

import { safeColor } from "@/lib/colors";
import { useIdeas, usePromoteIdeas, useReorderIdea } from "@/lib/hooks/use-ideas";
import { useProjects } from "@/lib/hooks/use-projects";
import { useScheduleTask } from "@/lib/hooks/use-tasks";
import { neighboursForMove } from "@/lib/sort-order";
import { fmtMin, type DayISO } from "@/lib/time";
import type { Idea, Task } from "@/lib/types";
import { haptic } from "@/lib/utils";

/** Cosa si sta trascinando. */
export type DragPayload =
  | { kind: "idea"; idea: Idea }
  | { kind: "task"; task: Task };

/** Dove si può lasciare: uno slot del calendario, o un'altra idea (riordino). */
export type DropData =
  | { kind: "slot"; day: DayISO; minute: number }
  | { kind: "idea" };

/**
 * Un solo contesto di trascinamento per tutta l'app.
 *
 * È l'unico modo perché un'idea presa nella colonna di sinistra possa essere
 * lasciata sul calendario a destra: due contesti separati non si vedono fra
 * loro. Di conseguenza è anche l'unico posto che sa dire cosa succede quando
 * qualcosa viene lasciato da qualche parte.
 */
export function FlussoDndProvider({ children }: { children: React.ReactNode }) {
  const { ideas } = useIdeas();
  const { byId: projectsById } = useProjects();
  const reorderIdea = useReorderIdea();
  const promote = usePromoteIdeas();
  const schedule = useScheduleTask();

  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [target, setTarget] = useState<{ day: DayISO; minute: number } | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    /*
     * Su touch il trascinamento parte solo dopo 220ms di pressione ferma.
     * Senza questo ritardo ogni scorrimento della lista diventerebbe un
     * trascinamento e la pagina non si potrebbe più sfogliare.
     */
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const payload = event.active.data.current as DragPayload | undefined;
    if (!payload) return;
    haptic(15);
    setDragging(payload);
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const over = event.over?.data.current as DropData | undefined;
    setTarget(over?.kind === "slot" ? { day: over.day, minute: over.minute } : null);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const payload = event.active.data.current as DragPayload | undefined;
      const over = event.over?.data.current as DropData | undefined;

      setDragging(null);
      setTarget(null);

      if (!payload || !over) return;
      haptic(15);

      if (over.kind === "slot") {
        if (payload.kind === "task") {
          schedule.mutate({
            id: payload.task.id,
            day: over.day,
            startMinute: over.minute,
            estMinutes: payload.task.est_minutes,
          });
        } else {
          // Un'idea lasciata sul calendario nasce già come blocco pianificato.
          promote.mutate({
            ideas: [payload.idea],
            day: over.day,
            startMinute: over.minute,
          });
        }
        return;
      }

      // Riordino dentro Idee: gli id sono quelli veri delle righe, mai
      // l'indice di un array filtrato, così l'ordinamento attivo non conta.
      if (over.kind === "idea" && payload.kind === "idea") {
        const from = ideas.findIndex((idea) => idea.id === event.active.id);
        const to = ideas.findIndex((idea) => idea.id === event.over?.id);
        if (from < 0 || to < 0 || from === to) return;
        const { before, after } = neighboursForMove(ideas, from, to);
        reorderIdea.mutate({ id: String(event.active.id), before, after });
      }
    },
    [ideas, promote, reorderIdea, schedule],
  );

  const title =
    dragging?.kind === "task" ? dragging.task.title : dragging?.idea.title;
  const projectId =
    dragging?.kind === "task"
      ? dragging.task.project_id
      : (dragging?.idea.project_id ?? null);

  return (
    <DndContext
      /*
       * Un id fisso, non generato. Senza, dnd-kit numera gli `aria-describedby`
       * con un contatore di modulo che sul server e nel browser parte da valori
       * diversi, e l'idratazione fallisce su ogni elemento trascinabile.
       */
      id="flusso"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setTarget(null);
      }}
    >
      {children}

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="pointer-events-none flex max-w-72 items-center gap-2 rounded-flusso-sm border border-line bg-surface px-2.5 py-2 shadow-[var(--shadow-pop)]">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{
                background: safeColor(
                  projectId ? projectsById.get(projectId)?.color : undefined,
                ),
              }}
            />
            <span className="truncate text-sm font-medium">{title}</span>

            {/* L'orario di destinazione, aggiornato mentre ci si muove: senza,
                si scoprirebbe dove è finito il blocco solo dopo averlo mollato. */}
            {target && (
              <span className="chip chip-accent tnum shrink-0">
                {fmtMin(target.minute)}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
