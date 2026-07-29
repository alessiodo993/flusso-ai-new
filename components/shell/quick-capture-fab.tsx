"use client";

import { Plus } from "lucide-react";

import { emit } from "@/lib/events";

/**
 * Il pulsante di cattura sul telefono. Sta sopra la BottomNav e a destra,
 * dove il pollice arriva senza spostare la mano: catturare un pensiero deve
 * costare meno di tre secondi, e il primo di quei secondi è raggiungere il
 * pulsante.
 */
export function QuickCaptureFab() {
  return (
    <button
      type="button"
      onClick={() => emit("flusso:quick-capture", {})}
      aria-label="Cattura rapida"
      className="fixed bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-30 flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[var(--shadow-pop)] transition-transform duration-150 ease-out active:scale-95 app:hidden"
    >
      <Plus className="size-5" />
    </button>
  );
}
