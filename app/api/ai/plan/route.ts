import { z } from "zod";

import { AiError, askJson } from "@/lib/ai/client";
import { loadContext } from "@/lib/ai/context";
import { PLAN_SYSTEM, planPrompt } from "@/lib/ai/prompts";
import { aiRoute } from "@/lib/ai/route";
import { planSchema, toText } from "@/lib/ai/schemas";
import { isListable } from "@/lib/list-view";

export const runtime = "nodejs";

const input = z.object({
  giorni: z.array(z.string()).min(1).max(7),
  minutiDisponibili: z.number().int().nonnegative(),
  coefficiente: z.number().nullable().optional(),
  progettiIndietro: z.array(z.string()).optional(),
});

/**
 * La parte del planner che spetta al modello: **quali** task, e in che ordine.
 *
 * Gli orari non passano di qui. Li calcola `lib/planner.ts` sul client, che
 * conosce già impegni fissi, eventi Google e fasce orarie; questa route
 * restituisce solo una graduatoria di id, e ignora quelli che non esistono.
 */
export async function POST(request: Request) {
  return aiRoute(request, async ({ body }) => {
    const parsed = input.safeParse(body);
    if (!parsed.success) {
      throw new AiError("unknown", "Scegli almeno un giorno da pianificare.");
    }

    const { tasks, projects } = await loadContext();
    // Solo ciò che è in Lista: già sul calendario o da rivedere non si ripianifica.
    const candidates = tasks.filter(
      (task) => task.status !== "done" && isListable(task),
    );

    if (candidates.length === 0) {
      return { scelte: [], nota: "Non c'è niente da pianificare in Lista." };
    }

    const raw = await askJson({
      schema: planSchema,
      system: PLAN_SYSTEM,
      prompt: planPrompt({
        tasks: candidates,
        projects,
        days: parsed.data.giorni,
        minutesAvailable: parsed.data.minutiDisponibili,
        coefficient: parsed.data.coefficiente ?? null,
        behindProjects: parsed.data.progettiIndietro ?? [],
      }),
    });

    const known = new Set(candidates.map((task) => task.id));
    const seen = new Set<string>();

    const scelte = (raw.scelte ?? [])
      .filter((choice) => {
        if (!known.has(choice.taskId) || seen.has(choice.taskId)) return false;
        seen.add(choice.taskId);
        return true;
      })
      .map((choice) => ({
        taskId: choice.taskId,
        motivo: toText(choice.motivo, 200),
      }));

    return { scelte, nota: toText(raw.nota, 300) };
  });
}
