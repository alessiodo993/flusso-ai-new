import { describe, expect, it } from "vitest";

import {
  asObstacles,
  flussoTaskIdOf,
  isCancelled,
  toEventRows,
  type GoogleEventResource,
} from "./events";

function timed(start: string, end: string, rest: Partial<GoogleEventResource> = {}) {
  return {
    id: "evt",
    summary: "Riunione",
    start: { dateTime: start },
    end: { dateTime: end },
    ...rest,
  } satisfies GoogleEventResource;
}

describe("eventi con orario", () => {
  it("converte nel fuso di Roma, non in UTC", () => {
    // 08:30Z d'estate è 10:30 a Roma.
    expect(
      toEventRows(timed("2026-07-29T08:30:00Z", "2026-07-29T09:30:00Z")),
    ).toEqual([
      {
        google_event_id: "evt",
        title: "Riunione",
        day: "2026-07-29",
        start_minute: 630,
        end_minute: 690,
        all_day: false,
      },
    ]);
  });

  it("tiene conto dell'ora solare", () => {
    // A gennaio lo stesso istante è le 09:30.
    const [row] = toEventRows(
      timed("2026-01-15T08:30:00Z", "2026-01-15T09:30:00Z"),
    );
    expect(row.start_minute).toBe(570);
  });

  it("rispetta l'offset dichiarato nell'evento", () => {
    const [row] = toEventRows(
      timed("2026-07-29T10:30:00+02:00", "2026-07-29T11:00:00+02:00"),
    );
    expect(row.day).toBe("2026-07-29");
    expect(row.start_minute).toBe(630);
  });

  it("colloca nel giorno romano un evento serale UTC", () => {
    // 23:30Z d'estate è l'1:30 del giorno dopo a Roma.
    const [row] = toEventRows(
      timed("2026-07-29T23:30:00Z", "2026-07-30T00:30:00Z"),
    );
    expect(row.day).toBe("2026-07-30");
    expect(row.start_minute).toBe(90);
    expect(row.end_minute).toBe(150);
  });

  it("dà una durata minima a un evento istantaneo", () => {
    const [row] = toEventRows(
      timed("2026-07-29T08:30:00Z", "2026-07-29T08:30:00Z"),
    );
    expect(row.end_minute).toBeGreaterThan(row.start_minute);
  });

  it("usa un titolo di ripiego quando manca", () => {
    const [row] = toEventRows(
      timed("2026-07-29T08:30:00Z", "2026-07-29T09:00:00Z", { summary: "  " }),
    );
    expect(row.title).toBe("(senza titolo)");
  });
});

describe("eventi che attraversano la mezzanotte", () => {
  it("produce una riga per ciascun giorno coperto", () => {
    // Dalle 22:00 di mercoledì alle 02:00 di giovedì, ora di Roma.
    const rows = toEventRows(
      timed("2026-07-29T20:00:00Z", "2026-07-30T00:00:00Z"),
    );

    expect(rows).toEqual([
      {
        google_event_id: "evt",
        title: "Riunione",
        day: "2026-07-29",
        start_minute: 1320,
        end_minute: 1440,
        all_day: false,
      },
      {
        google_event_id: "evt",
        title: "Riunione",
        day: "2026-07-30",
        start_minute: 0,
        end_minute: 120,
        all_day: false,
      },
    ]);
  });

  it("riempie i giorni di mezzo di una trasferta", () => {
    const rows = toEventRows(
      timed("2026-07-29T08:00:00Z", "2026-08-01T08:00:00Z"),
    );
    expect(rows.map((row) => row.day)).toEqual([
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
    // I giorni interamente coperti occupano l'intera giornata.
    expect(rows[1]).toMatchObject({ start_minute: 0, end_minute: 1440 });
  });

  it("non tocca il giorno dopo se finisce a mezzanotte in punto", () => {
    // 22:00Z = mezzanotte a Roma: l'evento chiude esattamente sul confine.
    const rows = toEventRows(
      timed("2026-07-29T18:00:00Z", "2026-07-29T22:00:00Z"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: "2026-07-29", end_minute: 1440 });
  });
});

describe("eventi all day", () => {
  it("copre un giorno solo quando la fine è il giorno dopo", () => {
    expect(
      toEventRows({
        id: "ferie",
        summary: "Festa",
        start: { date: "2026-08-15" },
        end: { date: "2026-08-16" },
      }),
    ).toEqual([
      {
        google_event_id: "ferie",
        title: "Festa",
        day: "2026-08-15",
        start_minute: 0,
        end_minute: 1440,
        all_day: true,
      },
    ]);
  });

  it("tratta la data di fine come esclusa, secondo Google", () => {
    const rows = toEventRows({
      id: "ferie",
      summary: "Ferie",
      start: { date: "2026-08-10" },
      end: { date: "2026-08-13" },
    });
    expect(rows.map((row) => row.day)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
    expect(rows.every((row) => row.all_day)).toBe(true);
  });

  it("regge un all day senza data di fine", () => {
    const rows = toEventRows({
      id: "x",
      start: { date: "2026-08-10" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].day).toBe("2026-08-10");
  });
});

describe("eventi da scartare", () => {
  it("un evento annullato non produce righe", () => {
    const event = timed("2026-07-29T08:00:00Z", "2026-07-29T09:00:00Z", {
      status: "cancelled",
    });
    expect(isCancelled(event)).toBe(true);
    expect(toEventRows(event)).toEqual([]);
  });

  it("un evento senza id non produce righe", () => {
    expect(
      toEventRows({
        summary: "Anonimo",
        start: { dateTime: "2026-07-29T08:00:00Z" },
        end: { dateTime: "2026-07-29T09:00:00Z" },
      }),
    ).toEqual([]);
  });

  it("un evento senza inizio non produce righe", () => {
    expect(toEventRows({ id: "vuoto", summary: "Niente" })).toEqual([]);
  });
});

describe("proprietà di Flusso", () => {
  it("riconosce l'evento nato da un task", () => {
    expect(
      flussoTaskIdOf({
        id: "evt",
        extendedProperties: { private: { flussoTaskId: "task-1" } },
      }),
    ).toBe("task-1");
  });

  it("non inventa un id quando non c'è", () => {
    expect(flussoTaskIdOf({ id: "evt" })).toBeNull();
    expect(flussoTaskIdOf({ id: "evt", extendedProperties: {} })).toBeNull();
  });
});

describe("asObstacles", () => {
  it("tiene gli eventi con orario", () => {
    expect(
      asObstacles([
        { start_minute: 540, end_minute: 600, all_day: false },
      ]),
    ).toEqual([{ start: 540, end: 600 }]);
  });

  it("scarta gli all day: un compleanno non blocca la giornata", () => {
    expect(
      asObstacles([
        { start_minute: 0, end_minute: 1440, all_day: true },
        { start_minute: 540, end_minute: 600, all_day: false },
      ]),
    ).toEqual([{ start: 540, end: 600 }]);
  });
});
