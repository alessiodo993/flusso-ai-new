"use client";

import { Check, GitMerge, Plus, Trash2, X } from "lucide-react";

import type { CaptureAction, CaptureProposal } from "@/lib/ai/schemas";
import { safeColor } from "@/lib/colors";
import { fmtDuration, fmtRelativeDay } from "@/lib/time";
import { ENERGY_LABEL, type Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<CaptureAction, string> = {
  crea: "Nuovo",
  unisci: "Unisci",
  completa: "Completa",
  elimina: "Elimina",
};

const ACTION_ICON = {
  crea: Plus,
  unisci: GitMerge,
  completa: Check,
  elimina: Trash2,
} as const;

/**
 * Una proposta, prima che diventi un fatto.
 *
 * Il titolo è modificabile qui dentro: se l'unica cosa sbagliata è una
 * parola, rifiutare tutto e ridettare la frase è un prezzo assurdo. Le
 * proposte distruttive — completa, elimina — arrivano **spente**: per quelle
 * il default deve essere il non fare.
 */
export function ProposalCard({
  proposal,
  project,
  accepted,
  onToggle,
  onRename,
}: {
  proposal: CaptureProposal;
  project: Project | undefined;
  accepted: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
}) {
  const Icon = ACTION_ICON[proposal.action];
  const destructive = proposal.action === "elimina";

  return (
    <li
      /*
        Una proposta rifiutata si distingue dalla superficie e dal titolo
        barrato, non da un velo sopra tutta la scheda: `opacity` smorza anche
        il testo, e portava il motivo della proposta e la pastiglia «Elimina»
        sotto la soglia di contrasto — proprio sulla scheda che parte rifiutata
        e che quindi si vede sempre così.
      */
      className={cn(
        "rounded-flusso-md border p-3 transition-colors duration-150",
        accepted ? "border-line-strong bg-surface" : "border-line bg-sunken",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "chip mt-0.5 shrink-0 gap-1",
            destructive
              ? "chip-danger"
              : proposal.action === "crea"
                ? ""
                : "chip-accent",
          )}
        >
          <Icon className="size-3.5" />
          {ACTION_LABEL[proposal.action]}
        </span>

        <input
          className={cn(
            "field-bare min-w-0 flex-1 text-sm font-medium",
            accepted ? "" : "text-ink-soft line-through",
          )}
          value={proposal.title}
          onChange={(event) => onRename(event.target.value)}
          aria-label={`Titolo della proposta: ${proposal.title}`}
          disabled={!accepted}
        />

        <button
          type="button"
          className="icon-btn size-8 shrink-0"
          aria-label={
            accepted ? "Rifiuta questa proposta" : "Accetta questa proposta"
          }
          aria-pressed={accepted}
          onClick={onToggle}
        >
          {accepted ? <X className="size-4" /> : <Check className="size-4" />}
        </button>
      </div>

      {/* Su «completa» ed «elimina» non c'è nessuna pastiglia da mostrare: la
          riga vuota lascerebbe solo un buco sotto al titolo. */}
      {(project ||
        proposal.deadline ||
        proposal.estMinutes ||
        proposal.energy) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
          {project && (
            <span className="chip gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: safeColor(project.color) }}
              />
              {project.name}
            </span>
          )}
          {proposal.deadline && (
            <span className="chip">
              Scade {fmtRelativeDay(proposal.deadline)}
            </span>
          )}
          {proposal.estMinutes && (
            <span className="chip">{fmtDuration(proposal.estMinutes)}</span>
          )}
          {proposal.energy && (
            <span className="chip">
              Energia {ENERGY_LABEL[proposal.energy].toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/*
        Note e sottotask si vedono per intero, non contati.

        Le note finiscono nel task appena si conferma: mostrarne il numero di
        caratteri e non il testo significa far approvare qualcosa che l'utente
        non ha letto. I sottotask sono la parte che il modello sbaglia più
        spesso — un passaggio fuori posto si riconosce a colpo d'occhio, «4
        sottotask» no.
      */}
      {proposal.notes && (
        <p className="mt-2 whitespace-pre-line pl-1 text-sm text-ink-soft">
          {proposal.notes}
        </p>
      )}

      {proposal.subtasks.length > 0 && (
        <ul className="mt-2 space-y-1 pl-1">
          {proposal.subtasks.map((text, index) => (
            <li
              key={`${index}-${text}`}
              className="flex items-start gap-1.5 text-sm text-ink-soft"
            >
              <span
                aria-hidden="true"
                className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-line-strong"
              />
              <span className="min-w-0 flex-1">{text}</span>
            </li>
          ))}
        </ul>
      )}

      {proposal.reason && (
        <p className="mt-2 pl-1 text-xs text-ink-faint">{proposal.reason}</p>
      )}
    </li>
  );
}
