"use client";

import { X } from "lucide-react";

import { SelectField } from "@/components/ui/select-field";
import { useProjects } from "@/lib/hooks/use-projects";
import { ENERGIES, ENERGY_LABEL, type Energy } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * «Manuale» è stato rimosso, e non era una preferenza: era una promessa che
 * l'app non manteneva. Ordinava per `sort_order`, che sui task viene scritto
 * una volta alla creazione e non è mai stato modificabile — non c'è riordino a
 * trascinamento nella Lista, la maniglia serve a portare un task sul
 * calendario. Quindi «Manuale» significava «ordine di creazione» sotto un nome
 * che invitava a cercare un comando inesistente.
 */
export const SORTS = ["progetto", "scadenza"] as const;
export type ListSort = (typeof SORTS)[number];

const SORT_LABEL: Record<ListSort, string> = {
  progetto: "Progetto",
  scadenza: "Scadenza",
};

export type ListFilters = {
  projectId: string | null;
  energy: Energy | null;
  deadlineSoon: boolean;
};

export const NO_FILTERS: ListFilters = {
  projectId: null,
  energy: null,
  deadlineSoon: false,
};

export function hasFilters(filters: ListFilters): boolean {
  return (
    filters.projectId !== null ||
    filters.energy !== null ||
    filters.deadlineSoon
  );
}

/** Ordinamento e filtri della Lista, su una riga sola. */
export function ListToolbar({
  sort,
  onSortChange,
  filters,
  onFiltersChange,
}: {
  sort: ListSort;
  onSortChange: (sort: ListSort) => void;
  filters: ListFilters;
  onFiltersChange: (filters: ListFilters) => void;
}) {
  const { active: projects } = useProjects();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <div className="seg" role="group" aria-label="Ordina per">
        {SORTS.map((option) => (
          <button
            key={option}
            type="button"
            data-on={sort === option}
            aria-pressed={sort === option}
            onClick={() => onSortChange(option)}
          >
            {SORT_LABEL[option]}
          </button>
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={filters.deadlineSoon}
          onClick={() =>
            onFiltersChange({ ...filters, deadlineSoon: !filters.deadlineSoon })
          }
          className={cn(
            "chip min-h-9 px-3",
            filters.deadlineSoon && "chip-warn font-medium",
          )}
        >
          In scadenza
        </button>

        <SelectField
          ariaLabel="Filtra per progetto"
          placeholder="Tutti i progetti"
          className="w-40"
          value={filters.projectId ?? ""}
          onChange={(value) =>
            onFiltersChange({ ...filters, projectId: value || null })
          }
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
        />

        <SelectField
          ariaLabel="Filtra per energia"
          placeholder="Ogni energia"
          className="w-36"
          value={filters.energy ?? ""}
          onChange={(value) =>
            onFiltersChange({ ...filters, energy: (value || null) as Energy | null })
          }
          options={ENERGIES.map((level) => ({
            value: level,
            label: ENERGY_LABEL[level],
          }))}
        />

        {hasFilters(filters) && (
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label="Togli tutti i filtri"
            onClick={() => onFiltersChange(NO_FILTERS)}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
