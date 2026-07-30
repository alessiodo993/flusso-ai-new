import { NextResponse, type NextRequest } from "next/server";

import { appUrl } from "@/lib/env";
import {
  cleanEnv,
  clientIdProblem,
  clientSecretProblem,
  maskSecret,
  verifyCredentials,
} from "@/lib/google/credentials";
import { redirectUri } from "@/lib/google/oauth";
import { currentUser } from "@/lib/supabase/server";
import type { GoogleConfigReport } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Cosa vede il server quando prova a collegare Google.
 *
 * Esiste perché la domanda che ci si pone davanti a `invalid_client` è sempre
 * la stessa — «ma su Vercel c'è davvero il valore che credo?» — e senza questa
 * route l'unico modo di rispondere è fidarsi. Il client ID si mostra intero:
 * viaggia in chiaro nell'URL di consenso, non è un segreto, e mostrarlo a metà
 * renderebbe impossibile l'unica cosa che serve, cioè confrontarlo con Google
 * Cloud. Il secret si mostra mascherato: lì basta sapere *se* c'è.
 *
 * Con `?verifica=1` la risposta arriva da Google invece che da noi.
 */
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  const clientId = cleanEnv(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const clientSecret = cleanEnv(
    process.env.GOOGLE_CLIENT_SECRET,
    "GOOGLE_CLIENT_SECRET",
  );

  const problemi = [
    clientIdProblem(clientId),
    clientSecretProblem(clientSecret),
  ].filter((one): one is string => one !== null);

  // `APP_URL` assente non è un errore in locale, ma in produzione manda Google
  // su un dominio che cambia a ogni deploy: il redirect non combacia più.
  const configuredAppUrl = (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).trim();
  const atteso = `${request.nextUrl.origin}/api/google/callback`;
  const uri = redirectUri();
  if (uri !== atteso) {
    problemi.push(
      `Il redirect che Flusso manda a Google è ${uri}, ma stai usando l'app da ${request.nextUrl.origin}. Metti APP_URL = ${request.nextUrl.origin} su Vercel e ripubblica.`,
    );
  }

  const verifica =
    request.nextUrl.searchParams.get("verifica") === "1"
      ? await verifyCredentials()
      : null;

  const report: GoogleConfigReport = {
    clientId: clientId || null,
    clientSecret: clientSecret ? maskSecret(clientSecret) : null,
    redirectUri: uri,
    appUrl: configuredAppUrl || appUrl(),
    appUrlConfigurato: configuredAppUrl.length > 0,
    problemi,
    verifica,
  };

  return NextResponse.json(report);
}
