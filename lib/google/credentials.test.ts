import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cleanEnv,
  clientIdProblem,
  clientSecretProblem,
  googleClientId,
  GoogleConfigError,
  maskSecret,
  readVerification,
} from "./credentials";

const ID = "123456789012-abcdefghijklmnop.apps.googleusercontent.com";
const SECRET = "GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwX";

describe("cleanEnv", () => {
  it("toglie l'a capo che l'incolla si porta dietro", () => {
    // È il caso che rompe tutto senza lasciare tracce: nel pannello di Vercel
    // il valore *sembra* identico, ma nell'URL diventa `…com%0A` e Google
    // risponde `invalid_client`.
    expect(cleanEnv(`${ID}\n`, "GOOGLE_CLIENT_ID")).toBe(ID);
    expect(cleanEnv(`  ${ID}  `, "GOOGLE_CLIENT_ID")).toBe(ID);
  });

  it("toglie le virgolette copiate da un file .env", () => {
    expect(cleanEnv(`"${ID}"`, "GOOGLE_CLIENT_ID")).toBe(ID);
    expect(cleanEnv(`'${ID}'`, "GOOGLE_CLIENT_ID")).toBe(ID);
  });

  it("toglie il nome della variabile, se è stata incollata la riga intera", () => {
    expect(cleanEnv(`GOOGLE_CLIENT_ID=${ID}`, "GOOGLE_CLIENT_ID")).toBe(ID);
    expect(cleanEnv(`GOOGLE_CLIENT_ID = "${ID}"`, "GOOGLE_CLIENT_ID")).toBe(ID);
  });

  it("non tocca un valore già pulito, né inventa niente sul vuoto", () => {
    expect(cleanEnv(ID, "GOOGLE_CLIENT_ID")).toBe(ID);
    expect(cleanEnv(undefined, "GOOGLE_CLIENT_ID")).toBe("");
    expect(cleanEnv("   ", "GOOGLE_CLIENT_ID")).toBe("");
  });

  it("una virgoletta sola non è una coppia e resta dov'è", () => {
    // Se la togliessimo il valore risulterebbe valido e il difetto vero
    // (l'apice di troppo) resterebbe invisibile.
    expect(cleanEnv(`"${ID}`, "GOOGLE_CLIENT_ID")).toBe(`"${ID}`);
  });
});

describe("clientIdProblem", () => {
  it("accetta un client ID vero", () => {
    expect(clientIdProblem(ID)).toBeNull();
  });

  it("riconosce i due valori invertiti", () => {
    expect(clientIdProblem(SECRET)).toMatch(/invertiti/);
    expect(clientSecretProblem(ID)).toMatch(/invertiti/);
  });

  it("dice che un valore qualsiasi non è un client ID", () => {
    expect(clientIdProblem("il-mio-client")).toMatch(
      /apps\.googleusercontent\.com/,
    );
  });

  it("nomina la variabile quando manca", () => {
    expect(clientIdProblem("")).toMatch(/GOOGLE_CLIENT_ID/);
    expect(clientSecretProblem("")).toMatch(/GOOGLE_CLIENT_SECRET/);
  });

  it("uno spazio in mezzo non passa", () => {
    expect(
      clientIdProblem("123-abc .apps.googleusercontent.com"),
    ).toMatch(/spazio/);
  });
});

describe("googleClientId", () => {
  const originale = process.env.GOOGLE_CLIENT_ID;
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = `${ID}\n`;
  });
  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originale;
  });

  it("ripulisce prima di restituire", () => {
    expect(googleClientId()).toBe(ID);
  });

  it("solleva un errore già leggibile quando il valore è sbagliato", () => {
    process.env.GOOGLE_CLIENT_ID = SECRET;
    expect(() => googleClientId()).toThrow(GoogleConfigError);
    expect(() => googleClientId()).toThrow(/invertiti/);
  });
});

describe("readVerification", () => {
  const URI = "https://flusso.esempio.it/api/google/callback";

  it("**invalid_grant è la risposta buona**", () => {
    // Google guarda in ordine client, redirect URI e codice, e si ferma al
    // primo che non va: se arriva a lamentarsi del codice inventato, i due
    // prima sono passati.
    const check = readVerification('{"error":"invalid_grant"}', URI);
    expect(check.ok).toBe(true);
  });

  it("invalid_client manda a controllare Google Cloud", () => {
    const check = readVerification('{"error":"invalid_client"}', URI);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/Credentials/);
  });

  it("redirect_uri_mismatch mostra l'indirizzo esatto da registrare", () => {
    // Il secondo errore più comune, e quello che senza il testo esatto porta a
    // registrare indirizzi «quasi» giusti: con lo slash finale, con http.
    const check = readVerification('{"error":"redirect_uri_mismatch"}', URI);
    expect(check.ok).toBe(false);
    expect(check.message).toContain(URI);
  });

  it("unauthorized_client parla del tipo di client", () => {
    const check = readVerification('{"error":"unauthorized_client"}', URI);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/Web application/);
  });

  it("una risposta sconosciuta non viene spacciata per buona", () => {
    const check = readVerification('{"error":"qualcosa_di_nuovo"}', URI);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/qualcosa_di_nuovo/);
  });
});

describe("maskSecret", () => {
  it("non mostra mai il secret intero", () => {
    const masked = maskSecret(SECRET);
    expect(masked).not.toBe(SECRET);
    expect(masked).not.toContain("aBcDeFgHiJkLmNoPqRsTuVwX");
    expect(masked.startsWith("GOCSPX-")).toBe(true);
  });
});
