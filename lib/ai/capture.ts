import {
  MAX_PROPOSALS,
  toAction,
  toDeadline,
  toEnergy,
  toEstimate,
  toText,
  type CaptureProposal,
  type captureSchema,
} from "@/lib/ai/schemas";
import type { Project, Task } from "@/lib/types";
import type { z } from "zod";

/**
 * Da quello che ha risposto il modello a proposte che si possono mostrare.
 *
 * Funzione pura, e non per eleganza: è il punto in cui un output plausibile
 * ma sbagliato — un progetto che non esiste, un task già eliminato, una
 * scadenza nel formato americano — smette di essere pericoloso. Tutto ciò
 * che non si riconosce si scarta o si azzera; niente arriva all'utente
 * riferito a righe che non esistono.
 */
export function normalizeCapture({
  raw,
  projects,
  tasks,
}: {
  raw: z.infer<typeof captureSchema>;
  projects: Project[];
  tasks: Task[];
}): CaptureProposal[] {
  const byName = new Map(
    projects.map((project) => [project.name.trim().toLowerCase(), project.id]),
  );
  const taskIds = new Map(tasks.map((task) => [task.id, task]));

  const proposals: CaptureProposal[] = [];

  for (const item of raw.proposte ?? []) {
    if (proposals.length >= MAX_PROPOSALS) break;

    const action = toAction(item.azione);
    const target = item.taskId ? taskIds.get(item.taskId) : undefined;

    // Unire, completare o eliminare ha senso solo su un task che esiste
    // davvero: senza bersaglio la proposta si scarta, non si trasforma in
    // una creazione a sorpresa.
    if (action !== "crea" && !target) continue;

    const title =
      toText(item.titolo, 200) || (target ? target.title : "");
    if (!title) continue;

    const projectFromName = item.progetto
      ? byName.get(item.progetto.trim().toLowerCase())
      : undefined;

    proposals.push({
      id: `${action}-${proposals.length}-${target?.id ?? "nuovo"}`,
      action,
      title,
      taskId: target?.id ?? null,
      projectId: projectFromName ?? target?.project_id ?? null,
      deadline: toDeadline(item.scadenza),
      estMinutes: toEstimate(item.stimaMinuti),
      energy: toEnergy(item.energia),
      subtasks: (item.sottotask ?? [])
        .map((one) => toText(one, 200))
        .filter((one) => one.length > 0)
        .slice(0, 20),
      notes: toText(item.note, 2000),
      reason: toText(item.motivo, 200),
    });
  }

  return proposals;
}

/**
 * I task da dare in pasto al modello per il confronto.
 *
 * Mandare l'intero database sarebbe costoso e inutile: per proporre un merge
 * bastano i task ancora aperti, e in numero limitato.
 */
export function captureContext(tasks: Task[], limit = 60): Task[] {
  return tasks
    .filter((task) => task.status !== "done" && task.status_review !== "archived")
    .slice(0, limit);
}
