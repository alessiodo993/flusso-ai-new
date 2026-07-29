"use client";

import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { ListFilter } from "@/lib/events";

/** Triage. Contenuto vero al passo 5. */
export function ListSection({
  filter,
  onClearFilter,
}: {
  filter: ListFilter | null;
  onClearFilter: () => void;
}) {
  return (
    <section className="panel" aria-label="Lista">
      {filter?.deadlineSoon && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm">
          <span className="text-ink-soft">Solo i task in scadenza</span>
          <button type="button" className="btn btn-ghost h-8" onClick={onClearFilter}>
            Togli il filtro
          </button>
        </div>
      )}

      <EmptyState
        Icon={ListChecks}
        title="La lista è vuota"
        description="Qui arriva quello che hai catturato, pronto per essere pianificato."
      />
    </section>
  );
}
