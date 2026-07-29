"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { SelectField } from "@/components/ui/select-field";
import { useProjects } from "@/lib/hooks/use-projects";
import type { KeyResult, Okr } from "@/lib/types";
import { uid } from "@/lib/utils";

function emptyKeyResult(): KeyResult {
  return { id: uid(), text: "", current: 0, target: 10, unit: "" };
}

/**
 * Creazione e modifica di un obiettivo.
 *
 * Ogni risultato chiave chiede un **numero da raggiungere**, non una
 * descrizione: è la differenza fra «migliorare la documentazione» e «dieci
 * pagine riscritte», ed è la sola cosa che rende un OKR verificabile invece
 * che una buona intenzione.
 */
export function OkrEditor({
  okr,
  open,
  onOpenChange,
  onSave,
}: {
  /** `null` per crearne uno nuovo. */
  okr: Okr | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: {
    objective: string;
    projectId: string | null;
    keyResults: KeyResult[];
  }) => void;
}) {
  const { active: projects } = useProjects();

  const [objective, setObjective] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([emptyKeyResult()]);

  useEffect(() => {
    if (!open) return;
    setObjective(okr?.objective ?? "");
    setProjectId(okr?.project_id ?? null);
    setKeyResults(
      okr && okr.key_results.length > 0
        ? okr.key_results
        : [emptyKeyResult()],
    );
  }, [okr, open]);

  function patch(id: string, changes: Partial<KeyResult>) {
    setKeyResults((current) =>
      current.map((kr) => (kr.id === id ? { ...kr, ...changes } : kr)),
    );
  }

  const usable = keyResults.filter((kr) => kr.text.trim().length > 0);
  const canSave = objective.trim().length > 0;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={okr ? "Modifica obiettivo" : "Nuovo obiettivo"}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onOpenChange(false)}
          >
            Annulla
          </button>
          <button
            type="button"
            className="btn btn-primary ml-auto"
            disabled={!canSave}
            onClick={() => {
              onSave({
                objective: objective.trim(),
                projectId,
                keyResults: usable.map((kr) => ({
                  ...kr,
                  text: kr.text.trim(),
                  target: kr.target || 1,
                })),
              });
              onOpenChange(false);
            }}
          >
            Salva
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div>
          <p className="label mb-1.5">Obiettivo</p>
          <textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            rows={2}
            autoFocus
            placeholder="Cosa vuoi che sia diverso alla fine del trimestre?"
            className="field resize-none"
            aria-label="Obiettivo"
          />
        </div>

        <div>
          <p className="label mb-1.5">Progetto</p>
          <SelectField
            ariaLabel="Progetto collegato"
            placeholder="Nessun progetto"
            value={projectId ?? ""}
            onChange={(value) => setProjectId(value || null)}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            Collegarlo a un progetto è ciò che fa comparire il conteggio dei
            task e la riga «Questo blocco avanza…» durante il focus.
          </p>
        </div>

        <div>
          <p className="label mb-1.5">Risultati chiave</p>

          <ul className="space-y-2">
            {keyResults.map((kr) => (
              <li key={kr.id} className="panel-soft p-2.5">
                <div className="flex items-start gap-1.5">
                  <input
                    value={kr.text}
                    onChange={(event) =>
                      patch(kr.id, { text: event.target.value })
                    }
                    placeholder="Che cosa si conta?"
                    className="field field-bare min-h-9 flex-1 text-sm"
                    aria-label="Testo del risultato chiave"
                  />
                  {keyResults.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm shrink-0"
                      aria-label="Togli questo risultato"
                      onClick={() =>
                        setKeyResults((current) =>
                          current.filter((one) => one.id !== kr.id),
                        )
                      }
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <LabelledNumber
                    label="Da"
                    value={kr.current}
                    onChange={(current) => patch(kr.id, { current })}
                  />
                  <LabelledNumber
                    label="A"
                    value={kr.target}
                    min={1}
                    onChange={(target) => patch(kr.id, { target })}
                  />
                  <div>
                    <span className="label mb-1 block">Unità</span>
                    <input
                      value={kr.unit}
                      onChange={(event) =>
                        patch(kr.id, { unit: event.target.value })
                      }
                      placeholder="pagine…"
                      className="field h-9 min-h-9 py-0 text-sm"
                      aria-label="Unità di misura"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-soft mt-2 w-full"
            onClick={() =>
              setKeyResults((current) => [...current, emptyKeyResult()])
            }
          >
            <Plus className="size-4" />
            Aggiungi un risultato
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

function LabelledNumber({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <span className="label mb-1 block">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || min)}
        className="field tnum h-9 min-h-9 py-0 text-sm"
        aria-label={label}
      />
    </div>
  );
}
