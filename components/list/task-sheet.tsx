"use client";

import {
  CalendarClock,
  Check,
  FolderPlus,
  ListChecks,
  Play,
  Star,
  Timer,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SubtaskList } from "@/components/list/subtask-list";
import { TaskHistory } from "@/components/list/task-history";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { SelectField } from "@/components/ui/select-field";
import { emit } from "@/lib/events";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTaskQuickActions } from "@/lib/hooks/use-task-quick-actions";
import { useUpdateTask } from "@/lib/hooks/use-tasks";
import { correctedEstimate, MIN_SESSIONS_TO_SHOW } from "@/lib/calibration";
import { useCalibration } from "@/lib/hooks/use-calibration";
import { needsMicroStart } from "@/lib/postpone";
import { fmtDuration } from "@/lib/time";
import {
  ENERGIES,
  ENERGY_LABEL,
  isScheduled,
  type Energy,
  type Subtask,
  type Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 25, 30, 45, 60, 90, 120, 180, 240];

/**
 * La scheda di un task. Ogni campo salva appena cambia — non c'è un pulsante
 * «Salva», perché non c'è un momento in cui una modifica smette di valere.
 */
export function TaskSheet({
  task,
  open,
  onOpenChange,
  onSchedule,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (task: Task) => void;
}) {
  const { active: projects } = useProjects();
  const update = useUpdateTask();
  const actions = useTaskQuickActions();
  const calibration = useCalibration();
  const dateRef = useRef<HTMLInputElement>(null);

  /** La durata che di solito serve davvero, se lo storico basta a dirlo. */
  const corrected =
    task?.est_minutes &&
    calibration.coefficient !== null &&
    calibration.sessionCount >= MIN_SESSIONS_TO_SHOW
      ? correctedEstimate(task.est_minutes, calibration.coefficient)
      : null;

  // Se la correzione coincide con la stima non c'è nulla da dire.
  const showCorrected = corrected !== null && corrected !== task?.est_minutes;

  // Titolo e note si scrivono in locale e si salvano quando il campo perde il
  // fuoco: una mutazione a ogni tasto sarebbe rumore di rete e basta.
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes);
  }, [task]);

  if (!task) return null;

  const patch = (changes: Parameters<typeof update.mutate>[0]) =>
    update.mutate(changes);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={task.title}
      hideTitle
      footer={
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              actions.toggleDone(task);
              onOpenChange(false);
            }}
          >
            <Check className="size-4" />
            {task.status === "done" ? "Riapri" : "Fatto"}
          </button>

          {isScheduled(task) && (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                actions.backToList(task);
                onOpenChange(false);
              }}
            >
              <ListChecks className="size-4" />
              In Lista
            </button>
          )}

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => onSchedule(task)}
          >
            <CalendarClock className="size-4" />
            {isScheduled(task) ? "Sposta a…" : "Pianifica…"}
          </button>

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => {
              actions.startFocus(task);
              onOpenChange(false);
            }}
          >
            <Play className="size-4" />
            Avvia focus
          </button>

          {/* Su un task che slitta da due volte, «dieci minuti» è la porta
              che si apre: il pulsante grande resta l'avvio normale, ma questo
              sta accanto e non sotto un menù. */}
          {needsMicroStart(task) && (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                actions.microStart(task);
                onOpenChange(false);
              }}
            >
              <Timer className="size-4" />
              Solo 10 minuti
            </button>
          )}

          <button
            type="button"
            className="btn btn-danger ml-auto"
            aria-label="Elimina il task"
            onClick={() => {
              actions.deleteTask(task);
              onOpenChange(false);
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex items-start gap-1">
          <button
            type="button"
            className="icon-btn icon-btn-sm mt-1 shrink-0"
            aria-label={
              task.is_daily_highlight
                ? "Togli l'highlight del giorno"
                : "Rendi highlight del giorno"
            }
            onClick={() => actions.toggleHighlight(task)}
          >
            <Star
              className={cn(
                "size-[18px]",
                task.is_daily_highlight && "fill-current text-accent",
              )}
            />
          </button>

          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim();
              if (next && next !== task.title) patch({ id: task.id, title: next });
              else setTitle(task.title);
            }}
            rows={1}
            aria-label="Titolo"
            className="field field-bare min-h-0 flex-1 resize-none py-1 font-display text-xl leading-snug"
          />
        </div>

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes !== task.notes) patch({ id: task.id, notes });
          }}
          rows={3}
          placeholder="Note, contesto, link…"
          aria-label="Note"
          className="field resize-y text-sm"
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Labelled label="Progetto">
            <div className="flex items-center gap-1.5">
              <SelectField
                className="min-w-0 flex-1"
                ariaLabel="Progetto"
                placeholder="Nessun progetto"
                value={task.project_id ?? ""}
                onChange={(value) =>
                  patch({ id: task.id, project_id: value || null })
                }
                options={projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                }))}
              />

              {/*
                Il momento in cui ci si accorge che serve un progetto nuovo è
                questo: si sta archiviando un task e nessuno di quelli esistenti
                gli somiglia. Mandare l'utente nelle Impostazioni e farlo tornare
                indietro significa che il progetto non lo crea, e il task resta
                in «Senza progetto» per sempre.
              */}
              <button
                type="button"
                className="icon-btn size-10 shrink-0 border border-line"
                aria-label="Nuovo progetto per questo task"
                title="Nuovo progetto"
                onClick={() =>
                  emit("flusso:new-project", { assignToTaskId: task.id })
                }
              >
                <FolderPlus className="size-[18px]" />
              </button>
            </div>
          </Labelled>

          <Labelled label="Energia">
            <SelectField
              ariaLabel="Energia"
              placeholder="Libera"
              value={task.energy ?? ""}
              onChange={(value) =>
                patch({ id: task.id, energy: (value || null) as Energy | null })
              }
              options={ENERGIES.map((level) => ({
                value: level,
                label: ENERGY_LABEL[level],
              }))}
            />
          </Labelled>

          <Labelled label="Stima">
            <SelectField
              ariaLabel="Stima"
              placeholder="Senza stima"
              value={task.est_minutes ? String(task.est_minutes) : ""}
              onChange={(value) =>
                patch({ id: task.id, est_minutes: value ? Number(value) : null })
              }
              options={DURATIONS.map((minutes) => ({
                value: String(minutes),
                label: fmtDuration(minutes),
              }))}
            />

            {/*
              La correzione si mostra solo con abbastanza sessioni alle spalle.
              Con tre misurazioni il coefficiente esiste ma non significa
              niente, e un numero inventato è peggio di nessun numero: verrebbe
              creduto. Non tocca il valore salvato — quella è la stima
              dell'utente — dice solo cosa succede di solito.
            */}
            {showCorrected && (
              <p className="mt-1 text-xs text-ink-faint">
                Di solito ne servono ~{fmtDuration(corrected)}, secondo il tuo
                storico.
              </p>
            )}
          </Labelled>

          <Labelled label="Scadenza">
            <input
              ref={dateRef}
              type="date"
              aria-label="Scadenza"
              className="field h-9 min-h-9 py-0 text-sm"
              value={task.deadline ?? ""}
              onChange={(event) =>
                patch({ id: task.id, deadline: event.target.value || null })
              }
              onClick={() => dateRef.current?.showPicker?.()}
            />
          </Labelled>
        </div>

        <div>
          <p className="label mb-1">Sottotask</p>
          <SubtaskList
            subtasks={task.subtasks}
            onChange={(subtasks: Subtask[]) =>
              patch({ id: task.id, subtasks })
            }
          />
        </div>

        <TaskHistory task={task} />
      </div>
    </ResponsiveSheet>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      {children}
    </div>
  );
}
