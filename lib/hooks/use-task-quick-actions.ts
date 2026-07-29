"use client";

import {
  CalendarPlus,
  Check,
  ListChecks,
  Play,
  Timer,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import type { MenuItem } from "@/components/ui/item-menu";
import { emit } from "@/lib/events";
import { needsMicroStart } from "@/lib/postpone";
import {
  useDeleteTasks,
  useRestoreTasks,
  useScheduleTask,
  useUnscheduleTask,
  useUpdateTask,
  useSetHighlight,
} from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { addDaysISO, snap, todayISO } from "@/lib/time";
import { isScheduled, type Task } from "@/lib/types";

/**
 * Le azioni che un task porta con sé ovunque compaia: Lista, calendario,
 * scheda di dettaglio. Un solo posto in cui sono definite, così «Fatto»
 * significa la stessa cosa e produce lo stesso effetto in tutti e tre.
 */
export function useTaskQuickActions(options?: {
  /** Apre la scheda del task: la fornisce la sezione che la ospita. */
  onOpen?: (task: Task) => void;
  /** Apre il selettore di giorno e ora. */
  onSchedule?: (task: Task) => void;
}) {
  const update = useUpdateTask();
  const remove = useDeleteTasks();
  const restore = useRestoreTasks();
  const schedule = useScheduleTask();
  const unschedule = useUnscheduleTask();
  const setHighlight = useSetHighlight();

  const toggleDone = useCallback(
    (task: Task) => {
      update.mutate({
        id: task.id,
        status: task.status === "done" ? "inbox" : "done",
      });
    },
    [update],
  );

  const deleteTask = useCallback(
    (task: Task) => {
      remove.mutate({ ids: [task.id] });
      undoableToast({
        message: `«${task.title}» eliminato.`,
        onUndo: () => restore.mutate({ tasks: [task] }),
      });
    },
    [remove, restore],
  );

  const toggleHighlight = useCallback(
    (task: Task) => {
      setHighlight.mutate({
        id: task.id,
        day: task.day ?? todayISO(),
        on: !task.is_daily_highlight,
      });
    },
    [setHighlight],
  );

  /** Butta il task sul primo quarto d'ora utile del giorno indicato. */
  const scheduleQuick = useCallback(
    (task: Task, day: string, startMinute: number) => {
      schedule.mutate({ id: task.id, day, startMinute: snap(startMinute) });
    },
    [schedule],
  );

  const backToList = useCallback(
    (task: Task) => unschedule.mutate({ id: task.id }),
    [unschedule],
  );

  const startFocus = useCallback((task: Task) => {
    emit("flusso:focus-now", { taskId: task.id, autoStart: false });
  }, []);

  /**
   * Il micro-avvio: timer ridotto, un solo sottotask davanti, e la promessa
   * implicita che dopo dieci minuti si può smettere.
   *
   * Si offre **solo** ai task che hanno già slittato due volte, e non per
   * pignoleria: proporlo su tutto lo svaluterebbe. Su un task che parte
   * volentieri non serve un permesso di fermarsi; su uno che slitta da giorni
   * quel permesso è l'unica cosa che lo fa cominciare.
   */
  const microStart = useCallback((task: Task) => {
    emit("flusso:focus-now", { taskId: task.id, micro: true, autoStart: true });
  }, []);

  /** Le stesse azioni come voci di menu, per tasto destro e action sheet. */
  const menuItems = useCallback(
    (task: Task): MenuItem[] => {
      const items: MenuItem[] = [
        {
          id: "done",
          label: task.status === "done" ? "Segna da fare" : "Fatto",
          Icon: Check,
          onSelect: () => toggleDone(task),
        },
        {
          id: "focus",
          label: "Avvia focus",
          Icon: Play,
          onSelect: () => startFocus(task),
        },
      ];

      if (needsMicroStart(task)) {
        items.push({
          id: "micro",
          label: "Solo 10 minuti",
          Icon: Timer,
          onSelect: () => microStart(task),
        });
      }

      if (options?.onSchedule) {
        items.push({
          id: "schedule",
          label: isScheduled(task) ? "Sposta a…" : "Pianifica…",
          Icon: CalendarPlus,
          onSelect: () => options.onSchedule?.(task),
        });
      }

      if (isScheduled(task)) {
        items.push({
          id: "back",
          label: "Riporta in Lista",
          Icon: ListChecks,
          onSelect: () => backToList(task),
        });
      }

      items.push({
        id: "highlight",
        label: task.is_daily_highlight
          ? "Non è più l'highlight"
          : "Rendi highlight del giorno",
        Icon: task.is_daily_highlight ? StarOff : Star,
        onSelect: () => toggleHighlight(task),
        separatorBefore: true,
      });

      items.push({
        id: "delete",
        label: "Elimina",
        Icon: Trash2,
        tone: "danger",
        onSelect: () => deleteTask(task),
        separatorBefore: true,
      });

      return items;
    },
    [
      backToList,
      deleteTask,
      microStart,
      options,
      startFocus,
      toggleDone,
      toggleHighlight,
    ],
  );

  return useMemo(
    () => ({
      toggleDone,
      deleteTask,
      toggleHighlight,
      scheduleQuick,
      backToList,
      startFocus,
      microStart,
      menuItems,
      openTask: options?.onOpen,
      /** Domani, per le scorciatoie di rinvio. */
      tomorrow: addDaysISO(todayISO(), 1),
    }),
    [
      backToList,
      deleteTask,
      menuItems,
      microStart,
      options?.onOpen,
      scheduleQuick,
      startFocus,
      toggleDone,
      toggleHighlight,
    ],
  );
}
