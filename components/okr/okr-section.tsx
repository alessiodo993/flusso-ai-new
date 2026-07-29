"use client";

import { Copy, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";

import { OkrCard } from "@/components/okr/okr-card";
import { OkrEditor } from "@/components/okr/okr-editor";
import { RhythmDashboard } from "@/components/okr/rhythm-dashboard";
import { SelectField } from "@/components/ui/select-field";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionStatus } from "@/components/ui/section-status";
import {
  daysLeftInQuarter,
  formatQuarter,
  parseQuarter,
  previousQuarter,
  rhythmOf,
  YEARS,
  QUARTERS,
  type QuarterNumber,
} from "@/lib/quarter";
import {
  currentQuarter,
  useCopyPreviousQuarter,
  useCreateOkr,
  useDeleteOkr,
  useOkrs,
  useUpdateKeyResult,
  useUpdateOkr,
} from "@/lib/hooks/use-okrs";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTasks } from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import type { Okr } from "@/lib/types";

/**
 * Gli obiettivi del trimestre.
 *
 * È l'unica sezione che guarda più in là del giorno, e per questo su desktop
 * fa sparire il calendario: mentre si decide cosa conta per tre mesi, la
 * giornata di oggi è una distrazione.
 */
export function OkrSection() {
  const [quarter, setQuarter] = useState(currentQuarter());
  const [editing, setEditing] = useState<Okr | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const { okrs, isLoading, isError, error, refetch } = useOkrs(quarter);
  const { byId: projectsById } = useProjects();
  const { tasks } = useTasks();

  const create = useCreateOkr(quarter);
  const update = useUpdateOkr(quarter);
  const remove = useDeleteOkr(quarter);
  const stepKeyResult = useUpdateKeyResult(quarter);
  const copyPrevious = useCopyPreviousQuarter(quarter);

  const parsed = parseQuarter(quarter) ?? {
    year: YEARS[0],
    quarter: 1 as QuarterNumber,
  };

  const rhythm = useMemo(() => rhythmOf(okrs, quarter), [okrs, quarter]);
  const daysLeft = daysLeftInQuarter(quarter);

  function openEditor(okr: Okr | null) {
    setEditing(okr);
    setEditorOpen(true);
  }

  return (
    <section className="space-y-3" aria-label="Obiettivi">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <SelectField
          ariaLabel="Anno"
          className="w-28"
          value={String(parsed.year)}
          onChange={(value) =>
            setQuarter(formatQuarter(Number(value), parsed.quarter))
          }
          options={YEARS.map((year) => ({
            value: String(year),
            label: String(year),
          }))}
        />

        <div className="seg" role="group" aria-label="Trimestre">
          {QUARTERS.map((q) => (
            <button
              key={q}
              type="button"
              data-on={parsed.quarter === q}
              aria-pressed={parsed.quarter === q}
              onClick={() => setQuarter(formatQuarter(parsed.year, q))}
            >
              Q{q}
            </button>
          ))}
        </div>

        {quarter !== currentQuarter() && (
          <button
            type="button"
            className="btn btn-ghost h-9"
            onClick={() => setQuarter(currentQuarter())}
          >
            Trimestre corrente
          </button>
        )}

        <button
          type="button"
          className="btn btn-primary ml-auto h-9"
          onClick={() => openEditor(null)}
        >
          <Plus className="size-4" />
          Obiettivo
        </button>
      </div>

      {okrs.length > 0 && (
        <RhythmDashboard rhythm={rhythm} daysLeft={daysLeft} />
      )}

      {okrs.length === 0 && (
        <div className="panel">
          <SectionStatus
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={() => void refetch()}
            empty={
              <EmptyState
                Icon={Target}
                title={`Nessun obiettivo per ${quarter.replace("-", " ")}`}
                description="Un obiettivo e pochi risultati misurabili bastano a dare una direzione ai blocchi della giornata."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openEditor(null)}
                    >
                      <Plus className="size-4" />
                      Crea il primo
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => copyPrevious.mutate()}
                      disabled={copyPrevious.isPending}
                    >
                      <Copy className="size-4" />
                      Copia da {previousQuarter(quarter)}
                    </button>
                  </div>
                }
              />
            }
          />
        </div>
      )}

      {okrs.map((okr) => (
        <OkrCard
          key={okr.id}
          okr={okr}
          project={
            okr.project_id ? projectsById.get(okr.project_id) : undefined
          }
          tasks={tasks}
          onStep={(keyResultId, current) =>
            stepKeyResult.mutate({ okrId: okr.id, keyResultId, current })
          }
          onEdit={openEditor}
          onDelete={(one) => {
            remove.mutate({ id: one.id });
            undoableToast({
              message: `«${one.objective}» eliminato.`,
              onUndo: () =>
                create.mutate({
                  objective: one.objective,
                  projectId: one.project_id,
                  keyResults: one.key_results,
                }),
            });
          }}
        />
      ))}

      <OkrEditor
        okr={editing}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={(draft) => {
          if (editing) {
            update.mutate({
              id: editing.id,
              objective: draft.objective,
              project_id: draft.projectId,
              key_results: draft.keyResults,
            });
          } else {
            create.mutate(draft);
          }
        }}
      />
    </section>
  );
}
