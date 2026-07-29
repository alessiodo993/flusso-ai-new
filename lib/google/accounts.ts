import "server-only";

import { encryptToken, tryDecryptToken } from "@/lib/google/crypto";
import {
  InvalidGrantError,
  refreshAccessToken,
  type TokenResponse,
} from "@/lib/google/oauth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Gli account Google collegati e i loro token.
 *
 * Tutto qui dentro passa da `service_role`, perché `google_accounts` non ha
 * alcun permesso per `authenticated`: i token non devono essere leggibili
 * nemmeno dal loro proprietario.
 */

type Account = Tables<"google_accounts">;

/** Margine di sicurezza: si rinnova un minuto prima della scadenza vera. */
const REFRESH_MARGIN_MS = 60_000;

export class NeedsReconnectError extends Error {
  constructor(public email: string) {
    super(`L'account ${email} va ricollegato.`);
    this.name = "NeedsReconnectError";
  }
}

/** Crea o aggiorna un account dopo il consenso. */
export async function upsertAccount({
  userId,
  email,
  tokens,
}: {
  userId: string;
  email: string;
  tokens: TokenResponse;
}): Promise<Account> {
  const supabase = supabaseAdmin();

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString();

  /*
   * Google non rimanda il refresh token se il consenso è già stato dato.
   * In quel caso teniamo quello che abbiamo: sovrascriverlo con `null`
   * significherebbe perdere per sempre la possibilità di rinnovare.
   */
  const patch: Record<string, unknown> = {
    user_id: userId,
    email,
    access_token_ciphertext: encryptToken(tokens.access_token),
    token_expires_at: expiresAt,
    scopes: tokens.scope.split(" ").filter(Boolean),
    needs_reconnect: false,
  };

  if (tokens.refresh_token) {
    patch.refresh_token_ciphertext = encryptToken(tokens.refresh_token);
  }

  const { data, error } = await supabase
    .from("google_accounts")
    .upsert(patch as never, { onConflict: "user_id,email" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Gli account di un utente, token esclusi dal ragionamento del chiamante. */
export async function listAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabaseAdmin()
    .from("google_accounts")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

export async function markNeedsReconnect(accountId: string): Promise<void> {
  await supabaseAdmin()
    .from("google_accounts")
    .update({ needs_reconnect: true })
    .eq("id", accountId);
}

/**
 * Un access token valido, rinnovandolo se serve.
 *
 * Il rinnovo è trasparente per il chiamante: si occupa da sé di salvare il
 * token nuovo, così due sincronizzazioni ravvicinate non ne bruciano due.
 */
export async function accessTokenFor(account: Account): Promise<string> {
  if (account.needs_reconnect) throw new NeedsReconnectError(account.email);

  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;

  const current = tryDecryptToken(account.access_token_ciphertext);
  if (current && expiresAt - REFRESH_MARGIN_MS > Date.now()) return current;

  const refreshToken = tryDecryptToken(account.refresh_token_ciphertext);
  if (!refreshToken) {
    // Senza refresh token non c'è modo di andare avanti da soli.
    await markNeedsReconnect(account.id);
    throw new NeedsReconnectError(account.email);
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);

    await supabaseAdmin()
      .from("google_accounts")
      .update({
        access_token_ciphertext: encryptToken(tokens.access_token),
        token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000,
        ).toISOString(),
        needs_reconnect: false,
      })
      .eq("id", account.id);

    return tokens.access_token;
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      await markNeedsReconnect(account.id);
      throw new NeedsReconnectError(account.email);
    }
    throw error;
  }
}

/** L'account che possiede un calendario, con i token pronti all'uso. */
export async function accountOfCalendar(
  userId: string,
  accountId: string,
): Promise<Account | null> {
  const { data, error } = await supabaseAdmin()
    .from("google_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
