"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { pushTaskToGoogle } from "@/lib/google/push-client";
import { qk } from "@/lib/hooks/query-keys";
import {
  removeByIds,
  replaceById,
  useOptimisticMutation,
} from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Inserts } from "@/lib/supabase/database.types";
import { addDaysISO, todayISO, type DayISO } from "@/lib/time";
import { toTask, type Energy, type Subtask, type Task } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * Quanto indietro guardare. I task ancora aperti si caricano tutti; di quelli
 * chiusi serve solo la coda recente, perché la calibrazione e i grafici hanno
 * le loro query aggregate. Senza questa finestra ogni avvio dell'app
 * scaricherebbe anni di storia per mostrare una giornata.
 */
const HISTORY_DAYS = 30;

async function fetchTasks(): Promise<Task[]> {
  const since = addDaysISO(todayISO(), -HISTORY_DAYS);

  const { data, error } = await supabaseBrowser()
    .from("tasks")
    .select("*")
    .or(`status.eq.inbox,day.gte.${since}`)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toTask);
}

export function useTasks() {
  const query = useQuery({ queryKey: qk.tasks, queryFn: fetchTasks });
  const tasks = useMemo(() => query.data ?? [], [query.data]);

  const byId = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  /** I task pianificati, raggruppati per giorno: il calendario legge questa. */
  const byDay = useMemo(() => {
    const map = new Map<DayISO, Task[]>();
    for (const task of tasks) {
      if (!task.day) continue;
      const list = map.get(task.day);
      if (list) list.push(task);
      else map.set(task.day, [task]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.start_minute ?? 0) - (b.start_minute ?? 0));
    }
    return map;
  }, [tasks]);

  /** Quello che aspetta in Lista: aperto e non ancora sul calendario. */
  const inbox = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "inbox" &&
          task.day === null &&
          task.status_review !== "archived",
      ),
    [tasks],
  );

  return { ...query, tasks, byId, byDay, inbox };
}

// ---------------------------------------------------------------------------
// Creazione
// ---------------------------------------------------------------------------

export type NewTask = {
  title: string;
  notes?: string;
  projectId?: string | null;
  deadline?: string | null;
  estMinutes?: number | null;
  energy?: Energy | null;
  day?: DayISO | null;
  startMinute?: number | null;
  subtasks?: Subtask[];
};

function toInsert(input: NewTask): Inserts<"tasks"> {
  return {
    title: input.title.trim(),
    notes: input.notes ?? "",
    project_id: input.projectId ?? null,
    deadline: input.deadline ?? null,
    est_minutes: input.estMinutes ?? null,
    energy: input.energy ?? null,
    day: input.day ?? null,
    start_minute: input.startMinute ?? null,
    subtasks: input.subtasks ?? [],
  };
}

function draftTask(input: NewTask): Task {
  const now = new Date().toISOString();
  return {
    id: `bozza-${uid()}`,
    user_id: "",
    title: input.title.trim(),
    notes: input.notes ?? "",
    status: "inbox",
    day: input.day ?? null,
    start_minute: input.startMinute ?? null,
    est_minutes: input.estMinutes ?? null,
    energy: input.energy ?? null,
    project_id: input.projectId ?? null,
    deadline: input.deadline ?? null,
    subtasks: input.subtasks ?? [],
    recur_id: null,
    sort_order: Date.now(),
    created_at: now,
    postpone_count: 0,
    last_postponed_at: null,
    actual_duration_minutes: null,
    is_daily_highlight: false,
    highlight_date: null,
    first_planned_at: input.day ? now : null,
    status_review: "active",
    google_event_id: null,
  };
}

export function useCreateTask() {
  return useOptimisticMutation<NewTask, Task, Task[]>({
    key: qk.tasks,
    errorMessage: "Non è stato possibile creare il task.",
    async mutationFn(input) {
      const { data, error } = await supabaseBrowser()
        .from("tasks")
        .insert(toInsert(input))
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    },
    optimistic(current, input) {
      return [draftTask(input), ...(current ?? [])];
    },
  });
}

/** Crea più task in una sola scrittura: la usa la cattura AI dopo la conferma. */
export function useCreateTasks() {
  return useOptimisticMutation<NewTask[], Task[], Task[]>({
    key: qk.tasks,
    errorMessage: "Non è stato possibile creare i task.",
    async mutationFn(inputs) {
      const { data, error } = await supabaseBrowser()
        .from("tasks")
        .insert(inputs.map(toInsert))
        .select();

      if (error) throw error;
      return (data ?? []).map(toTask);
    },
    optimistic(current, inputs) {
      return [...inputs.map(draftTask), ...(current ?? [])];
    },
  });
}

// ---------------------------------------------------------------------------
// Modifica
// ---------------------------------------------------------------------------

/** I campi che l'interfaccia può cambiare direttamente. */
export type TaskChanges = Partial<
  Pick<
    Task,
    | "title"
    | "notes"
    | "status"
    | "day"
    | "start_minute"
    | "est_minutes"
    | "energy"
    | "project_id"
    | "deadline"
    | "subtasks"
    | "status_review"
    | "actual_duration_minutes"
    | "sort_order"
  >
>;

export function useUpdateTask() {
  return useOptimisticMutation<
    { id: string } & TaskChanges,
    Task,
    Task[]
  >({
    key: qk.tasks,
    errorMessage: "Non è stato possibile aggiornare il task.",
    /*
     * Anche le modifiche "normali" possono toccare il calendario: cambiare
     * titolo, durata o stato di un blocco pianificato deve vedersi su Google.
     * La rotta ignora da sé i task che non sono pianificati.
     */
    onSuccess: (task) => pushTaskToGoogle(task.id),
    async mutationFn({ id, ...changes }) {
      const { data, error } = await supabaseBrowser()
        .from("tasks")
        .update(changes)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    },
    optimistic(current, { id, ...changes }) {
      return replaceById(current, id, (task) => ({ ...task, ...changes }));
    },
  });
}

export function useDeleteTasks() {
  return useOptimisticMutation<{ ids: string[] }, void, Task[]>({
    key: qk.tasks,
    errorMessage: "Non è stato possibile eliminare.",
    /*
     * Anche l'eliminazione va riflessa: la rotta, non trovando più il task,
     * cancella l'evento corrispondente. Un blocco cancellato qui che resta sul
     * calendario Google è peggio di non averlo mai sincronizzato.
     */
    onSuccess: (_result, { ids }) => ids.forEach(pushTaskToGoogle),
    async mutationFn({ ids }) {
      const { error } = await supabaseBrowser()
        .from("tasks")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    optimistic(current, { ids }) {
      return removeByIds(current, ids);
    },
  });
}

/**
 * Rimette in vita dei task appena eliminati, **con lo stesso id**.
 *
 * È ciò che rende reale l'«Annulla» del toast: ricreare righe nuove
 * spezzerebbe le sessioni di focus e i riferimenti già scritti altrove.
 */
export function useRestoreTasks() {
  return useOptimisticMutation<{ tasks: Task[] }, void, Task[]>({
    key: qk.tasks,
    errorMessage: "Non è stato possibile annullare l'eliminazione.",
    async mutationFn({ tasks }) {
      const { error } = await supabaseBrowser()
        .from("tasks")
        .insert(
          tasks.map(({ user_id: _user, ...task }) => ({
            ...task,
            subtasks: task.subtasks,
          })),
        );
      if (error) throw error;
    },
    optimistic(current, { tasks }) {
      return [...tasks, ...(current ?? [])];
    },
  });
}

/** Modifiche in blocco dalla selezione multipla della Lista. */
export function useBulkUpdateTasks() {
  return useOptimisticMutation<
    { ids: string[] } & TaskChanges,
    void,
    Task[]
  >({
    key: qk.tasks,
    errorMessage: "Non è stato possibile aggiornare i task.",
    async mutationFn({ ids, ...changes }) {
      const { error } = await supabaseBrowser()
        .from("tasks")
        .update(changes)
        .in("id", ids);
      if (error) throw error;
    },
    optimistic(current, { ids, ...changes }) {
      const set = new Set(ids);
      return current?.map((task) =>
        set.has(task.id) ? { ...task, ...changes } : task,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Pianificazione
// ---------------------------------------------------------------------------

/**
 * Mette un task sul calendario. Se arriva dalla Lista senza stima, gliene dà
 * una di default: un blocco senza durata il database non lo accetta, e
 * chiedere la stima proprio mentre si trascina spezzerebbe il gesto.
 */
export function useScheduleTask() {
  return useOptimisticMutation<
    {
      id: string;
      day: DayISO;
      startMinute: number;
      estMinutes?: number | null;
    },
    Task,
    Task[]
  >({
    key: qk.tasks,
    errorMessage: "Non è stato possibile pianificare il task.",
    // Il blocco appena messo sul calendario va riflesso anche su Google.
    onSuccess: (task) => pushTaskToGoogle(task.id),
    async mutationFn({ id, day, startMinute, estMinutes }) {
      const supabase = supabaseBrowser();
      let duration = estMinutes ?? null;

      if (duration == null) {
        const { data: existing } = await supabase
          .from("tasks")
          .select("est_minutes")
          .eq("id", id)
          .single();
        duration = existing?.est_minutes ?? 30;
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({
          day,
          start_minute: startMinute,
          est_minutes: duration,
          status: "inbox",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    },
    optimistic(current, { id, day, startMinute, estMinutes }) {
      return replaceById(current, id, (task) => ({
        ...task,
        day,
        start_minute: startMinute,
        est_minutes: estMinutes ?? task.est_minutes ?? 30,
        first_planned_at: task.first_planned_at ?? new Date().toISOString(),
      }));
    },
  });
}

/** Riporta un task in Lista, togliendolo dal calendario. */
export function useUnscheduleTask() {
  return useOptimisticMutation<{ id: string }, Task, Task[]>({
    key: qk.tasks,
    errorMessage: "Non è stato possibile riportare il task in Lista.",
    // Tolto dal calendario qui, va tolto anche di là.
    onSuccess: (task) => pushTaskToGoogle(task.id),
    async mutationFn({ id }) {
      const { data, error } = await supabaseBrowser()
        .from("tasks")
        .update({ day: null, start_minute: null, status: "inbox" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    },
    optimistic(current, { id }) {
      return replaceById(current, id, (task) => ({
        ...task,
        day: null,
        start_minute: null,
        status: "inbox",
      }));
    },
  });
}

/**
 * Rinvia un task a un altro giorno e ne tiene il conto: è il dato su cui si
 * basano il badge `↺N` e il dialogo del terzo rinvio.
 */
export function usePostponeTask() {
  return useOptimisticMutation<
    { id: string; day: DayISO | null; startMinute?: number | null },
    Task,
    Task[]
  >({
    key: qk.tasks,
    errorMessage: "Non è stato possibile rinviare il task.",
    onSuccess: (task) => pushTaskToGoogle(task.id),
    async mutationFn({ id, day, startMinute }) {
      const supabase = supabaseBrowser();
      const { data: existing, error: readError } = await supabase
        .from("tasks")
        .select("postpone_count")
        .eq("id", id)
        .single();
      if (readError) throw readError;

      const { data, error } = await supabase
        .from("tasks")
        .update({
          day,
          start_minute: day ? (startMinute ?? null) : null,
          postpone_count: (existing?.postpone_count ?? 0) + 1,
          last_postponed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return toTask(data);
    },
    optimistic(current, { id, day, startMinute }) {
      return replaceById(current, id, (task) => ({
        ...task,
        day,
        start_minute: day ? (startMinute ?? null) : null,
        postpone_count: task.postpone_count + 1,
        last_postponed_at: new Date().toISOString(),
      }));
    },
  });
}

/**
 * L'highlight del giorno è uno solo, e il database lo impone con un indice
 * unico. Prima di assegnarlo va quindi tolto a chi ce l'ha, altrimenti la
 * scrittura verrebbe respinta.
 */
export function useSetHighlight() {
  return useOptimisticMutation<
    { id: string; day: DayISO; on: boolean },
    void,
    Task[]
  >({
    key: qk.tasks,
    errorMessage: "Non è stato possibile cambiare l'highlight.",
    async mutationFn({ id, day, on }) {
      const supabase = supabaseBrowser();

      if (!on) {
        const { error } = await supabase
          .from("tasks")
          .update({ is_daily_highlight: false, highlight_date: null })
          .eq("id", id);
        if (error) throw error;
        return;
      }

      const { error: clearError } = await supabase
        .from("tasks")
        .update({ is_daily_highlight: false, highlight_date: null })
        .eq("highlight_date", day)
        .neq("id", id);
      if (clearError) throw clearError;

      const { error } = await supabase
        .from("tasks")
        .update({ is_daily_highlight: true, highlight_date: day })
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id, day, on }) {
      return current?.map((task) => {
        if (task.id === id) {
          return {
            ...task,
            is_daily_highlight: on,
            highlight_date: on ? day : null,
          };
        }
        // Chiunque altro avesse l'highlight di quel giorno lo perde subito.
        if (on && task.highlight_date === day) {
          return { ...task, is_daily_highlight: false, highlight_date: null };
        }
        return task;
      });
    },
  });
}
