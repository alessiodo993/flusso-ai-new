"use client";

import { Check, Pause, Play, Plus, Star, Target, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FocusEndDialog } from "@/components/focus/focus-end-dialog";
import { FocusRing } from "@/components/focus/focus-ring";
import { KeyResultUpdatePrompt } from "@/components/focus/kr-update-prompt";
import { safeColor } from "@/lib/colors";
import { NOTHING_TO_FOCUS, resolveFocusTarget } from "@/lib/focus-target";
import { useFlussoEvent } from "@/lib/events";
import {
  useCloseFocusSession,
  useStartFocusSession,
} from "@/lib/hooks/use-focus-sessions";
import { useFocusTimer } from "@/lib/hooks/use-focus-timer";
import { useOkrs, useUpdateKeyResult } from "@/lib/hooks/use-okrs";
import { useProjects } from "@/lib/hooks/use-projects";
import { useSettings } from "@/lib/hooks/use-settings";
import { useTasks, useUnscheduleTask, useUpdateTask } from "@/lib/hooks/use-tasks";
import { fmtDuration } from "@/lib/time";
import type { KeyResult, Subtask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * «Adesso»: una schermata sola, sopra tutto il resto, con una cosa da fare.
 *
 * Tutto ciò che non serve a lavorare in questo momento è fuori — nessuna
 * lista, nessun calendario, nessuna notifica. È l'unico posto dell'app che
 * toglie invece di aggiungere.
 */
export function FocusOverlay() {
  const { tasks, byId } = useTasks();
  const { byId: projectsById } = useProjects();
  const { settings } = useSettings();
  const { leastAdvancedFor } = useOkrs();

  const startSession = useStartFocusSession();
  const closeSession = useCloseFocusSession();
  const updateTask = useUpdateTask();
  const unschedule = useUnscheduleTask();
  const updateKeyResult = useUpdateKeyResult();

  const [taskId, setTaskId] = useState<string | null>(null);
  const [micro, setMicro] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [krPrompt, setKrPrompt] = useState<{
    okrId: string;
    kr: KeyResult;
  } | null>(null);

  const task = taskId ? (byId.get(taskId) ?? null) : null;
  const plannedMinutes = micro
    ? settings.micro_start_minutes
    : (task?.est_minutes ?? 30);

  const timer = useFocusTimer(plannedMinutes);
  const { reset, start } = timer;

  // `open` non deriva dal task: chiudendo, il task resta finché l'animazione
  // finisce, e senza questo flag la schermata sparirebbe a scatti.
  const [open, setOpen] = useState(false);

  const openFor = useCallback(
    (next: Task, asMicro: boolean, autoStart: boolean) => {
      setTaskId(next.id);
      setMicro(asMicro);
      setSessionId(null);
      reset(asMicro ? settings.micro_start_minutes : (next.est_minutes ?? 30));
      setOpen(true);
      if (autoStart) start();
    },
    [reset, settings.micro_start_minutes, start],
  );

  useFlussoEvent(
    "flusso:focus-now",
    useCallback(
      (detail) => {
        const chosen = detail.taskId
          ? byId.get(detail.taskId)
          : resolveFocusTarget(tasks)?.task;

        if (!chosen) {
          toast(NOTHING_TO_FOCUS);
          return;
        }
        openFor(chosen, detail.micro ?? false, detail.autoStart ?? false);
      },
      [byId, openFor, tasks],
    ),
  );

  // Con la schermata aperta, `Esc` chiude e la barra spaziatrice mette in
  // pausa: le due scorciatoie che servono senza guardare la tastiera.
  const closeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.code === "Space" && timer.state !== "idle") {
        event.preventDefault();
        if (timer.state === "running") timer.pause();
        else if (timer.state === "paused") timer.resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, timer]);

  async function begin() {
    timer.start();
    if (!task) return;
    const session = await startSession.mutateAsync({
      taskId: task.id,
      plannedMinutes,
      micro,
    });
    setSessionId(session.id);
  }

  const finish = useCallback(
    async (outcome: "completed" | "partial" | "abandoned") => {
      const minutes = Math.max(1, timer.elapsedMinutes);

      if (sessionId) {
        closeSession.mutate({
          sessionId,
          actualMinutes: minutes,
          pausedSeconds: timer.pausedSeconds,
          outcome,
          plannedMinutes: timer.plannedMinutes,
        });
      }

      if (task && outcome === "completed") {
        updateTask.mutate({
          id: task.id,
          status: "done",
          actual_duration_minutes: minutes,
        });

        // Il ponte con la strategia: solo a blocco completato, e solo se un
        // obiettivo di quel progetto esiste davvero.
        const link = leastAdvancedFor(task.project_id);
        if (link) setKrPrompt({ okrId: link.okr.id, kr: link.kr });
      }

      setOpen(false);
      setSessionId(null);
    },
    [closeSession, leastAdvancedFor, sessionId, task, timer, updateTask],
  );

  const later = useCallback(() => {
    if (task) {
      // Quello che resta torna in Lista, senza giorno né orario.
      unschedule.mutate({ id: task.id });
      if (sessionId) {
        closeSession.mutate({
          sessionId,
          actualMinutes: Math.max(1, timer.elapsedMinutes),
          pausedSeconds: timer.pausedSeconds,
          outcome: "partial",
          plannedMinutes: timer.plannedMinutes,
        });
      }
      toast(`«${task.title}» è tornato in Lista.`);
    }
    setOpen(false);
    setSessionId(null);
  }, [closeSession, sessionId, task, timer, unschedule]);

  closeRef.current = () => void finish("abandoned");

  function extend(minutes: number) {
    timer.extend(minutes);
    if (!task?.day || task.start_minute === null || task.est_minutes === null) {
      return;
    }

    // Se lo slot dopo è occupato si allunga **solo il timer**: allungare il
    // blocco ci passerebbe sopra, e il calendario mentirebbe.
    const end = task.start_minute + task.est_minutes;
    const busy = tasks.some(
      (other) =>
        other.id !== task.id &&
        other.day === task.day &&
        other.start_minute !== null &&
        other.start_minute < end + minutes &&
        other.start_minute >= end,
    );

    if (busy) {
      toast("Lo slot successivo è occupato: allungo solo il timer.");
    } else {
      updateTask.mutate({
        id: task.id,
        est_minutes: task.est_minutes + minutes,
      });
    }
  }

  function toggleSubtask(subtask: Subtask) {
    if (!task) return;
    updateTask.mutate({
      id: task.id,
      subtasks: task.subtasks.map((s) =>
        s.id === subtask.id ? { ...s, done: !s.done } : s,
      ),
    });
  }

  if (!open || !task) {
    return (
      <KeyResultUpdatePrompt
        open={krPrompt !== null}
        keyResult={krPrompt?.kr ?? null}
        onConfirm={(current) => {
          if (krPrompt) {
            updateKeyResult.mutate({
              okrId: krPrompt.okrId,
              keyResultId: krPrompt.kr.id,
              current,
            });
          }
          setKrPrompt(null);
        }}
        onDismiss={() => setKrPrompt(null)}
      />
    );
  }

  const project = task.project_id ? projectsById.get(task.project_id) : undefined;
  const link = leastAdvancedFor(task.project_id);
  const openSubtasks = task.subtasks.filter((s) => !s.done);
  // Nel micro-avvio si vede **un solo** passo: guardarne cinque è già una
  // ragione per rimandare.
  const shownSubtasks = micro ? openSubtasks.slice(0, 1) : task.subtasks;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Focus su ${task.title}`}
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-bg"
    >
      <header className="flex items-center justify-between px-4 py-3">
        <span className="chip">
          {micro ? `Micro-avvio · ${fmtDuration(plannedMinutes)}` : "Focus"}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Chiudi il focus"
          onClick={() => void finish("abandoned")}
        >
          <X className="size-5" />
        </button>
      </header>

      {/* `justify-center` su schermo alto, ma con `my-auto` invece di
          `justify-center` puro: se il contenuto è lungo deve poter scorrere,
          non venire tagliato sopra e sotto. */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-6 text-center app:my-auto app:justify-center">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ background: safeColor(project?.color) }}
          />
          {project?.name ?? "Senza progetto"}
        </div>

        {link && (
          <p className="mt-2 flex items-start gap-1.5 text-pretty text-xs leading-relaxed text-accent">
            <Target className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Questo blocco avanza: <strong>{link.kr.text}</strong>
            </span>
          </p>
        )}

        <h1 className="mt-3 text-balance font-display text-2xl leading-tight">
          {task.is_daily_highlight && (
            <Star
              className="mr-1.5 inline size-5 -translate-y-0.5 fill-current text-accent"
              aria-label="Highlight del giorno"
            />
          )}
          {task.title}
        </h1>

        <div className="my-7">
          <FocusRing
            progress={timer.progress}
            remainingSeconds={timer.remainingSeconds}
            paused={timer.state === "paused"}
            label={
              timer.state === "paused"
                ? "in pausa"
                : timer.state === "idle"
                  ? `${fmtDuration(plannedMinutes)} previsti`
                  : undefined
            }
          />
        </div>

        {timer.state === "idle" ? (
          <button type="button" className="btn btn-primary px-6" onClick={begin}>
            <Play className="size-4 fill-current" />
            Inizia sessione
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-soft px-6"
            onClick={timer.state === "running" ? timer.pause : timer.resume}
          >
            {timer.state === "running" ? (
              <>
                <Pause className="size-4" />
                Pausa
              </>
            ) : (
              <>
                <Play className="size-4 fill-current" />
                Riprendi
              </>
            )}
          </button>
        )}

        <div className="mt-8 w-full text-left">
          {shownSubtasks.length > 0 ? (
            <ul className="space-y-1">
              {shownSubtasks.map((subtask) => (
                <li key={subtask.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-flusso-sm px-2 text-[15px]">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      onChange={() => toggleSubtask(subtask)}
                      className="size-[18px] shrink-0 accent-[var(--accent)]"
                    />
                    <span className={cn(subtask.done && "text-ink-faint line-through")}>
                      {subtask.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            task.notes && (
              <p className="whitespace-pre-wrap rounded-flusso-sm bg-sunken p-3 text-sm leading-relaxed text-ink-soft">
                {task.notes}
              </p>
            )
          )}
        </div>
      </div>

      <div className="hairline sticky bottom-0 bg-bg px-4 pb-safe pt-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => void finish("completed")}
          >
            <Check className="size-4" />
            Fatto
          </button>
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => void finish("abandoned")}
          >
            Chiudi
          </button>
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => extend(15)}
          >
            <Plus className="size-4" />
            15 min
          </button>
        </div>
      </div>

      <FocusEndDialog
        open={timer.state === "expired"}
        micro={micro}
        microMinutes={settings.micro_start_minutes}
        onDone={() => void finish("completed")}
        onExtend={extend}
        onLater={later}
      />
    </div>
  );
}
