import { z } from "zod";

import { AiError, askJson } from "@/lib/ai/client";
import { loadContext } from "@/lib/ai/context";
import { SHUTDOWN_SYSTEM, shutdownPrompt } from "@/lib/ai/prompts";
import { aiRoute } from "@/lib/ai/route";
import {
  keepOrFail,
  shutdownItem,
  shutdownSchema,
  sift,
  toText,
} from "@/lib/ai/schemas";
import { parseHHMM, snap } from "@/lib/time";

export const runtime = "nodejs";

const input = z.object({
  domani: z.string(),
  taskIds: z.array(z.string()).max(20),
  /** Spazi liberi di domani, già calcolati dal client: `09:00–11:30`. */
  slotLiberi: z.array(z.string()).max(20),
});

/**
 * Il suggerimento di fine giornata: dove mettere domani ciò che oggi è
 * rimasto indietro.
 *
 * Anche qui nessuna scrittura: sono orari proposti, che l'utente accetta uno
 * per uno nella schermata di shutdown. Quelli fuori dagli spazi liberi
 * vengono scartati prima di arrivargli davanti.
 */
export async function POST(request: Request) {
  return aiRoute(request, async ({ body }) => {
    const parsed = input.safeParse(body);
    if (!parsed.success) {
      throw new AiError("unknown", "Richiesta non valida.");
    }

    const { tasks, projects } = await loadContext();
    const wanted = new Set(parsed.data.taskIds);
    const pending = tasks.filter((task) => wanted.has(task.id));

    if (pending.length === 0) {
      return { suggerimenti: [], commento: "" };
    }

    const raw = await askJson({
      schema: shutdownSchema,
      system: SHUTDOWN_SYSTEM,
      prompt: shutdownPrompt({
        tasks: pending,
        projects,
        tomorrow: parsed.data.domani,
        freeSlots: parsed.data.slotLiberi,
      }),
    });

    const ranges = parsed.data.slotLiberi.map(parseSlot).filter(nonNull);
    const known = new Set(pending.map((task) => task.id));
    const seen = new Set<string>();

    const sifted = sift(raw.suggerimenti, shutdownItem);
    let discarded = sifted.discarded;

    const suggerimenti = sifted.items
      .flatMap((one) => {
        if (!known.has(one.taskId) || seen.has(one.taskId)) {
          discarded += 1;
          return [];
        }

        const minute = one.oraInizio ? parseHHMM(one.oraInizio.slice(0, 5)) : null;
        if (minute === null) {
          discarded += 1;
          return [];
        }

        const start = snap(minute);
        if (!ranges.some((range) => start >= range.start && start < range.end)) {
          discarded += 1;
          return [];
        }

        seen.add(one.taskId);
        return [
          {
            taskId: one.taskId,
            startMinute: start,
            motivo: toText(one.motivo, 200),
          },
        ];
      })
      .slice(0, 3);

    if (discarded > 0) {
      console.warn(`[shutdown] ${discarded} suggerimenti scartati`);
    }

    return {
      suggerimenti: keepOrFail(
        { items: suggerimenti, discarded },
        "Gli orari proposti cadevano tutti fuori dai tuoi spazi liberi di domani. Riprova, oppure sistemali a mano.",
      ),
      commento: toText(raw.commento, 400),
    };
  });
}

function parseSlot(slot: string): { start: number; end: number } | null {
  const [from, to] = slot.split(/[–-]/).map((part) => part.trim());
  const start = from ? parseHHMM(from) : null;
  const end = to ? parseHHMM(to) : null;
  return start === null || end === null ? null : { start, end };
}

function nonNull<T>(value: T | null): value is T {
  return value !== null;
}
