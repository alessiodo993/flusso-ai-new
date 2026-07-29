import { DAY_MINUTES, addDaysISO, toRomeDay, toRomeMinute } from "@/lib/time";
import type { DayISO } from "@/lib/time";

/**
 * Conversione degli eventi Google nel modello di Flusso.
 *
 * Google descrive un evento con due istanti; Flusso ragiona in giorni romani e
 * minuti dalla mezzanotte. La traduzione è il punto in cui si perdono le cose:
 * un evento che attraversa la mezzanotte, un *all day* che dura tre giorni,
 * un fuso diverso dal nostro. Per questo sta qui, isolata e con dei test, e
 * non sparsa dentro la sincronizzazione.
 */

/** La forma minima di un evento Google che ci interessa. */
export type GoogleEventResource = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/** Una riga della cache locale: un evento occupa una riga per giorno coperto. */
export type EventRow = {
  google_event_id: string;
  title: string;
  day: DayISO;
  start_minute: number;
  end_minute: number;
  all_day: boolean;
};

/** L'id del task di Flusso che ha generato l'evento, se c'è. */
export function flussoTaskIdOf(
  event: GoogleEventResource,
): string | null {
  return event.extendedProperties?.private?.flussoTaskId ?? null;
}

export function isCancelled(event: GoogleEventResource): boolean {
  return event.status === "cancelled";
}

/**
 * Trasforma un evento in una riga per ciascun giorno che copre.
 *
 * Una riga per giorno, e non una sola con la data d'inizio, perché il planner
 * deve trovare l'ostacolo **su ogni giorno** che l'evento occupa: altrimenti
 * pianificherebbe sopra il secondo giorno di una trasferta.
 */
export function toEventRows(event: GoogleEventResource): EventRow[] {
  const id = event.id;
  if (!id || isCancelled(event)) return [];

  const title = event.summary?.trim() || "(senza titolo)";

  // --- All day: Google indica le date, con la fine esclusa. -----------------
  if (event.start?.date) {
    const first = event.start.date;
    // Senza `end`, un all day dura un giorno.
    const endExclusive = event.end?.date ?? addDaysISO(first, 1);

    const rows: EventRow[] = [];
    for (
      let day = first;
      day < endExclusive;
      day = addDaysISO(day, 1)
    ) {
      rows.push({
        google_event_id: id,
        title,
        day,
        start_minute: 0,
        end_minute: DAY_MINUTES,
        all_day: true,
      });
      // Una data di fine malformata renderebbe il ciclo infinito.
      if (rows.length > 366) break;
    }
    return rows;
  }

  // --- Con orario: due istanti, da leggere nel fuso di Roma. ---------------
  const startAt = event.start?.dateTime;
  if (!startAt) return [];
  const endAt = event.end?.dateTime ?? startAt;

  const startDay = toRomeDay(startAt);
  const startMinute = toRomeMinute(startAt);
  const endDay = toRomeDay(endAt);
  const endMinute = toRomeMinute(endAt);

  if (startDay === endDay) {
    // Un evento di durata nulla occuperebbe zero pixel: gli si dà un quarto
    // d'ora, così resta visibile e resta un ostacolo.
    const end = endMinute > startMinute ? endMinute : startMinute + 15;
    return [
      {
        google_event_id: id,
        title,
        day: startDay,
        start_minute: startMinute,
        end_minute: Math.min(end, DAY_MINUTES),
        all_day: false,
      },
    ];
  }

  const rows: EventRow[] = [
    {
      google_event_id: id,
      title,
      day: startDay,
      start_minute: startMinute,
      end_minute: DAY_MINUTES,
      all_day: false,
    },
  ];

  for (
    let day = addDaysISO(startDay, 1);
    day < endDay;
    day = addDaysISO(day, 1)
  ) {
    rows.push({
      google_event_id: id,
      title,
      day,
      start_minute: 0,
      end_minute: DAY_MINUTES,
      all_day: false,
    });
    if (rows.length > 366) break;
  }

  // Un evento che finisce a mezzanotte in punto non tocca il giorno dopo.
  if (endMinute > 0) {
    rows.push({
      google_event_id: id,
      title,
      day: endDay,
      start_minute: 0,
      end_minute: endMinute,
      all_day: false,
    });
  }

  return rows;
}

/**
 * Gli eventi che il planner deve considerare invalicabili.
 *
 * Gli *all day* restano fuori di proposito: «compleanno di Marta» non è un
 * motivo per non pianificare niente per un giorno intero. Vanno resi in una
 * striscia a parte, non come un ostacolo alto quanto la giornata.
 */
export function asObstacles(
  rows: Array<{ start_minute: number; end_minute: number; all_day: boolean }>,
): Array<{ start: number; end: number }> {
  return rows
    .filter((row) => !row.all_day)
    .map((row) => ({ start: row.start_minute, end: row.end_minute }));
}
