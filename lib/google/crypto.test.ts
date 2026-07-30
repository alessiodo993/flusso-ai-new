import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  decryptToken,
  encryptToken,
  secretKey,
  tryDecryptToken,
} from "./crypto";

const ORIGINAL = process.env.GOOGLE_TOKEN_SECRET;
const KEY = randomBytes(32).toString("base64");

beforeAll(() => {
  process.env.GOOGLE_TOKEN_SECRET = KEY;
});

afterAll(() => {
  process.env.GOOGLE_TOKEN_SECRET = ORIGINAL;
});

describe("cifratura dei token", () => {
  it("torna al valore di partenza", () => {
    const token = "ya29.a0AfH6SM" + "x".repeat(120);
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("regge i caratteri non ASCII", () => {
    const token = "però—così 🙂";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("produce un risultato diverso a ogni chiamata", () => {
    // Stesso testo, IV nuovo: due righe uguali nel database rivelerebbero
    // che due account condividono lo stesso token.
    const first = encryptToken("stesso-token");
    const second = encryptToken("stesso-token");
    expect(first).not.toBe(second);
    expect(decryptToken(first)).toBe(decryptToken(second));
  });

  it("non lascia il testo in chiaro nel risultato", () => {
    const encrypted = encryptToken("segretissimo");
    expect(encrypted).not.toContain("segretissimo");
  });

  it("salva iv, tag e testo cifrato in una sola stringa", () => {
    expect(encryptToken("x").split("|")).toHaveLength(3);
  });
});

describe("rifiuto dei dati alterati", () => {
  it("respinge un testo cifrato manomesso", () => {
    const [iv, tag, data] = encryptToken("token").split("|");
    const tampered = Buffer.from(data, "base64");
    tampered[0] ^= 0xff;
    expect(() =>
      decryptToken([iv, tag, tampered.toString("base64")].join("|")),
    ).toThrow();
  });

  it("respinge un tag di autenticazione sbagliato", () => {
    const [iv, , data] = encryptToken("token").split("|");
    const fakeTag = randomBytes(16).toString("base64");
    expect(() => decryptToken([iv, fakeTag, data].join("|"))).toThrow();
  });

  it("respinge un formato irriconoscibile", () => {
    expect(() => decryptToken("solo-una-stringa")).toThrow(
      /formato non riconosciuto/i,
    );
    expect(() => decryptToken("a|b")).toThrow();
  });

  it("respinge un token cifrato con un'altra chiave", () => {
    const encrypted = encryptToken("token");
    process.env.GOOGLE_TOKEN_SECRET = randomBytes(32).toString("base64");
    expect(() => decryptToken(encrypted)).toThrow();
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });
});

describe("configurazione della chiave", () => {
  it("spiega cosa fare se la chiave manca", () => {
    delete process.env.GOOGLE_TOKEN_SECRET;
    expect(() => encryptToken("x")).toThrow(/openssl rand -base64 32/);
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });

  it("**la forma canonica resta identica bit per bit**", () => {
    // Se la derivazione cambiasse anche per un base64 da 32 byte, i token già
    // salvati diventerebbero illeggibili e ogni account andrebbe ricollegato.
    expect(secretKey().equals(Buffer.from(KEY, "base64"))).toBe(true);
  });

  it("**accetta una stringa casuale lunga, non solo base64 da 32 byte**", () => {
    // È il caso che la guida stessa suggeriva — «quaranta caratteri da un
    // generatore di password» — e che veniva rifiutato, per giunta con un
    // messaggio che diceva «manca la variabile» mentre c'era.
    process.env.GOOGLE_TOKEN_SECRET =
      "x7Kq-9fPz!Lm2Wn4Tb6Yv8Rd0Sg1Hj3Ck5Aq7Ze9";
    const encrypted = encryptToken("token");
    expect(decryptToken(encrypted)).toBe("token");
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });

  it("la stessa stringa dà sempre la stessa chiave", () => {
    process.env.GOOGLE_TOKEN_SECRET = "una-chiave-lunga-ma-non-base64-32";
    const prima = secretKey();
    process.env.GOOGLE_TOKEN_SECRET = "una-chiave-lunga-ma-non-base64-32";
    expect(secretKey().equals(prima)).toBe(true);
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });

  it("gli spazi intorno non cambiano la chiave", () => {
    // Un a capo incollato per sbaglio renderebbe illeggibili i token cifrati
    // il giorno prima, e la diagnosi sarebbe «ricollega tutti gli account».
    process.env.GOOGLE_TOKEN_SECRET = `  ${KEY}\n`;
    expect(secretKey().equals(Buffer.from(KEY, "base64"))).toBe(true);
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });

  it("rifiuta una chiave troppo corta per esserlo", () => {
    process.env.GOOGLE_TOKEN_SECRET = "segreto";
    expect(() => encryptToken("x")).toThrow(/troppo corta/);
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });

  it("chiavi diverse restano incompatibili fra loro", () => {
    process.env.GOOGLE_TOKEN_SECRET = "prima-chiave-lunga-abbastanza-ok";
    const encrypted = encryptToken("token");
    process.env.GOOGLE_TOKEN_SECRET = "seconda-chiave-lunga-abbastanza!";
    expect(() => decryptToken(encrypted)).toThrow();
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });
});

describe("tryDecryptToken", () => {
  it("restituisce il token quando è valido", () => {
    expect(tryDecryptToken(encryptToken("buono"))).toBe("buono");
  });

  it("restituisce null invece di sollevare", () => {
    expect(tryDecryptToken("rotto")).toBeNull();
    expect(tryDecryptToken(null)).toBeNull();
  });
});
