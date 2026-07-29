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
  if (denied) return back(`Collegamento annullato (${denied}).`);

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

    const calendars = await listCalendars(tokens.access_token);
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
    return back(
      error instanceof Error
        ? `Collegamento fallito: ${error.message}`
        : "Collegamento fallito.",
    );
  }
}
