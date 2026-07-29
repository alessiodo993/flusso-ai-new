"use client";

import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AiErrorNotice } from "@/components/ai/ai-error";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { useAiOkrAnalysis } from "@/lib/hooks/use-ai";
import type { KeyResult, Okr } from "@/lib/types";

/**
 * L'analisi dei risultati chiave: sono misurabili, e se no come si dicono.
 *
 * Le riformulazioni non si applicano da sole. Ognuna ha il suo pulsante,
 * perché riscrivere un obiettivo è una decisione, non una correzione di
 * battitura — e perché il modello a volte propone una versione più stretta
 * di quella che l'utente aveva in mente.
 */
export function OkrAnalysisSheet({
  okr,
  open,
  onOpenChange,
  onRewrite,
}: {
  okr: Okr | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRewrite: (keyResults: KeyResult[]) => void;
}) {
  const analysis = useAiOkrAnalysis();
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const analyze = useCallback(() => {
    if (okr) analysis.mutate(okr.id);
  }, [analysis, okr]);

  // L'analisi parte all'apertura: chi arriva qui l'ha già chiesta premendo
  // il pulsante, farne premere un secondo sarebbe una domanda di troppo.
  useEffect(() => {
    if (!open || !okr) return;
    setApplied(new Set());
    analysis.reset();
    analysis.mutate(okr.id);
    // Solo all'apertura e al cambio di obiettivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okr?.id, open]);

  // Solo le analisi che parlano di un risultato chiave ancora esistente: la
  // route filtra già, ma qui l'obiettivo può essere cambiato nel frattempo.
  const results = (analysis.data?.analisi ?? []).filter((one) =>
    okr?.key_results.some((kr) => kr.id === one.keyResultId),
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sono misurabili?"
      description={okr?.objective}
    >
      <div className="space-y-3 pb-1">
        {analysis.isPending && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
            <Loader2 className="size-4 animate-spin" />
            Sto leggendo i risultati chiave…
          </p>
        )}

        <AiErrorNotice error={analysis.error} onRetry={analyze} />

        {analysis.data?.commento && (
          <p className="rounded-flusso-md bg-sunken p-3 text-sm text-ink-soft">
            {analysis.data.commento}
          </p>
        )}

        {results.map((one) => {
          const keyResult = okr?.key_results.find(
            (kr) => kr.id === one.keyResultId,
          );
          if (!keyResult) return null;

          return (
            <article
              key={one.keyResultId}
              className="rounded-flusso-md border border-line p-3"
            >
              <div className="flex items-start gap-2">
                {one.measurable ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                )}
                <p className="min-w-0 flex-1 text-sm font-medium">
                  {keyResult.text}
                </p>
              </div>

              {one.problem && (
                <p className="mt-1.5 pl-6 text-sm text-ink-soft">{one.problem}</p>
              )}

              {one.rewrite && (
                <div className="mt-2 pl-6">
                  <p className="rounded-flusso-sm bg-accent-soft p-2.5 text-sm">
                    {one.rewrite}
                  </p>
                  <button
                    type="button"
                    className="btn btn-soft mt-2 h-8 px-2.5 text-xs"
                    disabled={applied.has(one.keyResultId) || !okr}
                    onClick={() => {
                      if (!okr) return;
                      onRewrite(
                        okr.key_results.map((kr) =>
                          kr.id === one.keyResultId
                            ? { ...kr, text: one.rewrite as string }
                            : kr,
                        ),
                      );
                      setApplied((current) =>
                        new Set(current).add(one.keyResultId),
                      );
                      toast.success("Risultato chiave riscritto.");
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    {applied.has(one.keyResultId) ? "Applicata" : "Usa questa"}
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {!analysis.isPending && !analysis.error && results.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-soft">
            Nessuna osservazione: i risultati chiave sono già misurabili così
            come sono.
          </p>
        )}
      </div>
    </ResponsiveSheet>
  );
}
