"use client";

import { Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AiErrorNotice } from "@/components/ai/ai-error";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { useFlussoEvent } from "@/lib/events";
import { useAiShutdown, type ShutdownSuggestion } from "@/lib/hooks/use-ai";
import { usePlannerContext } from "@/lib/hooks/use-planner-context";
import { useReviews, useSaveReview } from "@/lib/hooks/use-reviews";
import {
  useDeleteTasks,
  useRestoreTasks,
  useScheduleTask,
  useTasks,
  useUnscheduleTask,
  useUpdateTask,
} from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { availableGaps } from "@/lib/planner";
import {
  carryOverLeft,
  dayTotals,
  formatSlots,
  MAX_CARRY_OVER,
  shutdownSummary,
  type PendingChoice,
} from "@/lib/rituals";
import { addDaysISO, fmtDuration, fmtMin, todayISO } from "@/lib/time";
import { isScheduled } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHOICES: Array<{ id: PendingChoice; label: string }> = [
  { id: "domani", label: "Domani" },
  { id: "lista", label: "In Lista" },
  { id: "fatto", label: "Fatto" },
  // «Ridimensiona» è la risposta onesta al caso più comune: il task non era
  // troppo difficile, era troppo grosso. Torna in Lista già più corto.
  { id: "ridimensiona", label: "Ridimensiona" },
  { id: "elimina", label: "Lascia perdere" },
];

/** Di quanto si accorcia un task ridimensionato, al minimo un quarto d'ora. */
function shrunk(minutes: number | null): number {
  return Math.max(15, Math.round(((minutes ?? 30) / 2) / 5) * 5);
}

/**
 * Il rito della sera.
 *
 * **Nessun rinvio automatico**: per ogni blocco rimasto indietro c'è una
 * domanda, e quattro risposte possibili. Spostare tutto a domani con un
 * pulsante sarebbe comodo e falso — domani è già un giorno pieno, e il
 * tetto di tre riporti è lì per ricordarlo.
 */
export function ShutdownSheet() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [choices, setChoices] = useState<Record<string, PendingChoice>>({});
  const [suggestions, setSuggestions] = useState<ShutdownSuggestion[]>([]);

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  const { byDay } = useTasks();
  const { shutdown: existing } = useReviews(today);
  const save = useSaveReview();
  const schedule = useScheduleTask();
  const unschedule = useUnscheduleTask();
  const update = useUpdateTask();
  const remove = useDeleteTasks();
  const restore = useRestoreTasks();
  const context = usePlannerContext();
  const ai = useAiShutdown();

  useFlussoEvent(
    "flusso:open-shutdown",
    useCallback(() => {
      setOpen(true);
      setChoices({});
      setSuggestions([]);
      setNotes(existing?.notes ?? "");
    }, [existing]),
  );

  const dayTasks = useMemo(() => byDay.get(today) ?? [], [byDay, today]);
  const totals = useMemo(() => dayTotals(dayTasks), [dayTasks]);

  const pending = useMemo(
    () =>
      dayTasks
        .filter(isScheduled)
        .filter((task) => task.status !== "done")
        .sort((a, b) => a.start_minute - b.start_minute),
    [dayTasks],
  );

  const left = carryOverLeft(choices);
  const missing = pending.filter((task) => !choices[task.id]).length;
  const answered = missing === 0;

  const askAi = useCallback(() => {
    const forTomorrow = pending.filter(
      (task) => choices[task.id] === "domani",
    );
    if (forTomorrow.length === 0) return;

    const [contextTomorrow] = context.contextsFor([tomorrow]);
    const gaps = availableGaps(
      { start: context.settings.workStart, end: context.settings.workEnd },
      contextTomorrow.busy,
      context.settings.bufferMinutes,
    );

    ai.mutate(
      {
        domani: tomorrow,
        taskIds: forTomorrow.map((task) => task.id),
        slotLiberi: formatSlots(gaps, fmtMin),
      },
      { onSuccess: ({ suggerimenti }) => setSuggestions(suggerimenti) },
    );
  }, [ai, choices, context, pending, tomorrow]);

  const confirm = useCallback(async () => {
    const dropped = pending.filter((task) => choices[task.id] === "elimina");

    for (const task of pending) {
      const choice = choices[task.id];
      if (!choice) continue;

      if (choice === "fatto") {
        await update.mutateAsync({ id: task.id, status: "done" });
      } else if (choice === "elimina") {
        await remove.mutateAsync({ ids: [task.id] });
      } else if (choice === "lista") {
        await unschedule.mutateAsync({ id: task.id });
      } else if (choice === "ridimensiona") {
        // Torna in Lista con la stima dimezzata: la prossima volta chiede
        // metà del tempo, che è di solito ciò che serve perché parta.
        await update.mutateAsync({
          id: task.id,
          est_minutes: shrunk(task.est_minutes),
        });
        await unschedule.mutateAsync({ id: task.id });
      } else {
        const suggested = suggestions.find((one) => one.taskId === task.id);
        await schedule.mutateAsync({
          id: task.id,
          day: tomorrow,
          // L'orario suggerito se c'è, altrimenti lo stesso di oggi: una
          // scelta prevedibile è meglio di una inventata.
          startMinute: suggested?.startMinute ?? task.start_minute,
          estMinutes: task.est_minutes,
        });
      }
    }

    await save.mutateAsync({
      type: "shutdown",
      plannedMinutes: totals.plannedMinutes,
      completedMinutes: totals.completedMinutes,
      tasksPlanned: totals.tasksPlanned,
      tasksCompleted: totals.tasksCompleted,
      notes: notes.trim() || null,
    });

    setOpen(false);

    // Anche dentro un rito, «lascia perdere» resta annullabile: la scelta si
    // fa in fretta, in fondo a una giornata stanca.
    if (dropped.length > 0) {
      undoableToast({
        message:
          dropped.length === 1
            ? `Giornata chiusa. «${dropped[0].title}» eliminato.`
            : `Giornata chiusa. ${dropped.length} task eliminati.`,
        onUndo: () => restore.mutate({ tasks: dropped }),
      });
    } else {
      toast.success("Giornata chiusa.");
    }
  }, [
    choices,
    notes,
    pending,
    remove,
    save,
    schedule,
    suggestions,
    tomorrow,
    totals,
    restore,
    unschedule,
    update,
  ]);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Chiudiamo la giornata"
      description={shutdownSummary(totals)}
      footer={
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!answered || save.isPending}
          onClick={() => void confirm()}
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {answered
            ? "Chiudi la giornata"
            : missing === 1
              ? "Rispondi all'ultimo blocco"
              : `Rispondi a ${missing} blocchi`}
        </button>
      }
    >
      <div className="space-y-3 pb-1">
        {pending.length > 0 && (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="label">Rimasti indietro</p>
              <span className="text-xs text-ink-faint">
                {left} riporti su {MAX_CARRY_OVER}
              </span>
            </div>

            <ul className="space-y-1.5">
              {pending.map((task) => {
                const choice = choices[task.id];
                const suggested = suggestions.find(
                  (one) => one.taskId === task.id,
                );

                return (
                  <li
                    key={task.id}
                    className="rounded-flusso-md border border-line p-2.5"
                  >
                    <p className="truncate text-sm">{task.title}</p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {CHOICES.map((option) => {
                        const blocked =
                          option.id === "domani" &&
                          choice !== "domani" &&
                          left === 0;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={choice === option.id}
                            disabled={blocked}
                            onClick={() =>
                              setChoices((current) => ({
                                ...current,
                                [task.id]: option.id,
                              }))
                            }
                            className={cn(
                              "chip min-h-9 cursor-pointer",
                              choice === option.id && "chip-accent",
                              option.id === "elimina" &&
                                choice === option.id &&
                                "chip-danger",
                              blocked && "cursor-not-allowed opacity-40",
                            )}
                          >
                            {option.id === "fatto" && (
                              <Check className="size-3.5" />
                            )}
                            {option.id === "elimina" && (
                              <Trash2 className="size-3.5" />
                            )}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {choice === "ridimensiona" && (
                      <p className="mt-1.5 text-xs text-ink-faint">
                        Torna in Lista da {fmtDuration(shrunk(task.est_minutes))}
                        , invece di {fmtDuration(task.est_minutes)}.
                      </p>
                    )}

                    {suggested && choice === "domani" && (
                      <p className="mt-1.5 text-xs text-ink-faint">
                        Domani alle {fmtMin(suggested.startMinute)}
                        {suggested.motivo ? ` · ${suggested.motivo}` : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {left < MAX_CARRY_OVER && (
              <>
                <button
                  type="button"
                  className="btn btn-soft w-full"
                  onClick={askAi}
                  disabled={ai.isPending}
                >
                  {ai.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Dove li metto domani?
                </button>
                <AiErrorNotice error={ai.error} onRetry={askAi} />
              </>
            )}

            {ai.data?.commento && (
              <p className="rounded-flusso-md bg-sunken p-3 text-sm text-ink-soft">
                {ai.data.commento}
              </p>
            )}
          </>
        )}

        {pending.length === 0 && totals.tasksPlanned > 0 && (
          <p className="py-2 text-center text-sm text-ink-soft">
            Non è rimasto niente in sospeso.
          </p>
        )}

        <div>
          <label className="label" htmlFor="shutdown-note">
            Qualcosa da annotare
          </label>
          <textarea
            id="shutdown-note"
            className="field mt-1.5 min-h-20 resize-y"
            placeholder="Com'è andata, cosa ti ha bloccato, cosa provare domani."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </ResponsiveSheet>
  );
}
