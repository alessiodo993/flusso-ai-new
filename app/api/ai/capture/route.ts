import { z } from "zod";

import { captureContext, normalizeCapture } from "@/lib/ai/capture";
import { AiError, askJson } from "@/lib/ai/client";
import { loadContext } from "@/lib/ai/context";
import { CAPTURE_SYSTEM, capturePrompt } from "@/lib/ai/prompts";
import { aiRoute } from "@/lib/ai/route";
import { captureSchema, keepOrFail, MAX_CAPTURE_CHARS } from "@/lib/ai/schemas";
import { todayISO } from "@/lib/time";

export const runtime = "nodejs";

const input = z.object({
  testo: z.string().min(1).max(MAX_CAPTURE_CHARS),
});

/**
 * Cattura magica: una frase entra, delle proposte escono.
 *
 * Qui non si scrive niente. La route legge, propone e si ferma: le
 * scritture partono dal client solo dopo che l'utente ha confermato la
 * revisione, una proposta alla volta.
 */
export async function POST(request: Request) {
  return aiRoute(request, async ({ body }) => {
    const parsed = input.safeParse(body);
    if (!parsed.success) {
      // Due cause diverse, due rimedi diversi: un messaggio solo manderebbe a
      // cercare cosa scrivere chi ha appena scritto troppo.
      const tooLong =
        typeof (body as { testo?: unknown })?.testo === "string" &&
        (body as { testo: string }).testo.length > MAX_CAPTURE_CHARS;

      throw new AiError(
        "unknown",
        tooLong
          ? `Testo troppo lungo: ${MAX_CAPTURE_CHARS} caratteri al massimo. Dividilo in due catture.`
          : "Scrivi o detta qualcosa da interpretare.",
      );
    }

    const { tasks, projects } = await loadContext();
    const today = todayISO();

    const raw = await askJson({
      schema: captureSchema,
      system: CAPTURE_SYSTEM,
      // Dodici proposte con descrizione e sottotask non stanno in quattromila
      // token: la risposta si troncava a metà proprio sulle frasi più ricche,
      // cioè quelle per cui questa schermata esiste.
      maxTokens: 8000,
      prompt: capturePrompt({
        text: parsed.data.testo,
        today,
        projects,
        tasks: captureContext(tasks),
      }),
    });

    const { items, discarded } = normalizeCapture({ raw, projects, tasks });

    if (discarded > 0) {
      console.warn(
        `[cattura] ${discarded} proposte scartate su ${discarded + items.length}`,
      );
    }

    return {
      proposte: keepOrFail(
        { items, discarded },
        "Ho capito la frase ma non sono riuscito a ricavarne proposte utilizzabili: si riferivano a task che non esistono più. Riprova.",
      ),
      scartate: discarded,
    };
  });
}
