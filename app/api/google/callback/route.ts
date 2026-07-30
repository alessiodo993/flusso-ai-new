import { NextResponse, type NextRequest } from "next/server";

import { GOOGLE_STATE_COOKIE } from "@/lib/google/state-cookie";
import { canWriteTo, listCalendars } from "@/lib/google/api";
import { upsertAccount } from "@/lib/google/accounts";
import { exchangeCode, fetchUserEmail } from "@/lib/google/oauth";
import { fromGoogleColorId } from "@/lib/colors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Ritorno dal consenso. È l'unico redirect URI da registrare in Google Cloud.
 *
 * Oltre a salvare i token, popola subito l'elenco dei calendari: chiedere
 * all'utente di collegarsi e poi mostrargli una schermata vuota sarebbe un
 * passaggio in più senza motivo.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (message: string) =>
    NextResponse.redirect(
      `${origin}/app?google=${encodeURIComponent(message)}`,
    );

  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { searchParams } = request.nextUrl;

  const denied = searchParams.get("error");
  if (denied) return back(googleError(denied, origin));

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  // Il confronto dello state è ciò che impedisce a un link esterno di far
  // collegare a Flusso un account Google che non è quello dell'utente.
  if (!code || !state || !expected || state !== expected) {
    return back("Richiesta non valida: riprova a collegare l'account.");
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchUserEmail(tokens.access_token);
    const account = await upsertAccount({ userId: user.id, email, tokens });

    /*
     * Da qui in poi l'account **è collegato**. Se l'elenco dei calendari
     * fallisce non si torna indietro dicendo «collegamento fallito»: sarebbe
     * falso, e all'utente resterebbe un account collegato che l'app dichiara
     * assente. I calendari li ripesca la sincronizzazione.
     */
    let calendars: Awaited<ReturnType<typeof listCalendars>> = [];
    try {
      calendars = await listCalendars(tokens.access_token);
    } catch (error) {
      const response = back(
        `Account ${email} collegato, ma l'elenco dei calendari non è arrivato: ${
          error instanceof Error ? error.message : "errore sconosciuto"
        }. Prova ad aggiornare dal calendario.`,
      );
      response.cookies.delete(GOOGLE_STATE_COOKIE);
      return response;
    }

    const supabase = supabaseAdmin();

    if (calendars.length > 0) {
      await supabase.from("google_calendars").upsert(
        calendars.map((calendar) => ({
          user_id: user.id,
          account_id: account.id,
          google_calendar_id: calendar.id,
          name: calendar.summaryOverride ?? calendar.summary ?? calendar.id,
          color: fromGoogleColorId(calendar.colorId),
          // Si parte da ciò che l'utente ha già scelto di vedere su Google.
          enabled: calendar.selected ?? calendar.primary ?? false,
        })),
        {
          onConflict: "user_id,account_id,google_calendar_id",
          // Un ricollegamento non deve azzerare le scelte già fatte qui.
          ignoreDuplicates: true,
        },
      );
    }

    const writable = calendars.filter(canWriteTo).length;
    const response = back(
      `Account ${email} collegato: ${calendars.length} calendari trovati, ${writable} scrivibili.`,
    );
    response.cookies.delete(GOOGLE_STATE_COOKIE);
    return response;
  } catch (error) {
    return back(explain(error, origin));
  }
}

/**
 * Gli errori che Google rimanda nell'URL, tradotti in cosa fare.
 *
 * `access_denied` è il caso più frequente e il più frainteso: quasi sempre
 * non è un rifiuto dell'utente, è la sua email che non compare fra i *Test
 * users* del progetto Google, che finché l'app non è verificata è
 * obbligatoria.
 */
function googleError(code: string, origin: string): string {
  if (code === "access_denied") {
    return "Google ha rifiutato l'accesso. Se non hai premuto «Annulla», quasi sempre manca la tua email fra i «Test users» del progetto in Google Cloud (OAuth consent screen → Audience → Test users).";
  }
  if (code === "redirect_uri_mismatch") {
    return `L'indirizzo di ritorno non combacia. In Google Cloud → Credentials → il tuo client OAuth → Authorized redirect URIs deve esserci esattamente: ${origin}/api/google/callback`;
  }
  if (code === "invalid_client") {
    return "Google non riconosce il client: controlla GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET su Vercel.";
  }
  return `Collegamento annullato (${code}).`;
}

function explain(error: unknown, origin: string): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("redirect_uri_mismatch")) {
    return googleError("redirect_uri_mismatch", origin);
  }
  if (message.includes("invalid_client")) {
    return googleError("invalid_client", origin);
  }
  for (const name of ["GOOGLE_CLIENT_SECRET", "GOOGLE_TOKEN_SECRET"]) {
    if (message.includes(name)) {
      return `Manca ${name} fra le variabili d'ambiente su Vercel: aggiungila e ripubblica.`;
    }
  }
  if (message.includes("channel_id") || message.includes("42703")) {
    return "Al database manca la migrazione 0002: incolla supabase/setup-completo.sql nell'editor SQL di Supabase.";
  }
  return `Collegamento fallito: ${message}`;
}
