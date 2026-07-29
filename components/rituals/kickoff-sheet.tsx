"use client";

import { Info, Sparkles, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { emit, useFlussoEvent } from "@/lib/events";
import { useReviewHistory, useSaveReview } from "@/lib/hooks/use-reviews";
import { useSetHighlight, useTasks } from "@/lib/hooks/use-tasks";
import { dayTotals, kickoffMessage, typicalCompleted } from "@/lib/rituals";
import { fmtDuration, fmtMin, todayISO } from "@/lib/time";
import { isScheduled } from "@/lib/types";

/**
 * Il rito del mattino.
 *
 * Fa tre cose e basta: mostra la giornata, la confronta con quello che
 * di solito riesce a fare davvero, e chiede l'Highlight se manca. Non è una
 * schermata di pianificazione — quella è il planner — ed è per questo che
 * non permette di aggiungere niente: guardare il piano e cambiarlo sono due
 * momenti mentali diversi.
 */
export function KickoffSheet() {
  const [open, setOpen] = useState(false);
  const today = todayISO();

  const { byDay } = useTasks();
  const { history } = useReviewHistory();
  const save = useSaveReview();
  const setHighlight = useSetHighlight();

  useFlussoEvent(
    "flusso:open-kickoff",
    useCallback(() => setOpen(true), []),
  );

  const dayTasks = useMemo(() => byDay.get(today) ?? [], [byDay, today]);
  const scheduled = useMemo(
    () =>
      dayTasks
        .filter(isScheduled)
        .sort((a, b) => a.start_minute - b.start_minute),
    [dayTasks],
  );

  const totals = useMemo(() => dayTotals(dayTasks), [dayTasks]);
  const typical = useMemo(() => typicalCompleted(history), [history]);
  const message = kickoffMessage({
    plannedMinutes: totals.plannedMinutes,
    typical,
  });

  const highlight = scheduled.find((task) => task.is_daily_highlight);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Buongiorno"
      description={
        totals.tasksPlanned === 0
          ? "Il calendario di oggi è vuoto."
          : `${totals.tasksPlanned} blocchi, ${fmtDuration(totals.plannedMinutes)}.`
      }
      footer={
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            save.mutate({
              type: "kickoff",
              plannedMinutes: totals.plannedMinutes,
              completedMinutes: 0,
              tasksPlanned: totals.tasksPlanned,
              tasksCompleted: 0,
            });
            setOpen(false);
          }}
        >
          Cominciamo
        </button>
      }
    >
      <div className="space-y-3 pb-1">
        {message && (
          <p className="flex items-start gap-2 rounded-flusso-md bg-warn-soft p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-warn" />
            {message}
          </p>
        )}

        {totals.tasksPlanned === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-ink-soft">
              Niente sul calendario. Se non è lì, non succede.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-3"
              onClick={() => {
                setOpen(false);
                emit("flusso:open-planner", {});
              }}
            >
              <Sparkles className="size-4" />
              Pianifica la giornata
            </button>
          </div>
        ) : (
          <>
            {!highlight && (
              <div className="rounded-flusso-md border border-line p-3">
                <p className="text-sm font-medium">
                  Qual è la cosa che conta oggi?
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Una sola. Se salta tutto il resto ma resta questa, la
                  giornata è comunque buona.
                </p>
                <ul className="mt-2 space-y-1">
                  {scheduled.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center gap-2 rounded-flusso-sm px-2 text-left text-sm hover:bg-sunken"
                        onClick={() =>
                          setHighlight.mutate({
                            id: task.id,
                            day: today,
                            on: true,
                          })
                        }
                      >
                        <Star className="size-4 shrink-0 text-ink-faint" />
                        <span className="min-w-0 flex-1 truncate">
                          {task.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="space-y-1">
              {scheduled.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 rounded-flusso-md border border-line p-2.5 text-sm"
                >
                  <span className="tnum shrink-0 text-ink-faint">
                    {fmtMin(task.start_minute)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  {task.is_daily_highlight && (
                    <Star
                      className="size-4 shrink-0 fill-current text-accent"
                      aria-label="Highlight del giorno"
                    />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
