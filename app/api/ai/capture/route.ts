import { z } from "zod";

import { captureContext, normalizeCapture } from "@/lib/ai/capture";
import { AiError, askJson } from "@/lib/ai/client";
import { loadContext } from "@/lib/ai/context";
import { CAPTURE_SYSTEM, capturePrompt } from "@/lib/ai/prompts";
import { aiRoute } from "@/lib/ai/route";
import { captureSchema } from "@/lib/ai/schemas";
import { todayISO } from "@/lib/time";

export const runtime = "nodejs";

const input = z.object({
  testo: z.string().min(1).max(4000),
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
      throw new AiError("unknown", "Scrivi o detta qualcosa da interpretare.");
    }

    const { tasks, projects } = await loadContext();
    const today = todayISO();

    const raw = await askJson({
      schema: captureSchema,
      system: CAPTURE_SYSTEM,
      prompt: capturePrompt({
        text: parsed.data.testo,
        today,
        projects,
        tasks: captureContext(tasks),
      }),
    });

    return { proposte: normalizeCapture({ raw, projects, tasks }) };
  });
}
