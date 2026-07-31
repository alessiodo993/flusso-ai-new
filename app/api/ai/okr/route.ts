import { z } from "zod";

import { AiError, askJson } from "@/lib/ai/client";
import { OKR_SYSTEM, okrPrompt } from "@/lib/ai/prompts";
import { aiRoute } from "@/lib/ai/route";
import {
  keepOrFail,
  okrItem,
  okrSchema,
  sift,
  toText,
  type KeyResultAnalysis,
} from "@/lib/ai/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import { toOkr } from "@/lib/types";

export const runtime = "nodejs";

const input = z.object({
  okrId: z.string().uuid(),
});

/**
 * Analisi dei risultati chiave: sono misurabili, e se no come si riscrivono.
 *
 * L'obiettivo lo rilegge il server dal database invece di riceverlo dal
 * client: così l'analisi parla per forza di una riga che esiste ed è
 * dell'utente, e le riformulazioni tornano indietro riferite a id veri.
 */
export async function POST(request: Request) {
  return aiRoute(request, async ({ body }) => {
    const parsed = input.safeParse(body);
    if (!parsed.success) {
      throw new AiError("unknown", "Obiettivo non valido.");
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("okrs")
      .select("*")
      .eq("id", parsed.data.okrId)
      .maybeSingle();

    if (error) throw new AiError("unknown", error.message);
    if (!data) throw new AiError("unknown", "Obiettivo non trovato.");

    const okr = toOkr(data);
    if (okr.key_results.length === 0) {
      return {
        analisi: [],
        commento: "Aggiungi almeno un risultato chiave da analizzare.",
      };
    }

    const project = okr.project_id
      ? ((
          await supabase
            .from("projects")
            .select("*")
            .eq("id", okr.project_id)
            .maybeSingle()
        ).data ?? null)
      : null;

    const raw = await askJson({
      schema: okrSchema,
      system: OKR_SYSTEM,
      prompt: okrPrompt({ okr, project }),
    });

    const known = new Set(okr.key_results.map((kr) => kr.id));

    const sifted = sift(raw.analisi, okrItem);
    let discarded = sifted.discarded;

    const analisi: KeyResultAnalysis[] = sifted.items
      .filter((one) => {
        if (known.has(one.keyResultId)) return true;
        discarded += 1;
        return false;
      })
      .map((one) => ({
        keyResultId: one.keyResultId,
        measurable: one.misurabile === true,
        problem: toText(one.problema, 300),
        // Una riformulazione identica al testo attuale non è un consiglio.
        rewrite: rewriteOf(
          one.riformulazione,
          okr.key_results.find((kr) => kr.id === one.keyResultId)?.text ?? "",
        ),
      }));

    if (discarded > 0) {
      console.warn(`[okr] ${discarded} analisi scartate`);
    }

    return {
      // Qui il silenzio era la bugia più grossa dell'app: nessuna analisi
      // valida diventava «i risultati chiave sono già misurabili così come
      // sono», cioè un giudizio positivo che nessuno aveva dato.
      analisi: keepOrFail(
        { items: analisi, discarded },
        "L'analisi è tornata riferita a risultati chiave che non esistono. Riprova.",
      ),
      commento: toText(raw.commento, 400),
    };
  });
}

function rewriteOf(
  proposed: string | null | undefined,
  current: string,
): string | null {
  const text = toText(proposed, 300);
  if (!text) return null;
  return text.toLowerCase() === current.trim().toLowerCase() ? null : text;
}
