import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { authorizationUrl } from "@/lib/google/oauth";
import { GOOGLE_STATE_COOKIE } from "@/lib/google/state-cookie";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

/** `node:crypto` non esiste sul runtime edge. */
export const runtime = "nodejs";

/**
 * Avvio del collegamento. Genera uno `state` casuale, lo mette in un cookie
 * `httpOnly` e lo passa a Google: al ritorno i due devono coincidere,
 * altrimenti la richiesta non è partita da qui.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (message: string) =>
    NextResponse.redirect(`${origin}/app?google=${encodeURIComponent(message)}`);

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    // Lo scope dipende dalle preferenze: chi tiene la scrittura spenta non deve
    // dare a Flusso il permesso di modificare i suoi calendari.
    const supabase = await supabaseServer();
    const { data: settings } = await supabase
      .from("user_settings")
      .select("google_write_enabled")
      .maybeSingle();

    const state = randomBytes(24).toString("base64url");
    const params = request.nextUrl.searchParams;

    const response = NextResponse.redirect(
      authorizationUrl({
        state,
        canWrite: settings?.google_write_enabled ?? false,
        addAnotherAccount: params.get("aggiungi") === "1",
        loginHint: params.get("email"),
      }),
    );

    response.cookies.set(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    /*
     * Senza questo `catch` una variabile d'ambiente mancante produce la pagina
     * di errore generica di Vercel: l'utente vede «qualcosa è andato storto» e
     * non ha modo di sapere che gli manca `GOOGLE_CLIENT_ID`. Qui il messaggio
     * dice il nome della variabile, che è l'unica cosa che serve per
     * risolvere.
     */
    return back(explain(error, origin));
  }
}

function explain(error: unknown, origin: string): string {
  const message = error instanceof Error ? error.message : String(error);

  for (const name of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_TOKEN_SECRET",
  ]) {
    if (message.includes(name)) {
      return `Manca ${name} fra le variabili d'ambiente. Aggiungila su Vercel (Settings → Environment Variables) e ripubblica.`;
    }
  }

  if (message.includes("APP_URL")) {
    return `Manca APP_URL: dovrebbe valere ${origin}. Aggiungila su Vercel e ripubblica.`;
  }

  return `Collegamento non avviato: ${message}`;
}
