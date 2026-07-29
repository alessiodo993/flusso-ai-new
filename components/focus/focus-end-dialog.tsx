"use client";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";

/**
 * Cosa succede quando il tempo finisce.
 *
 * Non si chiude da sé e non rinvia da sé: la scelta la fa la persona, sempre.
 * «Continuo più tardi» è deliberatamente l'ultima e la meno vistosa — è la
 * via d'uscita onesta, non quella da suggerire.
 */
export function FocusEndDialog({
  open,
  micro,
  microMinutes,
  onDone,
  onExtend,
  onLater,
}: {
  open: boolean;
  /** Dopo un micro-avvio la domanda è un'altra: sei partito, continui? */
  micro: boolean;
  microMinutes: number;
  onDone: () => void;
  onExtend: (minutes: number) => void;
  onLater: () => void;
}) {
  const extraMinutes = micro ? microMinutes * 2 : 15;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={() => {
        /* Nessuna chiusura implicita: bisogna scegliere. */
      }}
      title={micro ? "Ottimo, sei partito." : "Tempo scaduto."}
      description={
        micro
          ? "La parte difficile era cominciare. Vuoi andare avanti?"
          : "Come è andata?"
      }
      footer={
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Ho finito
          </button>

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => onExtend(extraMinutes)}
          >
            +{extraMinutes} minuti
          </button>

          {/* Meno evidente delle altre due, di proposito. */}
          <button type="button" className="btn btn-ghost" onClick={onLater}>
            Continuo più tardi
          </button>
        </div>
      }
    >
      <p className="pb-2 text-sm leading-relaxed text-ink-soft">
        {micro
          ? `Se continui, il blocco riparte per altri ${extraMinutes} minuti. Se no, quello che resta torna in Lista.`
          : "Se scegli «Continuo più tardi» il task torna in Lista, senza giorno né orario, e la sessione viene registrata come parziale."}
      </p>
    </ResponsiveSheet>
  );
}
