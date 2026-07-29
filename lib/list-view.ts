import type { ListFilters, ListSort } from "@/components/list/list-toolbar";
import { deadlineTone, todayISO, type DayISO } from "@/lib/time";
import type { Project, Task } from "@/lib/types";

export type TaskGroup = {
  id: string;
  label: string;
  /** Colore del progetto, per la barra del gruppo. */
  color?: string;
  tasks: Task[];
};

const NO_PROJECT = "senza-progetto";

/** Quello che la Lista mostra: aperto, non archiviato, non ancora sul calendario. */
export function isListable(task: Task): boolean {
  return task.day === null && task.status_review !== "archived";
}

export function matchesFilters(
  task: Task,
  filters: ListFilters,
  today: DayISO,
): boolean {
  if (filters.projectId && task.project_id !== filters.projectId) return false;
  if (filters.energy && task.energy !== filters.energy) return false;
  if (filters.deadlineSoon) {
    if (!task.deadline) return false;
    if (deadlineTone(task.deadline, today) === "later") return false;
  }
  return true;
}

/**
 * Ordina per scadenza: chi non ne ha va in fondo, non in cima. Una scadenza
 * assente non è urgentissima, è assente.
 */
function byDeadline(a: Task, b: Task): number {
  if (a.deadline === b.deadline) return a.sort_order - b.sort_order;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline < b.deadline ? -1 : 1;
}

/** I completati scendono in fondo al proprio gruppo, senza sparire. */
function doneLast(compare: (a: Task, b: Task) => number) {
  return (a: Task, b: Task): number => {
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return compare(a, b);
  };
}

/**
 * Trasforma i task nella forma che la Lista disegna: filtrati, ordinati e —
 * con l'ordinamento per progetto — raggruppati.
 *
 * È una funzione pura, e non un calcolo dentro al componente, perché è dove
 * si annidano gli errori silenziosi di ordinamento; averla qui la rende
 * verificabile senza montare nulla.
 */
export function buildListGroups({
  tasks,
  projects,
  sort,
  filters,
  today = todayISO(),
}: {
  tasks: Task[];
  projects: Project[];
  sort: ListSort;
  filters: ListFilters;
  today?: DayISO;
}): TaskGroup[] {
  const visible = tasks.filter(
    (task) => isListable(task) && matchesFilters(task, filters, today),
  );

  if (sort === "scadenza") {
    return asSingleGroup(visible.slice().sort(doneLast(byDeadline)));
  }

  if (sort === "manuale") {
    return asSingleGroup(
      visible.slice().sort(doneLast((a, b) => a.sort_order - b.sort_order)),
    );
  }

  // Per progetto: i gruppi seguono l'ordine dei progetti, i task dentro
  // ciascun gruppo seguono la scadenza.
  const byProject = new Map<string, Task[]>();
  for (const task of visible) {
    const key = task.project_id ?? NO_PROJECT;
    const list = byProject.get(key);
    if (list) list.push(task);
    else byProject.set(key, [task]);
  }

  const groups: TaskGroup[] = [];

  for (const project of projects) {
    const list = byProject.get(project.id);
    if (!list || list.length === 0) continue;
    groups.push({
      id: project.id,
      label: project.name,
      color: project.color,
      tasks: list.sort(doneLast(byDeadline)),
    });
  }

  // Chi non ha progetto chiude la lista: è materiale da smistare, non un
  // capitolo a sé.
  const orphans = byProject.get(NO_PROJECT);
  if (orphans && orphans.length > 0) {
    groups.push({
      id: NO_PROJECT,
      label: "Senza progetto",
      tasks: orphans.sort(doneLast(byDeadline)),
    });
  }

  return groups;
}

function asSingleGroup(tasks: Task[]): TaskGroup[] {
  return tasks.length === 0 ? [] : [{ id: "tutti", label: "Tutti", tasks }];
}

/** Quanti task passano i filtri, senza costruire i gruppi. */
export function countVisible(
  tasks: Task[],
  filters: ListFilters,
  today: DayISO = todayISO(),
): number {
  return tasks.filter(
    (task) => isListable(task) && matchesFilters(task, filters, today),
  ).length;
}
