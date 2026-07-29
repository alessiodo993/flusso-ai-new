"use client";

import { toast } from "sonner";

/**
 * Ogni azione distruttiva deve essere annullabile.
 *
 * L'azione è già avvenuta quando il toast compare — l'interfaccia è
 * ottimistica — quindi «Annulla» non previene: ripristina. Il tempo è
 * volutamente corto: un annullamento che resta a disposizione troppo a lungo
 * diventa un altro elemento da leggere.
 */
export function undoableToast({
  message,
  onUndo,
  duration = 5000,
}: {
  message: string;
  onUndo: () => void;
  duration?: number;
}) {
  toast(message, {
    duration,
    action: { label: "Annulla", onClick: onUndo },
  });
}
