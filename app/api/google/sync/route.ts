import { NextResponse } from "next/server";

import { syncAllCalendars } from "@/lib/google/sync";
import { currentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Sincronizzazione in entrata, su richiesta.
 *
 * In POST e non in GET: fa scrivere righe, quindi non deve poter partire da un
 * prefetch del browser o da un link visitato per sbaglio.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  try {
    const results = await syncAllCalendars(user.id);

    return NextResponse.json({
      calendari: results.length,
      eventi: results.reduce((total, result) => total + result.upserted, 0),
      /*
       * Gli errori si restituiscono per calendario invece di far fallire tutto:
       * se un account va ricollegato, gli altri devono comunque aggiornarsi.
       */
      errori: results
        .filter((result) => result.error)
        .map((result) => ({ calendario: result.name, errore: result.error })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        errore:
          error instanceof Error
            ? error.message
            : "Sincronizzazione non riuscita.",
      },
      { status: 500 },
    );
  }
}
