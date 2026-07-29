"use client";

import { ArrowRight, CalendarPlus, Trash2, X } from "lucide-react";

import { SelectField } from "@/components/ui/select-field";
import { useProjects } from "@/lib/hooks/use-projects";
import { ENERGIES, ENERGY_LABEL, type Energy } from "@/lib/types";

/**
 * La barra che compare quando c'è una selezione. Le azioni sono le stesse in
 * Idee e in Lista, e quelle che una sezione non usa semplicemente non vengono
 * passate: nessun pulsante disattivato a occupare spazio.
 */
export function SelectionBar({
  count,
  onClear,
  onSetProject,
  onSetEnergy,
  onPromote,
  onSchedule,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onSetProject?: (projectId: string | null) => void;
  onSetEnergy?: (energy: Energy | null) => void;
  onPromote?: () => void;
  onSchedule?: () => void;
  onDelete: () => void;
}) {
  const { active: projects } = useProjects();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-3 py-2">
      <button
        type="button"
        className="icon-btn icon-btn-sm shrink-0"
        aria-label="Annulla la selezione"
        onClick={onClear}
      >
        <X className="size-4" />
      </button>

      <span className="tnum text-sm font-medium">
        {count} {count === 1 ? "selezionato" : "selezionati"}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {onSetProject && (
          <SelectField
            ariaLabel="Assegna a un progetto"
            placeholder="Progetto…"
            value=""
            className="w-36"
            onChange={(value) => onSetProject(value === "—" ? null : value)}
            options={[
              { value: "—", label: "Nessun progetto" },
              ...projects.map((project) => ({
                value: project.id,
                label: project.name,
              })),
            ]}
          />
        )}

        {onSetEnergy && (
          <SelectField
            ariaLabel="Assegna un livello di energia"
            placeholder="Energia…"
            value=""
            className="w-32"
            onChange={(value) =>
              onSetEnergy(value === "—" ? null : (value as Energy))
            }
            options={[
              { value: "—", label: "Nessuna" },
              ...ENERGIES.map((level) => ({
                value: level,
                label: ENERGY_LABEL[level],
              })),
            ]}
          />
        )}

        {onPromote && (
          <button type="button" className="btn btn-soft h-9" onClick={onPromote}>
            <ArrowRight className="size-4" />
            In Lista
          </button>
        )}

        {onSchedule && (
          <button type="button" className="btn btn-soft h-9" onClick={onSchedule}>
            <CalendarPlus className="size-4" />
            Pianifica
          </button>
        )}

        <button type="button" className="btn btn-danger h-9" onClick={onDelete}>
          <Trash2 className="size-4" />
          Elimina
        </button>
      </div>
    </div>
  );
}
