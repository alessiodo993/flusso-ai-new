"use client";

import { Bell, X } from "lucide-react";
import { useState } from "react";

import { useBlockNotifications } from "@/lib/hooks/use-block-notifications";
import type { Task } from "@/lib/types";

/**
 * L'offerta di attivare gli avvisi, e insieme il posto in cui i timer vivono.
 *
 * Compare **solo dopo** che c'è almeno un blocco pianificato, mai al primo
 * caricamento: chiedere il permesso a freddo si traduce in un rifiuto per
 * riflesso, che il browser poi non ripropone più.
 */
export function NotificationOptIn({ tasks }: { tasks: Task[] }) {
  const { request, shouldOffer } = useBlockNotifications(tasks);
  const [dismissed, setDismissed] = useState(false);

  if (!shouldOffer || dismissed) return null;

  return (
    <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-3 py-2 text-sm">
      <Bell className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-ink">
        Vuoi che ti avvisi quando comincia un blocco?
      </span>
      <button
        type="button"
        className="btn btn-soft h-8 shrink-0"
        onClick={() => void request()}
      >
        Attiva
      </button>
      <button
        type="button"
        className="icon-btn icon-btn-sm shrink-0"
        aria-label="Non adesso"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
