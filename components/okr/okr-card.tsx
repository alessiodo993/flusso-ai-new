"use client";

import {
  ChevronRight,
  ListChecks,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ProgressRing } from "@/components/ui/progress-ring";
import { safeColor } from "@/lib/colors";
import { goto } from "@/lib/events";
import { okrProgress } from "@/lib/quarter";
import {
  keyResultProgress,
  keyResultStep,
  type KeyResult,
  type Okr,
  type Project,
  type Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Un obiettivo con i suoi risultati chiave.
 *
 * I `−` e `+` scrivono subito, senza aprire niente: aggiornare un numero deve
 * costare meno che ricordarsi di farlo, altrimenti gli OKR restano fermi al
 * valore del primo giorno e smettono di dire la verità.
 */
export function OkrCard({
  okr,
  project,
  tasks,
  onStep,
  onEdit,
  onAnalyze,
  onDelete,
}: {
  okr: Okr;
  project: Project | undefined;
  tasks: Task[];
  onStep: (keyResultId: string, current: number) => void;
  onEdit: (okr: Okr) => void;
  onAnalyze: (okr: Okr) => void;
  onDelete: (okr: Okr) => void;
}) {
  const [open, setOpen] = useState(true);
  const color = project ? safeColor(project.color) : undefined;

  // Il ponte con l'esecuzione: quanti task di questo progetto sono aperti e
  // quanti chiusi. Senza, un obiettivo resta una dichiarazione d'intenti.
  const bridge = useMemo(() => {
    if (!okr.project_id) return null;
    const ofProject = tasks.filter((task) => task.project_id === okr.project_id);
    return {
      active: ofProject.filter(
        (task) => task.status !== "done" && task.status_review !== "archived",
      ).length,
      done: ofProject.filter((task) => task.status === "done").length,
    };
  }, [okr.project_id, tasks]);

  return (
    <article
      className="panel overflow-hidden border-l-[3px]"
      style={color ? { borderLeftColor: color } : undefined}
    >
      <div className="flex items-start gap-3 p-4">
        <ProgressRing
          value={okrProgress(okr)}
          color={color}
          label={`Obiettivo al ${Math.round(okrProgress(okr) * 100)}%`}
        />

        <div className="min-w-0 flex-1">
          <h3 className="text-balance font-display text-lg leading-snug">
            {okr.objective}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {project && (
              <span className="chip">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: color }}
                />
                {project.name}
              </span>
            )}

            {bridge && (bridge.active > 0 || bridge.done > 0) && (
              <button
                type="button"
                className="chip chip-accent cursor-pointer"
                onClick={() =>
                  goto("lista", { projectId: okr.project_id })
                }
                title="Apri la Lista filtrata su questo progetto"
              >
                <ListChecks className="size-3" aria-hidden="true" />
                <span className="tnum">{bridge.active}</span> attivi ·{" "}
                <span className="tnum">{bridge.done}</span> completati
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {okr.key_results.length > 0 && (
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              aria-label={`Analizza i risultati chiave di «${okr.objective}»`}
              title="Sono misurabili?"
              onClick={() => onAnalyze(okr)}
            >
              <Sparkles className="size-4" />
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={`Modifica «${okr.objective}»`}
            onClick={() => onEdit(okr)}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={`Elimina «${okr.objective}»`}
            onClick={() => onDelete(okr)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {okr.key_results.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2 text-left"
          >
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-ink-faint transition-transform duration-150 ease-out",
                open && "rotate-90",
              )}
            />
            <span className="text-sm text-ink-soft">Risultati chiave</span>
            <span className="tnum ml-auto text-xs text-ink-faint">
              {okr.key_results.length}
            </span>
          </button>

          {open && (
            <ul>
              {okr.key_results.map((kr) => (
                <KeyResultRow
                  key={kr.id}
                  keyResult={kr}
                  color={color}
                  onStep={(current) => onStep(kr.id, current)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

function KeyResultRow({
  keyResult,
  color,
  onStep,
}: {
  keyResult: KeyResult;
  color: string | undefined;
  onStep: (current: number) => void;
}) {
  const step = keyResultStep(keyResult);
  const progress = keyResultProgress(keyResult);

  return (
    <li className="flex items-center gap-2 border-t border-line px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{keyResult.text}</p>

        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${progress * 100}%`,
                background: color ?? "var(--accent)",
              }}
            />
          </div>
          <span className="tnum shrink-0 text-xs text-ink-soft">
            {keyResult.current}/{keyResult.target}
            {keyResult.unit && ` ${keyResult.unit}`}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          aria-label={`Togli ${step} a «${keyResult.text}»`}
          disabled={keyResult.current <= 0}
          onClick={() => onStep(Math.max(0, keyResult.current - step))}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          aria-label={`Aggiungi ${step} a «${keyResult.text}»`}
          onClick={() => onStep(keyResult.current + step)}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </li>
  );
}
