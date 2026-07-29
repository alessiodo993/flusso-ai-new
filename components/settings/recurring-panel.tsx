"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SelectField } from "@/components/ui/select-field";
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurring,
  useUpdateRecurring,
} from "@/lib/hooks/use-recurring";
import { useProjects } from "@/lib/hooks/use-projects";
import { undoableToast } from "@/lib/hooks/use-undo";
import { fmtDuration, fmtMin, SLOT } from "@/lib/time";
import type { Recurring } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lunedì primo, come il calendario italiano. */
const DAYS = [
  { dow: 1, label: "L" },
  { dow: 2, label: "M" },
  { dow: 3, label: "M" },
  { dow: 4, label: "G" },
  { dow: 5, label: "V" },
  { dow: 6, label: "S" },
  { dow: 0, label: "D" },
] as const;

/**
 * Le cose che tornano: palestra il martedì, revisione ogni giorno.
 *
 * Restano modelli, non task già scritti sul calendario. Generare in anticipo
 * trenta occorrenze significherebbe riempire di blocchi il futuro e rendere
 * ogni cambio di orario una migrazione.
 */
export function RecurringPanel() {
  const { recurring } = useRecurring();
  const { active: projects } = useProjects();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const remove = useDeleteRecurring();

  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<"daily" | "weekly">("weekly");
  const [dow, setDow] = useState<number[]>([1]);

  function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (freq === "weekly" && dow.length === 0) return;

    create.mutate({ title: trimmed, freq, dow });
    setTitle("");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-flusso-md border border-line p-3">
        <input
          className="field w-full"
          placeholder="Es. Palestra"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Titolo della ricorrenza"
        />

        <div className="mt-2 flex items-center gap-2">
          <div className="seg" role="group" aria-label="Frequenza">
            <button
              type="button"
              data-on={freq === "daily"}
              aria-pressed={freq === "daily"}
              onClick={() => setFreq("daily")}
            >
              Ogni giorno
            </button>
            <button
              type="button"
              data-on={freq === "weekly"}
              aria-pressed={freq === "weekly"}
              onClick={() => setFreq("weekly")}
            >
              Certi giorni
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary ml-auto shrink-0 px-3"
            onClick={add}
            disabled={!title.trim() || (freq === "weekly" && dow.length === 0)}
            aria-label="Aggiungi ricorrenza"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {freq === "weekly" && (
          <div className="mt-2">
            <DayPicker value={dow} onChange={setDow} label="Giorni della settimana" />
            {dow.length === 0 && (
              <p className="mt-1 text-xs text-warn">
                Senza giorni non succederebbe mai niente.
              </p>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-1.5">
        {recurring.map((one) => (
          <RecurringRow
            key={one.id}
            recurring={one}
            projectName={
              one.project_id
                ? projects.find((p) => p.id === one.project_id)?.name
                : undefined
            }
            projects={projects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(changes) => update.mutate({ id: one.id, ...changes })}
            onDelete={() => {
              remove.mutate({ id: one.id });
              undoableToast({
                message: `«${one.title}» non si ripeterà più.`,
                onUndo: () =>
                  create.mutate({
                    title: one.title,
                    projectId: one.project_id,
                    estMinutes: one.est_minutes,
                    freq: one.freq,
                    dow: one.dow,
                    startMinute: one.start_minute,
                  }),
              });
            }}
          />
        ))}
      </ul>

      {recurring.length === 0 && (
        <p className="py-4 text-center text-sm text-ink-soft">
          Nessuna ricorrenza. Servono per le cose che torneranno comunque:
          scriverle una volta sola è il punto.
        </p>
      )}
    </div>
  );
}

function RecurringRow({
  recurring,
  projectName,
  projects,
  onChange,
  onDelete,
}: {
  recurring: Recurring;
  projectName: string | undefined;
  projects: Array<{ value: string; label: string }>;
  onChange: (changes: Partial<Recurring>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-flusso-md border border-line p-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="block truncate text-sm">{recurring.title}</span>
          <span className="block truncate text-xs text-ink-faint">
            {describe(recurring)}
            {projectName ? ` · ${projectName}` : ""}
          </span>
        </button>

        <button
          type="button"
          className="icon-btn size-8 shrink-0"
          aria-label={`Elimina la ricorrenza ${recurring.title}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {recurring.freq === "weekly" && (
            <DayPicker
              value={recurring.dow}
              label={`Giorni di ${recurring.title}`}
              onChange={(next) => next.length > 0 && onChange({ dow: next })}
            />
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <SelectField
              ariaLabel={`Progetto di ${recurring.title}`}
              placeholder="Nessun progetto"
              value={recurring.project_id ?? ""}
              onChange={(value) => onChange({ project_id: value || null })}
              options={projects}
            />
            <SelectField
              ariaLabel={`Durata di ${recurring.title}`}
              placeholder="Senza stima"
              value={recurring.est_minutes ? String(recurring.est_minutes) : ""}
              onChange={(value) =>
                onChange({ est_minutes: value ? Number(value) : null })
              }
              options={[15, 30, 45, 60, 90, 120].map((m) => ({
                value: String(m),
                label: fmtDuration(m),
              }))}
            />
            <SelectField
              ariaLabel={`Orario di ${recurring.title}`}
              placeholder="Orario libero"
              value={
                recurring.start_minute !== null
                  ? String(recurring.start_minute)
                  : ""
              }
              onChange={(value) =>
                onChange({ start_minute: value ? Number(value) : null })
              }
              options={startOptions()}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function DayPicker({
  value,
  label,
  onChange,
}: {
  value: number[];
  label: string;
  onChange: (dow: number[]) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {DAYS.map((day, index) => {
        const on = value.includes(day.dow);
        return (
          <button
            key={day.dow}
            type="button"
            aria-pressed={on}
            aria-label={DAY_NAMES[index]}
            onClick={() =>
              onChange(
                on
                  ? value.filter((d) => d !== day.dow)
                  : [...value, day.dow].sort(),
              )
            }
            className={cn(
              "size-9 rounded-flusso-sm border text-sm transition-colors duration-150",
              on
                ? "border-accent bg-accent text-accent-ink"
                : "border-line text-ink-soft",
            )}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}

const DAY_NAMES = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

function describe(recurring: Recurring): string {
  if (recurring.freq === "daily") return "Ogni giorno";
  if (recurring.dow.length === 0) return "Nessun giorno";
  if (recurring.dow.length === 7) return "Ogni giorno";

  const names = DAYS.filter((day) => recurring.dow.includes(day.dow)).map(
    (day) => DAY_NAMES[DAYS.indexOf(day)].slice(0, 3),
  );
  return names.join(", ");
}

function startOptions() {
  const options: Array<{ value: string; label: string }> = [];
  for (let m = 5 * 60; m <= 23 * 60; m += SLOT) {
    options.push({ value: String(m), label: fmtMin(m) });
  }
  return options;
}
