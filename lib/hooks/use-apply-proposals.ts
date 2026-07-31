"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { mergePatch } from "@/lib/ai/capture";
import type { CaptureProposal } from "@/lib/ai/schemas";
import {
  useCreateTasks,
  useDeleteTasks,
  useRestoreTasks,
  useUpdateTask,
} from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { useTasks } from "@/lib/hooks/use-tasks";
import { uid } from "@/lib/utils";

/**
 * Il momento in cui le proposte diventano righe.
 *
 * Sta qui e non nella route: la scrittura parte dal client, **dopo** la
 * conferma, e passa dagli stessi hook ottimistici di tutto il resto. Così
 * una modifica proposta dall'AI si comporta come una fatta a mano — stessa
 * reattività, stesso rollback, stesso annulla.
 */
export function useApplyProposals() {
  const { tasks } = useTasks();
  const create = useCreateTasks();
  const update = useUpdateTask();
  const remove = useDeleteTasks();
  const restore = useRestoreTasks();

  const [isPending, setPending] = useState(false);

  const run = useCallback(
    async (proposals: CaptureProposal[]) => {
      if (proposals.length === 0) return;
      setPending(true);

      const created = proposals.filter((one) => one.action === "crea");
      const merged = proposals.filter((one) => one.action === "unisci");
      const completed = proposals.filter((one) => one.action === "completa");
      const deleted = proposals.filter((one) => one.action === "elimina");

      try {
        if (created.length > 0) {
          await create.mutateAsync(
            created.map((one) => ({
              title: one.title,
              notes: one.notes,
              projectId: one.projectId,
              deadline: one.deadline,
              estMinutes: one.estMinutes,
              energy: one.energy,
              subtasks: one.subtasks.map((text) => ({
                id: uid(),
                text,
                done: false,
              })),
            })),
          );
        }

        for (const one of merged) {
          if (!one.taskId) continue;
          const target = tasks.find((task) => task.id === one.taskId);
          if (!target) continue;
          // Un merge aggiorna solo ciò che la frase ha effettivamente detto, e
          // aggiunge in coda note e passaggi invece di sostituirli: vedi
          // `mergePatch`.
          await update.mutateAsync({ id: one.taskId, ...mergePatch(target, one) });
        }

        for (const one of completed) {
          if (!one.taskId) continue;
          await update.mutateAsync({ id: one.taskId, status: "done" });
        }

        if (deleted.length > 0) {
          const ids = deleted.map((one) => one.taskId).filter(isString);
          const before = tasks.filter((task) => ids.includes(task.id));
          await remove.mutateAsync({ ids });
          undoableToast({
            message:
              ids.length === 1
                ? "Task eliminato."
                : `${ids.length} task eliminati.`,
            onUndo: () => restore.mutate({ tasks: before }),
          });
        }

        const total = proposals.length;
        if (deleted.length !== total) {
          toast.success(
            total === 1 ? "Fatto." : `${total} modifiche applicate.`,
          );
        }
      } finally {
        setPending(false);
      }
    },
    [create, remove, restore, tasks, update],
  );

  return { run, isPending };
}

function isString(value: string | null): value is string {
  return value !== null;
}
