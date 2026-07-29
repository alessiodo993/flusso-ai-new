import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { channelTokenFor, userIdFromChannelToken } from "./channel-token";

const ORIGINAL = process.env.GOOGLE_TOKEN_SECRET;
const KEY = randomBytes(32).toString("base64");
const USER = "11111111-1111-1111-1111-111111111111";

beforeAll(() => {
  process.env.GOOGLE_TOKEN_SECRET = KEY;
});

afterAll(() => {
  process.env.GOOGLE_TOKEN_SECRET = ORIGINAL;
});

describe("token del canale di notifica", () => {
  it("riconosce un token che ha emesso lui", () => {
    expect(userIdFromChannelToken(channelTokenFor(USER))).toBe(USER);
  });

  it("è stabile: lo stesso utente produce sempre lo stesso token", () => {
    expect(channelTokenFor(USER)).toBe(channelTokenFor(USER));
  });

  it("dà token diversi a utenti diversi", () => {
    expect(channelTokenFor(USER)).not.toBe(
      channelTokenFor("22222222-2222-2222-2222-222222222222"),
    );
  });
});

describe("rifiuto dei token non autentici", () => {
  it("respinge una firma inventata", () => {
    expect(userIdFromChannelToken(`${USER}.firmafinta`)).toBeNull();
  });

  it("respinge un utente sostituito, anche con una firma valida", () => {
    // Il caso che conta: prendere un token buono e cambiarci l'utente per
    // far sincronizzare i calendari di qualcun altro.
    const valid = channelTokenFor(USER);
    const signature = valid.slice(valid.lastIndexOf(".") + 1);
    expect(
      userIdFromChannelToken(`22222222-2222-2222-2222-222222222222.${signature}`),
    ).toBeNull();
  });

  it("respinge un token firmato con un'altra chiave", () => {
    const foreign = channelTokenFor(USER);
    process.env.GOOGLE_TOKEN_SECRET = randomBytes(32).toString("base64");
    expect(userIdFromChannelToken(foreign)).toBeNull();
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });

  it("respinge i token malformati e quelli assenti", () => {
    expect(userIdFromChannelToken(null)).toBeNull();
    expect(userIdFromChannelToken("")).toBeNull();
    expect(userIdFromChannelToken("senza-punto")).toBeNull();
    expect(userIdFromChannelToken(".solo-firma")).toBeNull();
  });

  it("non solleva se la chiave non è configurata", () => {
    const token = channelTokenFor(USER);
    delete process.env.GOOGLE_TOKEN_SECRET;
    expect(() => userIdFromChannelToken(token)).not.toThrow();
    expect(userIdFromChannelToken(token)).toBeNull();
    process.env.GOOGLE_TOKEN_SECRET = KEY;
  });
});
