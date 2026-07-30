import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  authorizationUrl,
  redirectUri,
  SCOPE_READ_ONLY,
  SCOPE_READ_WRITE,
} from "./oauth";

const ORIGINALI = {
  id: process.env.GOOGLE_CLIENT_ID,
  app: process.env.APP_URL,
};

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "prova.apps.googleusercontent.com";
  process.env.APP_URL = "https://flusso.esempio.it";
});

afterEach(() => {
  process.env.GOOGLE_CLIENT_ID = ORIGINALI.id;
  process.env.APP_URL = ORIGINALI.app;
});

/** I parametri dell'URL di consenso, come li leggerà Google. */
function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("redirectUri", () => {
  it("è l'unico indirizzo da registrare in Google Cloud", () => {
    expect(redirectUri()).toBe(
      "https://flusso.esempio.it/api/google/callback",
    );
  });
});

describe("authorizationUrl", () => {
  const base = { state: "abc123", canWrite: false, addAnotherAccount: false };

  it("chiede il refresh token, che senza `offline` non arriva", () => {
    const p = params(authorizationUrl(base));
    expect(p.get("access_type")).toBe("offline");
    // Senza `consent` Google non ridà il refresh token a chi ha già
    // acconsentito, e la sincronizzazione muore dopo un'ora.
    expect(p.get("prompt")).toContain("consent");
    expect(p.get("state")).toBe("abc123");
  });

  it("**collegare un secondo account richiede select_account**", () => {
    // È il difetto che ha fatto sembrare rotto il multi-account: senza questo
    // parametro Google rimanda l'account già collegato, l'utente rifà tutto il
    // giro e si ritrova con lo stesso indirizzo di prima.
    const p = params(authorizationUrl({ ...base, addAnotherAccount: true }));
    expect(p.get("prompt")).toBe("select_account consent");
  });

  it("chiede la scrittura solo a chi l'ha attivata", () => {
    expect(params(authorizationUrl(base)).get("scope")).toBe(SCOPE_READ_ONLY);
    expect(
      params(authorizationUrl({ ...base, canWrite: true })).get("scope"),
    ).toBe(SCOPE_READ_WRITE);
  });

  it("con login_hint apre Google sull'account da riconnettere", () => {
    const p = params(
      authorizationUrl({ ...base, loginHint: "tizio@esempio.it" }),
    );
    expect(p.get("login_hint")).toBe("tizio@esempio.it");
  });

  it("senza login_hint non manda un parametro vuoto", () => {
    expect(params(authorizationUrl(base)).has("login_hint")).toBe(false);
    expect(
      params(authorizationUrl({ ...base, loginHint: null })).has("login_hint"),
    ).toBe(false);
  });

  it("il redirect_uri combacia con quello registrato", () => {
    // Se questi due divergono Google risponde `redirect_uri_mismatch`, che è
    // il secondo errore più comune del collegamento.
    expect(params(authorizationUrl(base)).get("redirect_uri")).toBe(
      redirectUri(),
    );
  });
});
