"use client";

import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/** La verità del giorno. Contenuto vero al passo 6. */
export function CalendarSection() {
  return (
    <section className="panel" aria-label="Calendario">
      <EmptyState
        Icon={CalendarDays}
        title="Giornata libera"
        description="Trascina qui un task, oppure lascia che sia l'AI a trovare gli slot."
      />
    </section>
  );
}
