"use client";

import { Lightbulb } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/** Cattura pura. Contenuto vero al passo 5. */
export function IdeasSection() {
  return (
    <section className="panel" aria-label="Idee">
      <EmptyState
        Icon={Lightbulb}
        title="Nessuna idea in attesa"
        description="Scrivi un pensiero appena ti passa per la testa. Ci penserai dopo."
      />
    </section>
  );
}
