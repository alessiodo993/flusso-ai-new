"use client";

import { Scissors, Timer, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { SelectField } from "@/components/ui/select-field";
import { useFlussoEvent } from "@/lib/events";
import {
  useDeleteTasks,
  usePostponeTask,
  useRestoreTasks,
  useTasks,
  useUpdateTask,
} from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { fmtDuration } from "@/lib/time";
import { uid } from "@/lib/utils";

/** Dal terzo rinvio in poi il rinvio non è più gratis. */
const FRICTION_FROM = 2;

const SHORTER = [15, 25, 30, 45];

type Pending = { taskId: string; day: string | null; startMinute?: number | null };

/**
 * L'attrito sui rinvii ripetuti.
 *
 * Rendere l'avvio facile e il rinvio costoso è uno dei principi dell'app, e
 * questo dialogo è il posto in cui quel principio diventa qualcosa che si
 * tocca. Non si chiude cliccando fuori: al terzo rinvio una decisione va
 * presa, e «rimandalo comunque» resta possibile ma è l'ultima e la meno
 * vistosa.
 */
export function PostponeDialog() {
  const { byId } = useTasks();
  const postpone = usePostponeTask();
  const update = useUpdateTask();
  const remove = useDeleteTasks();
  const restore = useRestoreTasks();

  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<"choose" | "split" | "shrink">("choose");
  const [steps, setSteps] = useState(["", ""]);
  const [shorter, setShorter] = useState(25);

  const task = pending ? byId.get(pending.taskId) : undefined;

  useFlussoEvent(
    "flusso:postpone",
    useCallback(
      (detail) => {
        const target = byId.get(detail.taskId);
        // I primi due rinvii passano senza dire niente: l'attrito serve solo
        // quando diventa un'abitudine.
        if (!target || target.postpone_count < FRICTION_FROM) {
          postpone.mutate({
            id: detail.taskId,
            day: detail.day,
            startMinute: detail.startMinute,
          });
          return;
        }
        setMode("choose");
        setSteps(["", ""]);
        setShorter(Math.min(25, target.est_minutes ?? 25));
        setPending(detail);
      },
      [byId, postpone],
    ),
  );

  function done() {
    setPending(null);
    setMode("choose");
  }

  function postponeAnyway() {
    if (pending) {
      postpone.mutate({
        id: pending.taskId,
        day: pending.day,
        startMinute: pending.startMinute,
      });
    }
    done();
  }

  function applySplit() {
    if (!task) return;
    const added = steps
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ id: uid(), text, done: false, deadline: null }));

    if (added.length > 0) {
      update.mutate({ id: task.id, subtasks: [...task.subtasks, ...added] });
    }
    postponeAnyway();
  }

  function applyShrink() {
    if (!task) return;
    update.mutate({ id: task.id, est_minutes: shorter });
    postponeAnyway();
  }

  function deleteTask() {
    if (!task) return;
    remove.mutate({ ids: [task.id] });
    undoableToast({
      message: `«${task.title}» eliminato.`,
      onUndo: () => restore.mutate({ tasks: [task] }),
    });
    done();
  }

  if (!task) return null;

  return (
    <ResponsiveSheet
      open={pending !== null}
      // Nessuna chiusura implicita: al terzo rinvio si sceglie.
      onOpenChange={() => {}}
      title={`L'hai già rinviato ${task.postpone_count} volte.`}
      description={task.title}
      footer={
        mode === "choose" ? (
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={postponeAnyway}
          >
            Rimandalo comunque
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode("choose")}
            >
              Indietro
            </button>
            <button
              type="button"
              className="btn btn-primary ml-auto"
              onClick={mode === "split" ? applySplit : applyShrink}
            >
              Salva e sposta
            </button>
          </div>
        )
      }
    >
      {mode === "choose" && (
        <div className="space-y-2 pb-2">
          <p className="pb-1 text-sm leading-relaxed text-ink-soft">
            Un task che continua a slittare di solito non ha bisogno di un altro
            giorno. Ha bisogno di essere più piccolo, più corto, o di sparire.
          </p>

          <Choice
            Icon={Scissors}
            title="Spezzalo in sottotask"
            detail="Due passi concreti bastano a farlo ripartire."
            onSelect={() => setMode("split")}
          />
          <Choice
            Icon={Timer}
            title="Riduci la stima"
            detail={`Adesso ne chiede ${fmtDuration(task.est_minutes ?? 30)}.`}
            onSelect={() => setMode("shrink")}
          />
          <Choice
            Icon={Trash2}
            title="Eliminalo"
            detail="Se non l'hai fatto in tre tentativi, forse non serve."
            danger
            onSelect={deleteTask}
          />
        </div>
      )}

      {mode === "split" && (
        <div className="space-y-2 pb-2">
          <p className="text-sm text-ink-soft">
            Qual è il primo passo concreto? E il secondo?
          </p>
          {steps.map((step, index) => (
            <input
              key={index}
              className="field"
              placeholder={index === 0 ? "Primo passo…" : "Secondo passo…"}
              value={step}
              autoFocus={index === 0}
              onChange={(event) =>
                setSteps((current) =>
                  current.map((s, i) => (i === index ? event.target.value : s)),
                )
              }
            />
          ))}
        </div>
      )}

      {mode === "shrink" && (
        <div className="space-y-2 pb-2">
          <p className="text-sm text-ink-soft">
            Quanto ci vuole per farne almeno un pezzo?
          </p>
          <SelectField
            ariaLabel="Nuova stima"
            value={String(shorter)}
            onChange={(value) => setShorter(Number(value))}
            options={SHORTER.map((minutes) => ({
              value: String(minutes),
              label: fmtDuration(minutes),
            }))}
          />
        </div>
      )}
    </ResponsiveSheet>
  );
}

function Choice({
  Icon,
  title,
  detail,
  danger,
  onSelect,
}: {
  Icon: typeof Scissors;
  title: string;
  detail: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-flusso-sm border border-line px-3 py-3 text-left transition-colors duration-150 ease-out hover:border-line-strong"
    >
      <Icon
        className={danger ? "mt-0.5 size-4 text-danger" : "mt-0.5 size-4 text-accent"}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{detail}</span>
      </span>
    </button>
  );
}
