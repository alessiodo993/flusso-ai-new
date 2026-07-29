"use client";

import { Loader2, Mic, Square, Wand2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { AiErrorNotice } from "@/components/ai/ai-error";
import { ProposalCard } from "@/components/ai/proposal-card";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import type { CaptureProposal } from "@/lib/ai/schemas";
import { useFlussoEvent } from "@/lib/events";
import { useAiCapture } from "@/lib/hooks/use-ai";
import { useApplyProposals } from "@/lib/hooks/use-apply-proposals";
import { useProjects } from "@/lib/hooks/use-projects";
import { useSpeech } from "@/lib/hooks/use-speech";
import { cn } from "@/lib/utils";

/**
 * Cattura magica: si scarica un pensiero intero, l'AI lo smonta, l'utente
 * decide.
 *
 * Due schermate, mai una sola: **niente si scrive prima della conferma**.
 * Anche quando le proposte sembrano perfette, restano proposte finché non si
 * preme il pulsante in fondo — e quelle distruttive partono rifiutate.
 */
export function MagicCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [proposals, setProposals] = useState<CaptureProposal[] | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const textarea = useRef<HTMLTextAreaElement>(null);

  const { byId: projectsById } = useProjects();
  const capture = useAiCapture();
  const apply = useApplyProposals();

  const speech = useSpeech({
    onTranscript: useCallback((chunk: string) => {
      setText((current) => (current ? `${current} ${chunk.trim()}` : chunk.trim()));
    }, []),
  });

  const reset = useCallback(() => {
    setProposals(null);
    setAccepted(new Set());
    capture.reset();
  }, [capture]);

  useFlussoEvent(
    "flusso:magic-capture",
    useCallback(
      ({ voice }) => {
        setOpen(true);
        reset();
        // Il microfono parte solo se è stato chiesto esplicitamente.
        if (voice) speech.start();
        else setTimeout(() => textarea.current?.focus(), 50);
      },
      [reset, speech],
    ),
  );

  const interpret = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    speech.stop();

    capture.mutate(value, {
      onSuccess: ({ proposte }) => {
        setProposals(proposte);
        // Creare e unire sono reversibili; completare ed eliminare molto meno.
        setAccepted(
          new Set(
            proposte
              .filter((one) => one.action === "crea" || one.action === "unisci")
              .map((one) => one.id),
          ),
        );
      },
    });
  }, [capture, speech, text]);

  const toApply = useMemo(
    () => (proposals ?? []).filter((one) => accepted.has(one.id)),
    [accepted, proposals],
  );

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      speech.stop();
      // Il testo resta: riaprendo si riparte da dove si era rimasti.
      setProposals(null);
      setAccepted(new Set());
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={close}
      title="Cattura magica"
      description={
        proposals
          ? "Controlla, correggi, scegli cosa tenere. Niente viene salvato finché non confermi."
          : "Scrivi o detta tutto quello che hai in testa: ci penso io a smontarlo."
      }
      footer={
        proposals ? (
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={reset}>
              Torna indietro
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={toApply.length === 0 || apply.isPending}
              onClick={async () => {
                await apply.run(toApply);
                close(false);
                setText("");
              }}
            >
              {apply.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {toApply.length === 0
                ? "Niente da applicare"
                : `Applica ${toApply.length}`}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!text.trim() || capture.isPending}
            onClick={interpret}
          >
            {capture.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {capture.isPending ? "Sto leggendo…" : "Interpreta"}
          </button>
        )
      }
    >
      {proposals ? (
        <Review
          proposals={proposals}
          accepted={accepted}
          projectsById={projectsById}
          onToggle={(id) =>
            setAccepted((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onRename={(id, title) =>
            setProposals((current) =>
              (current ?? []).map((one) =>
                one.id === id ? { ...one, title } : one,
              ),
            )
          }
        />
      ) : (
        <div className="space-y-3 pb-1">
          <textarea
            ref={textarea}
            className="field min-h-32 resize-y leading-relaxed"
            placeholder="Es. «Devo finire il capitolo 3 della tesi entro venerdì, sono tipo due ore, e ricordami di chiamare l'idraulico»"
            value={text + (speech.interim ? ` ${speech.interim}` : "")}
            onChange={(event) => setText(event.target.value)}
            aria-label="Cosa hai in testa"
          />

          {speech.supported && (
            <button
              type="button"
              className={cn("btn w-full", speech.listening ? "btn-danger" : "btn-soft")}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              aria-pressed={speech.listening}
            >
              {speech.listening ? (
                <>
                  <Square className="size-4" />
                  Ferma la dettatura
                </>
              ) : (
                <>
                  <Mic className="size-4" />
                  Detta
                </>
              )}
            </button>
          )}

          {speech.error && (
            <p role="alert" className="text-sm text-danger">
              {speech.error}
            </p>
          )}

          <AiErrorNotice error={capture.error} onRetry={interpret} />
        </div>
      )}
    </ResponsiveSheet>
  );
}

function Review({
  proposals,
  accepted,
  projectsById,
  onToggle,
  onRename,
}: {
  proposals: CaptureProposal[];
  accepted: Set<string>;
  projectsById: Map<string, import("@/lib/types").Project>;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  if (proposals.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-soft">
        Non ho trovato niente di azionabile in quella frase. Prova a dirla in
        modo più diretto: «devo fare X entro venerdì».
      </p>
    );
  }

  return (
    <ul className="space-y-2 pb-1">
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          project={
            proposal.projectId ? projectsById.get(proposal.projectId) : undefined
          }
          accepted={accepted.has(proposal.id)}
          onToggle={() => onToggle(proposal.id)}
          onRename={(title) => onRename(proposal.id, title)}
        />
      ))}
    </ul>
  );
}
