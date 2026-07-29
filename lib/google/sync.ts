import "server-only";

import {
  SyncTokenExpiredError,
  UnauthorizedError,
  listEvents,
} from "@/lib/google/api";
import { accessTokenFor, markNeedsReconnect } from "@/lib/google/accounts";
import { ensureChannel } from "@/lib/google/channels";
import { isCancelled, toEventRows } from "@/lib/google/events";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { addDaysISO, romeInstant, todayISO } from "@/lib/time";

/**
 * Sincronizzazione in entrata.
 *
 * Incrementale grazie al `syncToken`: dopo la prima volta Google manda solo
 * ciò che è cambiato. Quando quel token non è più valido — succede, Google li
 * fa scadere — risponde `410 Gone`, e l'unica risposta corretta è **rifare una
 * sincronizzazione completa** e ripartire con un token nuovo.
 */

type Calendar = Tables<"google_calendars">;
type Account = Tables<"google_accounts">;

/** Finestra della sincronizzazione completa: un mese indietro, tre avanti. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 90;

export type SyncResult = {
  calendarId: string;
  name: string;
  upserted: number;
  removed: number;
  fullSync: boolean;
  error?: string;
};

export async function syncCalendar({
  account,
  calendar,
}: {
  account: Account;
  calendar: Calendar;
}): Promise<SyncResult> {
  const base: SyncResult = {
    calendarId: calendar.id,
    name: calendar.name,
    upserted: 0,
    removed: 0,
    fullSync: !calendar.sync_token,
  };

  let accessToken: string;
  try {
    accessToken = await accessTokenFor(account);
  } catch (error) {
    return { ...base, error: messageOf(error) };
  }

  // Le notifiche push sono un di più: si tenta di aprirle, e se non si
  // aprono la sincronizzazione prosegue lo stesso.
  await ensureChannel({ accessToken, calendar, userId: account.user_id });

  try {
    return await runSync({ accessToken, account, calendar, base });
  } catch (error) {
    if (error instanceof SyncTokenExpiredError) {
      // Token invalidato: si ricomincia da capo, senza il token.
      await supabaseAdmin()
        .from("google_calendars")
        .update({ sync_token: null })
        .eq("id", calendar.id);

      return runSync({
        accessToken,
        account,
        calendar: { ...calendar, sync_token: null },
        base: { ...base, fullSync: true },
      });
    }

    if (error instanceof UnauthorizedError) {
      await markNeedsReconnect(account.id);
      return { ...base, error: `Riconnetti ${account.email}.` };
    }

    return { ...base, error: messageOf(error) };
  }
}

async function runSync({
  accessToken,
  account,
  calendar,
  base,
}: {
  accessToken: string;
  account: Account;
  calendar: Calendar;
  base: SyncResult;
}): Promise<SyncResult> {
  const supabase = supabaseAdmin();
  const today = todayISO();

  let pageToken: string | undefined;
  let syncToken: string | undefined;
  let upserted = 0;
  let removed = 0;

  do {
    const page = await listEvents({
      accessToken,
      calendarId: calendar.google_calendar_id,
      syncToken: calendar.sync_token,
      timeMin: calendar.sync_token
        ? undefined
        : romeInstant(addDaysISO(today, -PAST_DAYS), 0).toISOString(),
      timeMax: calendar.sync_token
        ? undefined
        : romeInstant(addDaysISO(today, FUTURE_DAYS), 0).toISOString(),
      pageToken,
    });

    const items = page.items ?? [];

    // Ogni evento che arriva sostituisce per intero le sue righe precedenti:
    // se si è accorciato, le righe dei giorni che non copre più devono sparire.
    const touchedIds = items.map((event) => event.id).filter(Boolean) as string[];

    if (touchedIds.length > 0) {
      const { count } = await supabase
        .from("google_events")
        .delete({ count: "exact" })
        .eq("user_id", account.user_id)
        .eq("calendar_id", calendar.id)
        .in("google_event_id", touchedIds);
      removed += count ?? 0;
    }

    const rows = items
      .filter((event) => !isCancelled(event))
      .flatMap((event) =>
        toEventRows(event).map((row) => ({
          ...row,
          user_id: account.user_id,
          calendar_id: calendar.id,
        })),
      );

    if (rows.length > 0) {
      const { error } = await supabase.from("google_events").insert(rows);
      if (error) throw error;
      upserted += rows.length;
      // Le righe reinserite non contano come rimosse.
      removed = Math.max(0, removed - rows.length);
    }

    pageToken = page.nextPageToken;
    syncToken = page.nextSyncToken ?? syncToken;
  } while (pageToken);

  await supabase
    .from("google_calendars")
    .update({
      sync_token: syncToken ?? calendar.sync_token,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", calendar.id);

  return { ...base, upserted, removed };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Errore sconosciuto.";
}

/** Sincronizza tutti i calendari abilitati di un utente. */
export async function syncAllCalendars(userId: string): Promise<SyncResult[]> {
  const supabase = supabaseAdmin();

  const { data: calendars, error } = await supabase
    .from("google_calendars")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error) throw error;
  if (!calendars || calendars.length === 0) return [];

  const { data: accounts } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("user_id", userId);

  const byId = new Map((accounts ?? []).map((account) => [account.id, account]));
  const results: SyncResult[] = [];

  // In sequenza e non in parallelo: Google limita per utente, e sei calendari
  // lanciati insieme si prendono un 403 a testa invece di sincronizzarsi.
  for (const calendar of calendars) {
    const account = byId.get(calendar.account_id);
    if (!account) continue;
    results.push(await syncCalendar({ account, calendar }));
  }

  return results;
}
