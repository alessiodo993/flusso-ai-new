import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptToken, encryptToken, tryDecryptToken } from "./crypto";

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

  it("spiega cosa fare se la chiave è della lunghezza sbagliata", () => {
    process.env.GOOGLE_TOKEN_SECRET = randomBytes(16).toString("base64");
    expect(() => encryptToken("x")).toThrow(/32 byte/);
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
