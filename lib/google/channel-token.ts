import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Il token che accompagna un canale di notifiche Google.
 *
 * La rotta del webhook è l'unica senza sessione — la chiama Google, non il
 * browser — quindi l'autenticazione è tutta qui: alla creazione del canale si
 * registra un valore firmato, e a ogni notifica si verifica che sia quello.
 * Senza, chiunque conoscesse l'indirizzo potrebbe far partire
 * sincronizzazioni a raffica per conto di un utente qualsiasi.
 *
 * Sta in `lib` e non nella rotta perché i file di route possono esportare solo
 * i nomi previsti da Next: qualunque altro export fa fallire il build.
 */

function signature(userId: string): string {
  const secret = process.env.GOOGLE_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Variabile d'ambiente mancante: GOOGLE_TOKEN_SECRET.");
  }
  return createHmac("sha256", Buffer.from(secret, "base64"))
    .update(userId)
    .digest("base64url");
}

/** `<userId>.<firma>`, da passare a Google all'apertura del canale. */
export function channelTokenFor(userId: string): string {
  return `${userId}.${signature(userId)}`;
}

/** L'utente a cui appartiene il canale, o null se il token non è autentico. */
export function userIdFromChannelToken(token: string | null): string | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = token.slice(0, separator);

  let expected: string;
  try {
    expected = signature(userId);
  } catch {
    return null;
  }

  const provided = Buffer.from(token.slice(separator + 1), "utf8");
  const wanted = Buffer.from(expected, "utf8");

  // Confronto a tempo costante: un `===` lascerebbe indovinare la firma
  // carattere per carattere misurando i tempi di risposta.
  if (provided.length !== wanted.length) return null;
  return timingSafeEqual(provided, wanted) ? userId : null;
}
