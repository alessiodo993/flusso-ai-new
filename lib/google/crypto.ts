import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifratura dei token Google prima di scriverli nel database.
 *
 * AES-256-GCM, non AES-CBC: GCM autentica il testo cifrato, quindi un token
 * manomesso viene **rifiutato** invece di decifrarsi in spazzatura. La riga
 * salvata è `iv|tag|ciphertext`, tutto in base64 e in una sola colonna: tre
 * colonne separate finirebbero prima o poi disallineate.
 */

const ALGORITHM = "aes-256-gcm";
/** 96 bit: la lunghezza per cui GCM è specificato e ottimizzato. */
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function secretKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_SECRET;
  if (!raw) {
    throw new Error(
      "Variabile d'ambiente mancante: GOOGLE_TOKEN_SECRET. Generala con `openssl rand -base64 32`.",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `GOOGLE_TOKEN_SECRET deve essere di 32 byte in base64, ricevuti ${key.length}. Rigenerala con \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** Cifra un token. Ogni chiamata usa un IV nuovo, quindi l'esito cambia sempre. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join("|");
}

/**
 * Decifra un token. Solleva se il dato è stato alterato, se la chiave è
 * cambiata o se il formato non è quello atteso: in tutti e tre i casi la cosa
 * giusta da fare è chiedere all'utente di ricollegare l'account, non tirare
 * avanti con un valore inventato.
 */
export function decryptToken(payload: string): string {
  const parts = payload.split("|");
  if (parts.length !== 3) {
    throw new Error("Token cifrato in un formato non riconosciuto.");
  }

  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const ciphertext = Buffer.from(dataPart, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Token cifrato con un vettore di inizializzazione errato.");
  }

  const decipher = createDecipheriv(ALGORITHM, secretKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** Come `decryptToken`, ma restituisce null invece di sollevare. */
export function tryDecryptToken(payload: string | null): string | null {
  if (!payload) return null;
  try {
    return decryptToken(payload);
  } catch {
    return null;
  }
}
