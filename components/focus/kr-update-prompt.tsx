"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { keyResultStep, type KeyResult } from "@/lib/types";

/**
 * Dopo un blocco chiuso, la domanda che collega l'esecuzione alla strategia:
 * quel lavoro ha spostato il risultato chiave?
 *
 * Compare **solo** a blocco completato e solo se un OKR di quel progetto
 * esiste: chiederlo sempre lo trasformerebbe in rumore da chiudere in fretta.
 */
export function KeyResultUpdatePrompt({
  open,
  keyResult,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  keyResult: KeyResult | null;
  onConfirm: (current: number) => void;
  onDismiss: () => void;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (keyResult) setValue(keyResult.current);
  }, [keyResult]);

  if (!keyResult) return null;

  const step = keyResultStep(keyResult);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => !next && onDismiss()}
      title="Vuoi aggiornare il risultato?"
      description={keyResult.text}
      footer={
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            Non adesso
          </button>
          <button
            type="button"
            className="btn btn-primary ml-auto"
            onClick={() => onConfirm(value)}
            disabled={value === keyResult.current}
          >
            Aggiorna
          </button>
        </div>
      }
    >
      <div className="flex items-center justify-center gap-5 py-4">
        <button
          type="button"
          className="icon-btn border border-line"
          aria-label={`Togli ${step}`}
          onClick={() => setValue((v) => Math.max(0, v - step))}
        >
          <Minus className="size-5" />
        </button>

        <div className="text-center">
          <p className="tnum font-display text-4xl">
            {value}
            <span className="text-ink-faint">/{keyResult.target}</span>
          </p>
          {keyResult.unit && (
            <p className="mt-1 text-xs text-ink-faint">{keyResult.unit}</p>
          )}
        </div>

        <button
          type="button"
          className="icon-btn border border-line"
          aria-label={`Aggiungi ${step}`}
          onClick={() => setValue((v) => v + step)}
        >
          <Plus className="size-5" />
        </button>
      </div>
    </ResponsiveSheet>
  );
}
