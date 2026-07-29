import "server-only";

import type { GoogleEventResource } from "@/lib/google/events";

/**
 * Il minimo indispensabile della Google Calendar API, scritto a mano invece di
 * portarsi dietro `googleapis`: quel pacchetto pesa decine di megabyte per
 * quattro chiamate, e su una funzione serverless il peso è tempo di avvio.
 */

const BASE = "https://www.googleapis.com/calendar/v3";

/** Il token è scaduto o revocato: chi chiama deve rinnovarlo. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Token Google non valido.");
    this.name = "UnauthorizedError";
  }
}

/** Il `syncToken` non è più utilizzabile: serve una sincronizzazione completa. */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super("Il token di sincronizzazione è scaduto.");
    this.name = "SyncTokenExpiredError";
  }
}

/** Google sta limitando le richieste: si riprova più tardi, non subito. */
export class RateLimitedError extends Error {
  constructor(public retryAfterMs: number) {
    super("Google sta limitando le richieste.");
    this.name = "RateLimitedError";
  }
}

async function call<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (response.status === 401) throw new UnauthorizedError();
  if (response.status === 410) throw new SyncTokenExpiredError();

  if (response.status === 403 || response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new RateLimitedError(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Google API ${path} ha risposto ${response.status}: ${await response.text()}`,
    );
  }

  // Le cancellazioni rispondono 204 senza corpo.
  if (response.status === 204) return undefined as T;
  return response.json();
}

// ---------------------------------------------------------------------------
// Calendari
// ---------------------------------------------------------------------------

export type CalendarListEntry = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  colorId?: string;
  accessRole?: string;
  primary?: boolean;
  selected?: boolean;
};

export async function listCalendars(
  accessToken: string,
): Promise<CalendarListEntry[]> {
  const data = await call<{ items?: CalendarListEntry[] }>(
    "/users/me/calendarList?minAccessRole=reader",
    accessToken,
  );
  return data.items ?? [];
}

/** Vero se su quel calendario si possono anche scrivere eventi. */
export function canWriteTo(calendar: CalendarListEntry): boolean {
  return calendar.accessRole === "owner" || calendar.accessRole === "writer";
}

// ---------------------------------------------------------------------------
// Eventi in entrata
// ---------------------------------------------------------------------------

export type EventsPage = {
  items?: GoogleEventResource[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

/**
 * Una pagina di eventi.
 *
 * Con un `syncToken` Google restituisce **solo ciò che è cambiato** e vieta di
 * passare `timeMin`/`timeMax`: sono parametri mutuamente esclusivi, e
 * mandarli insieme fa fallire la chiamata.
 */
export async function listEvents({
  accessToken,
  calendarId,
  syncToken,
  timeMin,
  timeMax,
  pageToken,
}: {
  accessToken: string;
  calendarId: string;
  syncToken?: string | null;
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
}): Promise<EventsPage> {
  const params = new URLSearchParams({
    singleEvents: "true",
    maxResults: "250",
    showDeleted: "true",
  });

  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    // `orderBy` è ammesso solo nella sincronizzazione completa.
    params.set("orderBy", "startTime");
    if (timeMin) params.set("timeMin", timeMin);
    if (timeMax) params.set("timeMax", timeMax);
  }

  if (pageToken) params.set("pageToken", pageToken);

  return call<EventsPage>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    accessToken,
  );
}

// ---------------------------------------------------------------------------
// Eventi in uscita
// ---------------------------------------------------------------------------

export type EventDraft = {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  extendedProperties?: { private?: Record<string, string> };
};

/**
 * Cerca l'evento già creato per un task.
 *
 * È il meccanismo che rende la scrittura idempotente: prima si cerca per
 * `flussoTaskId`, poi eventualmente si crea. Senza questa ricerca, due
 * sincronizzazioni in parallelo — o un `google_event_id` perso — produrrebbero
 * doppioni sul calendario dell'utente, che è il tipo di danno che nessuno
 * perdona a un'app di produttività.
 */
export async function findEventByTaskId({
  accessToken,
  calendarId,
  taskId,
}: {
  accessToken: string;
  calendarId: string;
  taskId: string;
}): Promise<GoogleEventResource | null> {
  const params = new URLSearchParams({
    privateExtendedProperty: `flussoTaskId=${taskId}`,
    showDeleted: "false",
    maxResults: "1",
  });

  const data = await call<{ items?: GoogleEventResource[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    accessToken,
  );
  return data.items?.[0] ?? null;
}

export async function insertEvent({
  accessToken,
  calendarId,
  event,
}: {
  accessToken: string;
  calendarId: string;
  event: EventDraft;
}): Promise<GoogleEventResource> {
  return call<GoogleEventResource>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    accessToken,
    { method: "POST", body: JSON.stringify(event) },
  );
}

export async function patchEvent({
  accessToken,
  calendarId,
  eventId,
  event,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  event: Partial<EventDraft>;
}): Promise<GoogleEventResource> {
  return call<GoogleEventResource>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify(event) },
  );
}

export async function deleteEvent({
  accessToken,
  calendarId,
  eventId,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  try {
    await call<void>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      accessToken,
      { method: "DELETE" },
    );
  } catch (error) {
    // Un evento già sparito è il risultato che volevamo.
    if (error instanceof Error && error.message.includes("410")) return;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Notifiche push
// ---------------------------------------------------------------------------

export type WatchResponse = {
  id: string;
  resourceId: string;
  expiration?: string;
};

/** Apre un canale di notifica su un calendario. */
export async function watchCalendar({
  accessToken,
  calendarId,
  channelId,
  callbackUrl,
  token,
}: {
  accessToken: string;
  calendarId: string;
  channelId: string;
  callbackUrl: string;
  token: string;
}): Promise<WatchResponse> {
  return call<WatchResponse>(
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: callbackUrl,
        // Torna indietro nell'intestazione X-Goog-Channel-Token: è così che
        // si riconosce una notifica autentica da una inventata.
        token,
      }),
    },
  );
}
