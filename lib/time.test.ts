import { describe, expect, it } from "vitest";

import {
  addDaysISO,
  clampMinute,
  contains,
  deadlineTone,
  diffDaysISO,
  dowOf,
  fmtDayShort,
  fmtDuration,
  fmtMin,
  fmtRange,
  fmtRelativeDay,
  freeGaps,
  isDayISO,
  nextDaysISO,
  overlapMinutes,
  overlaps,
  parseHHMM,
  quarterOf,
  romeInstant,
  snap,
  snapDown,
  startOfWeekISO,
  toRomeDay,
  toRomeMinute,
  toRomeSlot,
  weekDaysISO,
} from "./time";

describe("fmtMin", () => {
  it("formatta i minuti come orario", () => {
    expect(fmtMin(0)).toBe("00:00");
    expect(fmtMin(480)).toBe("08:00");
    expect(fmtMin(545)).toBe("09:05");
    expect(fmtMin(1439)).toBe("23:59");
  });

  it("mostra la fine giornata come 24:00 invece di tornare a zero", () => {
    expect(fmtMin(1440)).toBe("24:00");
  });

  it("non produce orari negativi", () => {
    expect(fmtMin(-30)).toBe("00:00");
  });
});

describe("parseHHMM", () => {
  it("legge gli orari validi", () => {
    expect(parseHHMM("08:00")).toBe(480);
    expect(parseHHMM("9:05")).toBe(545);
    expect(parseHHMM(" 23:59 ")).toBe(1439);
    expect(parseHHMM("24:00")).toBe(1440);
  });

  it("rifiuta ciò che non è un orario", () => {
    expect(parseHHMM("")).toBeNull();
    expect(parseHHMM("8")).toBeNull();
    expect(parseHHMM("08:60")).toBeNull();
    expect(parseHHMM("25:00")).toBeNull();
    expect(parseHHMM("24:30")).toBeNull();
  });

  it("è l'inverso di fmtMin", () => {
    for (const minute of [0, 15, 480, 733, 1439]) {
      expect(parseHHMM(fmtMin(minute))).toBe(minute);
    }
  });
});

describe("snap", () => {
  it("arrotonda allo slot più vicino", () => {
    expect(snap(487)).toBe(480);
    expect(snap(488)).toBe(495);
    expect(snap(480)).toBe(480);
  });

  it("accetta passi diversi", () => {
    expect(snap(70, 30)).toBe(60);
    expect(snap(76, 30)).toBe(90);
    expect(snap(100, 60)).toBe(120);
  });

  it("ripiega sullo slot standard se il passo non è valido", () => {
    expect(snap(487, 0)).toBe(480);
  });

  it("snapDown non supera mai il valore di partenza", () => {
    expect(snapDown(499)).toBe(495);
    expect(snapDown(495)).toBe(495);
    expect(snapDown(494)).toBe(480);
  });
});

describe("clampMinute", () => {
  it("tiene i minuti dentro la giornata", () => {
    expect(clampMinute(-5)).toBe(0);
    expect(clampMinute(2000)).toBe(1439);
    expect(clampMinute(600)).toBe(600);
  });

  it("regge valori non numerici", () => {
    expect(clampMinute(Number.NaN)).toBe(0);
  });
});

describe("overlaps", () => {
  const block = { start: 540, end: 600 };

  it("riconosce la sovrapposizione", () => {
    expect(overlaps(block, { start: 570, end: 630 })).toBe(true);
    expect(overlaps(block, { start: 510, end: 550 })).toBe(true);
    expect(overlaps(block, { start: 550, end: 560 })).toBe(true);
  });

  it("considera liberi gli estremi che si toccano", () => {
    expect(overlaps(block, { start: 600, end: 660 })).toBe(false);
    expect(overlaps(block, { start: 480, end: 540 })).toBe(false);
  });

  it("è simmetrica", () => {
    const other = { start: 570, end: 630 };
    expect(overlaps(block, other)).toBe(overlaps(other, block));
  });

  it("misura i minuti in comune", () => {
    expect(overlapMinutes(block, { start: 570, end: 630 })).toBe(30);
    expect(overlapMinutes(block, { start: 700, end: 800 })).toBe(0);
  });

  it("riconosce il contenimento", () => {
    expect(contains(block, { start: 550, end: 590 })).toBe(true);
    expect(contains(block, { start: 550, end: 610 })).toBe(false);
  });
});

describe("freeGaps", () => {
  const workday = { start: 480, end: 1200 };

  it("restituisce tutta la finestra se non c'è nulla", () => {
    expect(freeGaps(workday, [])).toEqual([workday]);
  });

  it("ritaglia i buchi fra gli impegni", () => {
    expect(
      freeGaps(workday, [
        { start: 540, end: 600 },
        { start: 720, end: 780 },
      ]),
    ).toEqual([
      { start: 480, end: 540 },
      { start: 600, end: 720 },
      { start: 780, end: 1200 },
    ]);
  });

  it("fonde gli impegni sovrapposti invece di contarli due volte", () => {
    expect(
      freeGaps(workday, [
        { start: 540, end: 660 },
        { start: 600, end: 720 },
      ]),
    ).toEqual([
      { start: 480, end: 540 },
      { start: 720, end: 1200 },
    ]);
  });

  it("non si fa confondere dall'ordine di arrivo", () => {
    expect(
      freeGaps(workday, [
        { start: 720, end: 780 },
        { start: 540, end: 600 },
      ]),
    ).toEqual([
      { start: 480, end: 540 },
      { start: 600, end: 720 },
      { start: 780, end: 1200 },
    ]);
  });

  it("ignora ciò che cade fuori dalla finestra", () => {
    expect(freeGaps(workday, [{ start: 60, end: 300 }])).toEqual([workday]);
  });

  it("restituisce nulla se la finestra è interamente occupata", () => {
    expect(freeGaps(workday, [{ start: 400, end: 1300 }])).toEqual([]);
  });
});

describe("giorni", () => {
  it("valida il formato", () => {
    expect(isDayISO("2026-07-29")).toBe(true);
    expect(isDayISO("2026-7-29")).toBe(false);
    expect(isDayISO("2026-02-30")).toBe(false);
    expect(isDayISO(20260729)).toBe(false);
  });

  it("somma e sottrae giorni attraverso i mesi", () => {
    expect(addDaysISO("2026-07-29", 3)).toBe("2026-08-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("attraversa il cambio di ora legale senza slittare", () => {
    // In Italia l'ora legale finisce il 25 ottobre 2026.
    expect(addDaysISO("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDaysISO("2026-10-25", 1)).toBe("2026-10-26");
    expect(diffDaysISO("2026-10-24", "2026-10-26")).toBe(2);
    // E inizia il 29 marzo 2026.
    expect(addDaysISO("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("misura la distanza con il segno", () => {
    expect(diffDaysISO("2026-07-29", "2026-07-31")).toBe(2);
    expect(diffDaysISO("2026-07-29", "2026-07-28")).toBe(-1);
    expect(diffDaysISO("2026-07-29", "2026-07-29")).toBe(0);
  });

  it("conosce il giorno della settimana", () => {
    expect(dowOf("2026-07-29")).toBe(3); // mercoledì
    expect(dowOf("2026-08-02")).toBe(0); // domenica
  });

  it("la settimana comincia di lunedì", () => {
    expect(startOfWeekISO("2026-07-29")).toBe("2026-07-27");
    expect(startOfWeekISO("2026-07-27")).toBe("2026-07-27");
    // La domenica appartiene alla settimana che l'ha preceduta.
    expect(startOfWeekISO("2026-08-02")).toBe("2026-07-27");
  });

  it("elenca sette giorni da lunedì a domenica", () => {
    const week = weekDaysISO("2026-07-29");
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-07-27");
    expect(week[6]).toBe("2026-08-02");
  });

  it("elenca i giorni successivi a partire da oggi incluso", () => {
    expect(nextDaysISO("2026-07-30", 3)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
    expect(nextDaysISO("2026-07-30", 0)).toEqual([]);
  });

  it("calcola il trimestre", () => {
    expect(quarterOf("2026-01-15")).toBe("2026-Q1");
    expect(quarterOf("2026-03-31")).toBe("2026-Q1");
    expect(quarterOf("2026-04-01")).toBe("2026-Q2");
    expect(quarterOf("2026-07-29")).toBe("2026-Q3");
    expect(quarterOf("2026-12-31")).toBe("2026-Q4");
  });
});

describe("fuso di Roma", () => {
  it("converte un istante nel giorno e nel minuto romani, in ora legale", () => {
    // 29 luglio 2026, 08:30 UTC → 10:30 a Roma (CEST, +02:00).
    const slot = toRomeSlot("2026-07-29T08:30:00Z");
    expect(slot.day).toBe("2026-07-29");
    expect(slot.minute).toBe(630);
  });

  it("converte un istante in ora solare", () => {
    // 15 gennaio 2026, 08:30 UTC → 09:30 a Roma (CET, +01:00).
    expect(toRomeMinute("2026-01-15T08:30:00Z")).toBe(570);
  });

  it("assegna al giorno romano gli istanti a cavallo della mezzanotte", () => {
    // 23:30 UTC d'estate è già l'1:30 del giorno dopo a Roma.
    expect(toRomeDay("2026-07-29T23:30:00Z")).toBe("2026-07-30");
    expect(toRomeMinute("2026-07-29T23:30:00Z")).toBe(90);
  });

  it("costruisce l'istante UTC di un orario romano", () => {
    expect(romeInstant("2026-07-29", 630).toISOString()).toBe(
      "2026-07-29T08:30:00.000Z",
    );
    expect(romeInstant("2026-01-15", 570).toISOString()).toBe(
      "2026-01-15T08:30:00.000Z",
    );
  });

  it("è l'inverso di toRomeSlot", () => {
    for (const [day, minute] of [
      ["2026-07-29", 630],
      ["2026-01-15", 0],
      ["2026-11-03", 1215],
    ] as const) {
      const slot = toRomeSlot(romeInstant(day, minute));
      expect(slot).toEqual({ day, minute });
    }
  });
});

describe("formattazione italiana", () => {
  it("scrive le durate in modo compatto", () => {
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(45)).toBe("45m");
    expect(fmtDuration(60)).toBe("1h");
    expect(fmtDuration(80)).toBe("1h 20m");
    expect(fmtDuration(200)).toBe("3h 20m");
  });

  it("scrive l'intervallo di un blocco", () => {
    expect(fmtRange({ start: 540, end: 630 })).toBe("09:00–10:30");
  });

  it("scrive la data compatta in italiano", () => {
    // 29 luglio 2026 è un mercoledì.
    expect(fmtDayShort("2026-07-29")).toBe("mer 29 lug");
  });

  it("dice le scadenze a voce", () => {
    const oggi = "2026-07-29";
    expect(fmtRelativeDay(oggi, oggi)).toBe("oggi");
    expect(fmtRelativeDay("2026-07-30", oggi)).toBe("domani");
    expect(fmtRelativeDay("2026-07-28", oggi)).toBe("ieri");
    expect(fmtRelativeDay("2026-07-31", oggi)).toBe("dopodomani");
    expect(fmtRelativeDay("2026-08-02", oggi)).toBe("fra 4 giorni");
    expect(fmtRelativeDay("2026-07-25", oggi)).toBe("4 giorni fa");
    // Oltre la settimana torna alla data.
    expect(fmtRelativeDay("2026-09-01", oggi)).toBe("mar 1 set");
  });
});

describe("deadlineTone", () => {
  const oggi = "2026-07-29";

  it("segna in rosso ciò che è scaduto o in giornata", () => {
    expect(deadlineTone("2026-07-20", oggi)).toBe("overdue");
    expect(deadlineTone(oggi, oggi)).toBe("overdue");
  });

  it("segna in ambra i due giorni successivi", () => {
    expect(deadlineTone("2026-07-30", oggi)).toBe("soon");
    expect(deadlineTone("2026-07-31", oggi)).toBe("soon");
  });

  it("lascia neutro tutto il resto", () => {
    expect(deadlineTone("2026-08-01", oggi)).toBe("later");
  });
});
