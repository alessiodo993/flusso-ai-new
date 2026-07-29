import { NextResponse, type NextRequest } from "next/server";

import { userIdFromChannelToken } from "@/lib/google/channel-token";
import { syncAllCalendars } from "@/lib/google/sync";

export const runtime = "nodejs";

/**
 * Notifiche push di Google Calendar.
 *
 * È l'unica rotta senza sessione: la chiama Google. L'autenticazione sta tutta
 * nel token del canale, verificato a tempo costante.
 */
export async function POST(request: NextRequest) {
  const state = request.headers.get("x-goog-resource-state");

  // Google manda un `sync` alla creazione del canale: è solo un saluto.
  if (state === "sync") return new NextResponse(null, { status: 204 });

  const userId = userIdFromChannelToken(
    request.headers.get("x-goog-channel-token"),
  );
  if (!userId) return new NextResponse(null, { status: 401 });

  try {
    await syncAllCalendars(userId);
  } catch {
    /*
     * Si risponde comunque 200. Google riprova le notifiche fallite con un
     * backoff crescente e, dopo troppi errori, chiude il canale: un problema
     * temporaneo non deve costarci la sottoscrizione. Il polling resta come
     * rete di sicurezza.
     */
  }

  return new NextResponse(null, { status: 200 });
}
