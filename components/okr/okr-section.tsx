"use client";

import { Target } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/** OKR del trimestre. Contenuto vero al passo 11. */
export function OkrSection() {
  return (
    <section className="panel" aria-label="Obiettivi">
      <EmptyState
        Icon={Target}
        title="Nessun obiettivo per questo trimestre"
        description="Un obiettivo e pochi risultati misurabili bastano a dare una direzione ai blocchi."
      />
    </section>
  );
}
