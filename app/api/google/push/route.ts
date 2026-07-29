import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { accessTokenFor } from "@/lib/google/accounts";
import {
  deleteEvent,
  findEventByTaskId,
  insertEvent,
  patchEvent,
  type EventDraft,
} from "@/lib/google/api";
import { toGoogleColorId } from "@/lib/colors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";
import { TZ, romeInstant } from "@/lib/time";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ taskId: z.string() });

/**
 * Sincronizzazione in uscita: riflette un task pianificato sul calendario di
 * destinazione.
 *
 * È **idempotente**: prima si cerca l'evento tramite
 * `extendedProperties.private.flussoTaskId`, e solo se non esiste lo si crea.
 * Fidarsi del solo `google_event_id` salvato non basterebbe — una scrittura
 * andata a metà lascerebbe l'evento su Google e nessun riferimento qui, e la
 * volta dopo si creerebbe un doppione.
 */
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("google_write_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings?.google_write_enabled) {
    return NextResponse.json({ saltato: "scrittura disattivata" });
  }

  const { data: calendar } = await supabase
    .from("google_calendars")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_write_target", true)
    .maybeSingle();

  if (!calendar) {
    return NextResponse.json({ saltato: "nessun calendario di destinazione" });
  }

  const { data: account } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("id", calendar.account_id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ saltato: "account non collegato" });
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", parsed.data.taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  try {
    const accessToken = await accessTokenFor(account);
    const existing = await findEventByTaskId({
      accessToken,
      calendarId: calendar.google_calendar_id,
      taskId: parsed.data.taskId,
    });

    // Task sparito o tolto dal calendario: l'evento non ha più ragione di
    // esistere. Cancellarlo è parte della sincronizzazione, non un extra.
    const stillScheduled =
      task && task.day && task.start_minute !== null && task.est_minutes !== null;

    if (!stillScheduled) {
      if (existing?.id) {
        await deleteEvent({
          accessToken,
          calendarId: calendar.google_calendar_id,
          eventId: existing.id,
        });
      }
      if (task) {
        await supabase
          .from("tasks")
          .update({ google_event_id: null })
          .eq("id", task.id);
      }
      return NextResponse.json({ azione: "cancellato" });
    }

    const { data: project } = task.project_id
      ? await supabase
          .from("projects")
          .select("color")
          .eq("id", task.project_id)
          .maybeSingle()
      : { data: null };

    const start = romeInstant(task.day as string, task.start_minute as number);
    const end = romeInstant(
      task.day as string,
      (task.start_minute as number) + (task.est_minutes as number),
    );

    const draft: EventDraft = {
      // Il segno di spunta rende leggibile lo stato anche da Google.
      summary: task.status === "done" ? `✓ ${task.title}` : task.title,
      description: [task.notes, `${appUrl()}/app?task=${task.id}`]
        .filter(Boolean)
        .join("\n\n"),
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      colorId: toGoogleColorId(project?.color ?? "#3f6b4f"),
      extendedProperties: { private: { flussoTaskId: task.id } },
    };

    const saved = existing?.id
      ? await patchEvent({
          accessToken,
          calendarId: calendar.google_calendar_id,
          eventId: existing.id,
          event: draft,
        })
      : await insertEvent({
          accessToken,
          calendarId: calendar.google_calendar_id,
          event: draft,
        });

    await supabase
      .from("tasks")
      .update({ google_event_id: saved.id ?? null })
      .eq("id", task.id);

    return NextResponse.json({
      azione: existing ? "aggiornato" : "creato",
      eventId: saved.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        errore:
          error instanceof Error ? error.message : "Scrittura non riuscita.",
      },
      { status: 502 },
    );
  }
}
