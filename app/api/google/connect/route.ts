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
  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(`${request.nextUrl.origin}/login`);
  }

  // Lo scope dipende dalle preferenze: chi tiene la scrittura spenta non deve
  // dare a Flusso il permesso di modificare i suoi calendari.
  const supabase = await supabaseServer();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("google_write_enabled")
    .maybeSingle();

  const state = randomBytes(24).toString("base64url");
  const addAnother = request.nextUrl.searchParams.get("aggiungi") === "1";

  const response = NextResponse.redirect(
    authorizationUrl({
      state,
      canWrite: settings?.google_write_enabled ?? false,
      addAnotherAccount: addAnother,
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
}
