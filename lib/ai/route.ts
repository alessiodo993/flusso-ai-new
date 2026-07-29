import { NextResponse } from "next/server";

import { AiError } from "@/lib/ai/client";
import { currentUser } from "@/lib/supabase/server";

/**
 * Il guscio comune delle route AI: sessione, corpo della richiesta, errori.
 *
 * Gli errori escono con lo stato giusto e un messaggio già in italiano —
 * 429 quando bisogna aspettare, 402 quando il credito è finito, 502 quando
 * il modello ha risposto storto — perché l'interfaccia deve poterli
 * distinguere senza leggere il testo.
 */
export async function aiRoute<T>(
  request: Request,
  handler: (input: {
    body: unknown;
    userId: string;
  }) => Promise<T>,
): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Corpo vuoto o non JSON: alcune route non hanno parametri obbligatori.
  }

  try {
    return NextResponse.json(await handler({ body, userId: user.id }));
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json(
        { errore: error.message, tipo: error.kind },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        errore:
          error instanceof Error ? error.message : "Richiesta non riuscita.",
        tipo: "unknown",
      },
      { status: 500 },
    );
  }
}
