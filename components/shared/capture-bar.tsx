"use client";

import { CalendarClock, Plus, Wand2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { SelectField } from "@/components/ui/select-field";
import { emit, useFlussoEvent } from "@/lib/events";
import { useProjects } from "@/lib/hooks/use-projects";
import { ENERGIES, ENERGY_LABEL, type Energy } from "@/lib/types";
import { fmtDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Stime proposte: coprono il grosso dei casi senza diventare un elenco. */
const ESTIMATES = [15, 25, 30, 45, 60, 90, 120, 180, 240];

export type CaptureValues = {
  title: string;
  projectId: string | null;
  deadline: string | null;
  estMinutes: number | null;
  energy: Energy | null;
};

/**
 * La barra di cattura, in due forme.
 *
 * In Idee non c'è nulla di obbligatorio oltre al testo, e `Invio` salva e
 * **rimette il cursore nel campo**: la cattura a raffica è il gesto per cui
 * quella sezione esiste. In Lista compaiono anche scadenza, stima ed energia,
 * ma solo dopo che si è cominciato a scrivere: prima sarebbero cinque campi
 * vuoti a guardia di un pensiero di tre parole.
 */
export function CaptureBar({
  variant,
  placeholder,
  onSubmit,
}: {
  variant: "idea" | "task";
  placeholder: string;
  onSubmit: (values: CaptureValues) => void;
}) {
  const { active: projects } = useProjects();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [estMinutes, setEstMinutes] = useState<number | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);

  // La palette e il FAB possono chiedere il fuoco su questa barra.
  useFlussoEvent(
    "flusso:quick-capture",
    useCallback(() => inputRef.current?.focus(), []),
  );

  const detailsVisible = variant === "task" && title.trim().length > 0;

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;

    onSubmit({ title: trimmed, projectId, deadline, estMinutes, energy });

    // Il progetto resta: chi cattura a raffica di solito resta sullo stesso.
    setTitle("");
    setDeadline(null);
    setEstMinutes(null);
    setEnergy(null);
    inputRef.current?.focus();
  }

  return (
    <div className="border-b border-line p-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          className="field flex-1"
          placeholder={placeholder}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              setTitle("");
            }
          }}
          aria-label={placeholder}
        />

        <button
          type="button"
          className="icon-btn shrink-0"
          aria-label="Interpreta con l'AI"
          title="Interpreta con l'AI"
          onClick={() => emit("flusso:magic-capture", { voice: false })}
        >
          <Wand2 className="size-[18px]" />
        </button>

        <button
          type="button"
          className="btn btn-primary shrink-0 px-3"
          onClick={submit}
          disabled={!title.trim()}
          aria-label="Aggiungi"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div
        className={cn(
          "grid gap-2 overflow-hidden transition-all duration-150 ease-out",
          variant === "task" ? "sm:grid-cols-2" : "",
          detailsVisible || variant === "idea"
            ? "mt-2 max-h-40 opacity-100"
            : "max-h-0 opacity-0",
        )}
        aria-hidden={!detailsVisible && variant === "task"}
      >
        <SelectField
          ariaLabel="Progetto"
          placeholder="Nessun progetto"
          value={projectId ?? ""}
          onChange={(value) => setProjectId(value || null)}
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
        />

        {variant === "task" && (
          <>
            <DeadlineField value={deadline} onChange={setDeadline} />

            <SelectField
              ariaLabel="Stima"
              placeholder="Senza stima"
              value={estMinutes ? String(estMinutes) : ""}
              onChange={(value) => setEstMinutes(value ? Number(value) : null)}
              options={ESTIMATES.map((minutes) => ({
                value: String(minutes),
                label: fmtDuration(minutes),
              }))}
            />

            <SelectField
              ariaLabel="Energia"
              placeholder="Energia libera"
              value={energy ?? ""}
              onChange={(value) => setEnergy((value || null) as Energy | null)}
              options={ENERGIES.map((level) => ({
                value: level,
                label: `Energia ${ENERGY_LABEL[level].toLowerCase()}`,
              }))}
            />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Il selettore di data. Il pulsante chiama `showPicker()`: su diversi browser
 * toccare l'icona nativa non apre nulla, e senza questa chiamata la scadenza
 * resterebbe scrivibile solo a tastiera.
 */
function DeadlineField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        ref={ref}
        type="date"
        aria-label="Scadenza"
        className={cn("field h-9 min-h-9 py-0 pr-8 text-sm", !value && "text-ink-faint")}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      />
      <button
        type="button"
        aria-label="Scegli la scadenza"
        className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-flusso-sm text-ink-faint"
        onClick={() => {
          ref.current?.showPicker?.();
          ref.current?.focus();
        }}
      >
        <CalendarClock className="size-4" />
      </button>
    </div>
  );
}
