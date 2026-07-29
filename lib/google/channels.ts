import "server-only";

import { randomUUID } from "node:crypto";

import { appUrl } from "@/lib/env";
import { watchCalendar } from "@/lib/google/api";
import { channelTokenFor } from "@/lib/google/channel-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Canali di notifica push.
 *
 * Il polling ogni cinque minuti basta a non perdere nulla, ma fa aspettare
 * fino a cinque minuti: un evento spostato da un collega mentre stai
 * pianificando dovrebbe comparire subito. Questi canali servono a quello, e
 * restano un miglioramento — se non si aprono, l'app continua a funzionare.
 */

type Calendar = Tables<"google_calendars">;

/** Si rinnova con un giorno di anticipo, non allo scadere. */
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

/**
 * Apre o rinnova il canale di un calendario, se serve.
 *
 * Non solleva mai: un canale che non si apre è una notifica in meno, non una
 * sincronizzazione fallita, e non deve far apparire un errore all'utente.
 */
export async function ensureChannel({
  accessToken,
  calendar,
  userId,
}: {
  accessToken: string;
  calendar: Calendar;
  userId: string;
}): Promise<void> {
  /*
   * Google rifiuta gli indirizzi non HTTPS e quelli non raggiungibili da
   * internet: in sviluppo su localhost non c'è modo di riceverle, quindi
   * si resta sul polling senza nemmeno provarci.
   */
  const base = appUrl();
  if (!base.startsWith("https://")) return;

  const expiresAt = calendar.channel_expires_at
    ? new Date(calendar.channel_expires_at).getTime()
    : 0;

  if (calendar.channel_id && expiresAt - RENEW_BEFORE_MS > Date.now()) return;

  try {
    const channelId = randomUUID();
    const channel = await watchCalendar({
      accessToken,
      calendarId: calendar.google_calendar_id,
      channelId,
      callbackUrl: `${base}/api/public/google/webhook`,
      token: channelTokenFor(userId),
    });

    await supabaseAdmin()
      .from("google_calendars")
      .update({
        channel_id: channel.id ?? channelId,
        channel_resource_id: channel.resourceId ?? null,
        channel_expires_at: channel.expiration
          ? new Date(Number(channel.expiration)).toISOString()
          : null,
      })
      .eq("id", calendar.id);
  } catch {
    // Il canale non si è aperto: il polling continua a coprire il caso.
  }
}
