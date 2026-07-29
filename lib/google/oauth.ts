import "server-only";

import { appUrl } from "@/lib/env";

/**
 * OAuth 2.0 verso Google, lato server e basta. Nessun token, nessun secret e
 * nessuna di queste chiamate deve mai arrivare al browser.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

/** Lettura **e** scrittura: serve alla sincronizzazione in uscita. */
export const SCOPE_READ_WRITE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

/** Solo lettura, per chi tiene la scrittura disattivata. */
export const SCOPE_READ_ONLY = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export function googleClientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID;
  if (!value) throw new Error("Variabile d'ambiente mancante: GOOGLE_CLIENT_ID.");
  return value;
}

function googleClientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET;
  if (!value) {
    throw new Error("Variabile d'ambiente mancante: GOOGLE_CLIENT_SECRET.");
  }
  return value;
}

/** L'unico redirect da registrare in Google Cloud. */
export function redirectUri(): string {
  return `${appUrl()}/api/google/callback`;
}

/**
 * L'indirizzo a cui mandare l'utente per il consenso.
 *
 * `access_type=offline` e `prompt=consent` sono entrambi necessari: senza il
 * primo Google non rilascia il refresh token, senza il secondo non lo rilascia
 * **di nuovo** a chi ha già dato il consenso una volta — e a quel punto la
 * sincronizzazione smetterebbe di funzionare dopo un'ora, senza spiegazioni.
 */
export function authorizationUrl({
  state,
  canWrite,
  addAnotherAccount,
}: {
  state: string;
  canWrite: boolean;
  addAnotherAccount: boolean;
}): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: canWrite ? SCOPE_READ_WRITE : SCOPE_READ_ONLY,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    // Collegare un secondo account richiede di poter scegliere quale.
    prompt: addAnotherAccount ? "select_account consent" : "consent",
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

/** Scambia il codice del consenso con i token. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Scambio del codice fallito (${response.status}): ${await response.text()}`,
    );
  }
  return response.json();
}

/** Errore che segnala un consenso revocato: l'account va ricollegato. */
export class InvalidGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGrantError";
  }
}

/**
 * Rinnova l'access token. Su `invalid_grant` — consenso revocato, password
 * cambiata, refresh token scaduto — solleva un errore riconoscibile, perché la
 * risposta giusta non è riprovare ma chiedere all'utente di ricollegarsi.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    if (body.includes("invalid_grant")) {
      throw new InvalidGrantError("Il consenso Google non è più valido.");
    }
    throw new Error(`Rinnovo del token fallito (${response.status}): ${body}`);
  }

  return JSON.parse(body) as TokenResponse;
}

/** L'indirizzo email dell'account appena collegato. */
export async function fetchUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Lettura del profilo fallita (${response.status}).`);
  }

  const profile = (await response.json()) as { email?: string };
  if (!profile.email) throw new Error("Google non ha restituito un'email.");
  return profile.email;
}
