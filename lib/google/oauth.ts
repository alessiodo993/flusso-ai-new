import "server-only";

import {
  googleClientId,
  googleClientSecret,
  redirectUri,
  TOKEN_ENDPOINT,
} from "@/lib/google/credentials";

// Chi fa OAuth cerca il redirect qui, non in `credentials`: là sta soltanto
// perché la verifica delle credenziali ne ha bisogno e importarlo al contrario
// creerebbe un ciclo.
export { redirectUri };

/**
 * OAuth 2.0 verso Google, lato server e basta. Nessun token, nessun secret e
 * nessuna di queste chiamate deve mai arrivare al browser.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
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
  loginHint,
}: {
  state: string;
  canWrite: boolean;
  addAnotherAccount: boolean;
  /** L'email da riconnettere: fa aprire Google già sull'account giusto. */
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: canWrite ? SCOPE_READ_WRITE : SCOPE_READ_ONLY,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    /*
     * `select_account` è ciò che rende possibile il multi-account: senza,
     * Google rimanda direttamente l'account già collegato e il secondo
     * collegamento sovrascrive il primo invece di affiancarlo. Con
     * `consent` da solo l'utente vede la schermata di consenso e conclude
     * che «non funziona», perché ottiene di nuovo l'account che aveva già.
     */
    prompt: addAnotherAccount ? "select_account consent" : "consent",
  });

  // Per una riconnessione sappiamo *quale* account serve: dirlo a Google
  // evita di far scegliere fra cinque indirizzi quello che era scaduto.
  if (loginHint) params.set("login_hint", loginHint);

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
