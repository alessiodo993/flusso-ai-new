import "server-only";

import { appUrl } from "@/lib/env";

/**
 * Le credenziali OAuth di Google: lette, ripulite e **controllate prima** di
 * spedire l'utente da Google.
 *
 * Il motivo di questo modulo è un errore reale: `Errore 401: invalid_client —
 * The OAuth client was not found`. È una pagina di Google, in inglese, che
 * arriva dopo il redirect e non dice quale variabile guardare né cosa ha che
 * non va. Tutte le cause però sono visibili da qui, prima di partire: il campo
 * vuoto, il secret incollato al posto dell'ID, la riga intera di un file `.env`
 * incollata com'era, le virgolette, l'a capo finale che l'incolla si porta
 * dietro e che finisce nell'URL come `%0A`.
 *
 * Il client ID **non è un segreto**: viaggia in chiaro nell'URL di consenso,
 * quindi mostrarlo per intero all'utente è corretto ed è l'unico modo che ha
 * per confrontarlo con quello di Google Cloud. Il secret invece si maschera.
 */

export const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Tutti i client ID web di Google finiscono così. Senza eccezioni. */
const CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

/** I secret creati da qualche anno a questa parte cominciano così. */
const SECRET_PREFIX = "GOCSPX-";

/**
 * Errore di configurazione il cui messaggio è **già scritto per l'utente**:
 * chi lo intercetta lo mostra così com'è, senza riscriverlo.
 */
export class GoogleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleConfigError";
  }
}

/**
 * Toglie da un valore incollato tutto ciò che non è il valore.
 *
 * Non è pignoleria: `URLSearchParams` codifica fedelmente ciò che gli si dà, e
 * un solo a capo finale trasforma un client ID valido in uno che Google non
 * trova. Il pannello di Vercel accetta senza protestare sia l'a capo sia le
 * virgolette sia la riga `NOME=valore` copiata per intero.
 */
export function cleanEnv(raw: string | undefined | null, name: string): string {
  let value = (raw ?? "").trim();

  // «GOOGLE_CLIENT_ID=123-abc.apps...» → «123-abc.apps...»
  const assignment = new RegExp(`^${name}\\s*=\\s*`);
  value = value.replace(assignment, "").trim();

  // Le virgolette che quella riga si porta dietro quando viene da un `.env`.
  const quoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));
  if (quoted) value = value.slice(1, -1).trim();

  return value;
}

/**
 * Cosa c'è che non va nel client ID, in italiano e con il rimedio. `null` se
 * la forma è quella giusta — che non garantisce che il client esista ancora:
 * per quello serve `verifyCredentials`.
 */
export function clientIdProblem(value: string): string | null {
  if (!value) {
    return "Manca GOOGLE_CLIENT_ID fra le variabili d'ambiente. Su Vercel: Settings → Environment Variables, aggiungila e ripubblica.";
  }
  if (value.startsWith(SECRET_PREFIX)) {
    return `In GOOGLE_CLIENT_ID c'è il client secret: comincia con ${SECRET_PREFIX}, ma l'ID finisce con ${CLIENT_ID_SUFFIX}. I due valori sono invertiti.`;
  }
  if (!value.endsWith(CLIENT_ID_SUFFIX)) {
    return `GOOGLE_CLIENT_ID non è un ID OAuth di Google: deve finire con ${CLIENT_ID_SUFFIX}. Copialo da Google Cloud → Credentials → il tuo «OAuth 2.0 Client ID» (colonna Client ID).`;
  }
  if (/\s/.test(value)) {
    return "GOOGLE_CLIENT_ID contiene uno spazio o un a capo: ricopialo senza righe vuote intorno.";
  }
  return null;
}

/** Come sopra, per il secret. */
export function clientSecretProblem(value: string): string | null {
  if (!value) {
    return "Manca GOOGLE_CLIENT_SECRET fra le variabili d'ambiente. Su Vercel: Settings → Environment Variables, aggiungila e ripubblica.";
  }
  if (value.endsWith(CLIENT_ID_SUFFIX)) {
    return "In GOOGLE_CLIENT_SECRET c'è il client ID. I due valori sono invertiti.";
  }
  if (/\s/.test(value)) {
    return "GOOGLE_CLIENT_SECRET contiene uno spazio o un a capo: ricopialo senza righe vuote intorno.";
  }
  return null;
}

export function googleClientId(): string {
  const value = cleanEnv(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const problem = clientIdProblem(value);
  if (problem) throw new GoogleConfigError(problem);
  return value;
}

export function googleClientSecret(): string {
  const value = cleanEnv(
    process.env.GOOGLE_CLIENT_SECRET,
    "GOOGLE_CLIENT_SECRET",
  );
  const problem = clientSecretProblem(value);
  if (problem) throw new GoogleConfigError(problem);
  return value;
}

/**
 * L'unico redirect da registrare in Google Cloud.
 *
 * Sta qui e non in `oauth.ts` perché serve anche alla verifica delle
 * credenziali, che `oauth.ts` importa: al contrario ci sarebbe un ciclo.
 */
export function redirectUri(): string {
  return `${appUrl()}/api/google/callback`;
}

/** Il secret non si mostra mai per intero, nemmeno al suo proprietario. */
export function maskSecret(value: string): string {
  if (!value) return "—";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

export type CredentialCheck = {
  ok: boolean;
  /** Messaggio per l'utente: cosa è stato accertato e, se serve, cosa fare. */
  message: string;
};

/**
 * Chiede a Google se queste credenziali esistono davvero.
 *
 * Il trucco è vecchio e affidabile: si presenta al token endpoint un codice di
 * autorizzazione inventato, con lo **stesso `redirect_uri` vero**. Google
 * controlla in ordine il client, poi l'indirizzo, poi il codice, e si ferma al
 * primo che non va:
 *
 * - `invalid_client` → il client non esiste (è l'errore che si vede a schermo);
 * - `redirect_uri_mismatch` → il client c'è, l'indirizzo non è registrato;
 * - `invalid_grant` → tutto a posto, si lamenta solo del codice inventato.
 *
 * Cioè: i due modi in cui il collegamento fallisce si scoprono **prima** di
 * fare il giro del consenso. Serve perché la forma giusta non basta: un client
 * ID cancellato, o copiato da un altro progetto, è indistinguibile da uno
 * funzionante finché non lo si chiede a Google.
 *
 * L'URI vero non è un dettaglio: con un dominio finto Google risponde
 * `invalid_request` per violazione delle sue regole e la diagnosi si perde.
 */
export async function verifyCredentials(): Promise<CredentialCheck> {
  let clientId: string;
  let clientSecret: string;
  try {
    clientId = googleClientId();
    clientSecret = googleClientSecret();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const uri = redirectUri();

  let body: string;
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: "flusso-verifica-credenziali",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: uri,
        grant_type: "authorization_code",
      }),
    });
    body = await response.text();
  } catch (error) {
    return {
      ok: false,
      message: `Google non risponde: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  return readVerification(body, uri);
}

/** La lettura della risposta, separata perché è la parte che va provata. */
export function readVerification(
  body: string,
  uri: string,
): CredentialCheck {
  if (body.includes("invalid_client")) {
    return {
      ok: false,
      message:
        "Google non conosce questo client ID: o il valore su Vercel non è quello giusto, o il client OAuth è stato cancellato. Apri Google Cloud → APIs & Services → Credentials e confronta il Client ID con quello qui sopra; se non c'è, creane uno nuovo di tipo «Web application».",
    };
  }
  if (body.includes("unauthorized_client")) {
    return {
      ok: false,
      message:
        "Il client esiste ma non è del tipo giusto: in Google Cloud → Credentials dev'essere un OAuth client di tipo «Web application», non Desktop né Android/iOS.",
    };
  }
  if (body.includes("redirect_uri_mismatch")) {
    return {
      ok: false,
      message: `Le credenziali vanno bene, ma l'indirizzo di ritorno non è registrato. In Google Cloud → Credentials → il tuo client OAuth → «Authorized redirect URIs» aggiungi esattamente: ${uri}`,
    };
  }
  if (body.includes("invalid_grant")) {
    // L'unica risposta che vogliamo: client, secret e redirect URI sono a
    // posto, e Google si lamenta soltanto del codice inventato.
    return {
      ok: true,
      message:
        "Tutto a posto: Google riconosce le credenziali e l'indirizzo di ritorno. Se il collegamento fallisce lo stesso, manca la tua email fra i «Test users».",
    };
  }
  return {
    ok: false,
    message: `Risposta inattesa da Google: ${body.slice(0, 300)}`,
  };
}
