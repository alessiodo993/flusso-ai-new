"use client";

import { Hand, Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AiErrorNotice } from "@/components/ai/ai-error";
import { PlacementList } from "@/components/ai/placement-list";
import { PlannerTaskPicker } from "@/components/ai/planner-task-picker";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { useFlussoEvent } from "@/lib/events";
import { useAiPlan } from "@/lib/hooks/use-ai";
import { usePlannerContext } from "@/lib/hooks/use-planner-context";
import { useProjects } from "@/lib/hooks/use-projects";
import { useScheduleTask, useTasks } from "@/lib/hooks/use-tasks";
import { isListable } from "@/lib/list-view";
import { planDays, planningDays, type Placement } from "@/lib/planner";
import { fmtDuration, todayISO } from "@/lib/time";

type Mode = "ai" | "io";

/**
 * «Pianifica con AI».
 *
 * Due modalità, una sola aritmetica: in entrambe gli orari li calcola
 * `lib/planner.ts`. Cambia solo **chi sceglie i task** — il modello o
 * l'utente. E in entrambe il risultato è una schermata da correggere prima
 * di confermare: finché non si preme in fondo, il calendario non cambia.
 */
export function PlannerSheet() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ai");
  const [dayCount, setDayCount] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [unplaced, setUnplaced] = useState<Array<{ taskId: string; reason: string }>>([]);
  const [note, setNote] = useState("");

  const today = todayISO();
  const { tasks, byId: tasksById } = useTasks();
  const { byId: projectsById } = useProjects();
  const schedule = useScheduleTask();
  const plan = useAiPlan();
  const context = usePlannerContext();

  const days = useMemo(() => planningDays(today, dayCount), [dayCount, today]);
  const candidates = useMemo(
    () => tasks.filter((task) => task.status !== "done" && isListable(task)),
    [tasks],
  );

  const reset = useCallback(() => {
    setPlacements(null);
    setUnplaced([]);
    setNote("");
    plan.reset();
  }, [plan]);

  useFlussoEvent(
    "flusso:open-planner",
    useCallback(() => {
      setOpen(true);
      reset();
    }, [reset]),
  );

  /** Il solver, uguale per le due modalità: cambia solo l'ordine in ingresso. */
  const solve = useCallback(
    (ordered: typeof candidates) => {
      const result = planDays({
        tasks: ordered,
        days: context.contextsFor(days),
        settings: context.settings,
        coefficient: context.coefficient,
        today,
        boostedProjects: context.behindProjects,
      });
      setPlacements(result.placements);
      setUnplaced(result.unplaced);
    },
    [context, days, today],
  );

  const run = useCallback(() => {
    if (mode === "io") {
      solve(candidates.filter((task) => picked.has(task.id)));
      return;
    }

    plan.mutate(
      {
        giorni: days,
        minutiDisponibili: context.minutesAvailable(days),
        coefficiente: context.coefficient,
        progettiIndietro: [...context.behindProjects]
          .map((id) => projectsById.get(id)?.name)
          .filter((name): name is string => Boolean(name)),
      },
      {
        onSuccess: ({ scelte, nota }) => {
          setNote(nota);
          // L'ordine dell'AI è la sua priorità: il solver riceve i task già
          // in quell'ordine e non lo ribalta se non per i suoi criteri.
          const chosen = scelte
            .map((choice) => tasksById.get(choice.taskId))
            .filter((task): task is NonNullable<typeof task> => Boolean(task));
          solve(chosen);
        },
      },
    );
  }, [candidates, context, days, mode, picked, plan, projectsById, solve, tasksById]);

  const confirm = useCallback(async () => {
    if (!placements || placements.length === 0) return;

    await Promise.all(
      placements.map((placement) =>
        schedule.mutateAsync({
          id: placement.taskId,
          day: placement.day,
          startMinute: placement.startMinute,
          estMinutes: placement.estMinutes,
        }),
      ),
    );

    toast.success(
      placements.length === 1
        ? "Blocco messo sul calendario."
        : `${placements.length} blocchi sul calendario.`,
    );
    setOpen(false);
    reset();
  }, [placements, reset, schedule]);

  const totalMinutes = (placements ?? []).reduce(
    (sum, one) => sum + one.estMinutes,
    0,
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      title="Pianifica"
      description={
        placements
          ? "Sposta, togli, cambia orario. Il calendario cambia solo quando confermi."
          : "Scegli quanti giorni riempire e chi decide cosa metterci."
      }
      footer={
        placements ? (
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={reset}>
              Rifai
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={placements.length === 0 || schedule.isPending}
              onClick={() => void confirm()}
            >
              {schedule.isPending && <Loader2 className="size-4 animate-spin" />}
              {placements.length === 0
                ? "Niente da mettere"
                : `Metti ${placements.length} · ${fmtDuration(totalMinutes)}`}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={
              plan.isPending || (mode === "io" && picked.size === 0)
            }
            onClick={run}
          >
            {plan.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {plan.isPending ? "Sto scegliendo…" : "Trova gli slot"}
          </button>
        )
      }
    >
      {placements ? (
        <PlacementList
          placements={placements}
          unplaced={unplaced}
          note={note}
          tasksById={tasksById}
          projectsById={projectsById}
          settings={context.settings}
          onRemove={(taskId) =>
            setPlacements((current) =>
              (current ?? []).filter((one) => one.taskId !== taskId),
            )
          }
          onMove={(taskId, changes) =>
            setPlacements((current) =>
              (current ?? []).map((one) =>
                one.taskId === taskId ? { ...one, ...changes } : one,
              ),
            )
          }
        />
      ) : (
        <div className="space-y-4 pb-1">
          <div>
            <p className="label mb-1.5">Chi sceglie i task</p>
            <div className="seg" role="group" aria-label="Chi sceglie i task">
              <button
                type="button"
                data-on={mode === "ai"}
                aria-pressed={mode === "ai"}
                onClick={() => setMode("ai")}
              >
                <Sparkles className="size-4" />
                Sceglie l&apos;AI
              </button>
              <button
                type="button"
                data-on={mode === "io"}
                aria-pressed={mode === "io"}
                onClick={() => setMode("io")}
              >
                <Hand className="size-4" />
                Scelgo io
              </button>
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              {mode === "ai"
                ? "L'AI sceglie cosa vale la pena fare; gli orari li calcola comunque l'app."
                : "Spunti tu i task: l'app trova gli slot liberi e li dispone."}
            </p>
          </div>

          <div>
            <p className="label mb-1.5">Quanti giorni</p>
            <div className="seg" role="group" aria-label="Giorni da pianificare">
              {[1, 2, 3, 5, 7].map((count) => (
                <button
                  key={count}
                  type="button"
                  data-on={dayCount === count}
                  aria-pressed={dayCount === count}
                  onClick={() => setDayCount(count)}
                >
                  {count === 1 ? "Oggi" : `${count} giorni`}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              {fmtDuration(context.minutesAvailable(days))} liberi, al netto di
              quello che c&apos;è già.
            </p>
          </div>

          {mode === "io" && (
            <PlannerTaskPicker
              tasks={candidates}
              picked={picked}
              projectsById={projectsById}
              onToggle={(id) =>
                setPicked((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          )}

          <AiErrorNotice error={plan.error} onRetry={run} />
        </div>
      )}
    </ResponsiveSheet>
  );
}
