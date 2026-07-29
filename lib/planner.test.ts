import { describe, expect, it } from "vitest";

import {
  availableGaps,
  planDays,
  planningDays,
  priorityOf,
  timeToMinutes,
  type DayContext,
  type PlannerSettings,
} from "./planner";
import type { Task } from "./types";

const TODAY = "2026-07-29";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    user_id: "u1",
    title: overrides.id,
    notes: "",
    status: "inbox",
    day: null,
    start_minute: null,
    est_minutes: 60,
    energy: null,
    project_id: null,
    deadline: null,
    subtasks: [],
    recur_id: null,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00Z",
    postpone_count: 0,
    last_postponed_at: null,
    actual_duration_minutes: null,
    is_daily_highlight: false,
    highlight_date: null,
    first_planned_at: null,
    status_review: "active",
    google_event_id: null,
    ...overrides,
  };
}

const SETTINGS: PlannerSettings = {
  workStart: 9 * 60,
  workEnd: 18 * 60,
  bufferMinutes: 15,
  dailyCapMinutes: 6 * 60,
  peakStart: 9 * 60,
  peakEnd: 12 * 60,
  lowStart: 15 * 60,
  lowEnd: 18 * 60,
};

function day(d: string, busy: DayContext["busy"] = [], used = 0): DayContext {
  return { day: d, busy, usedMinutes: used };
}

describe("timeToMinutes", () => {
  it("legge gli orari del database, secondi compresi", () => {
    expect(timeToMinutes("09:00:00")).toBe(540);
    expect(timeToMinutes("18:30")).toBe(1110);
    expect(timeToMinutes(null)).toBeNull();
  });
});

describe("priorityOf", () => {
  const options = { today: TODAY };

  it("mette l'highlight davanti a tutto", () => {
    const highlight = priorityOf(
      task({ id: "a", is_daily_highlight: true }),
      options,
    );
    const urgente = priorityOf(
      task({ id: "b", deadline: TODAY, postpone_count: 5 }),
      options,
    );
    expect(highlight).toBeGreaterThan(urgente);
  });

  it("pesa di più una scadenza vicina", () => {
    const domani = priorityOf(task({ id: "a", deadline: "2026-07-30" }), options);
    const fraDueSettimane = priorityOf(
      task({ id: "b", deadline: "2026-08-12" }),
      options,
    );
    expect(domani).toBeGreaterThan(fraDueSettimane);
  });

  it("non premia una scadenza lontanissima più di una assente", () => {
    // Oltre i quindici giorni il contributo si azzera: non diventa negativo.
    const lontana = priorityOf(task({ id: "a", deadline: "2027-01-01" }), options);
    expect(lontana).toBe(priorityOf(task({ id: "b" }), options));
  });

  it("spinge i progetti legati a un risultato chiave indietro", () => {
    const boosted = priorityOf(task({ id: "a", project_id: "p1" }), {
      ...options,
      boostedProjects: new Set(["p1"]),
    });
    expect(boosted).toBeGreaterThan(priorityOf(task({ id: "b" }), options));
  });

  it("fa pesare i rinvii, ma con un tetto", () => {
    const tre = priorityOf(task({ id: "a", postpone_count: 3 }), options);
    const venti = priorityOf(task({ id: "b", postpone_count: 20 }), options);
    expect(tre).toBeGreaterThan(priorityOf(task({ id: "c" }), options));
    expect(venti).toBe(tre + 80);
    expect(venti).toBe(200);
  });
});

describe("availableGaps", () => {
  const window = { start: 540, end: 1080 };

  it("allarga gli impegni del buffer da entrambi i lati", () => {
    const gaps = availableGaps(window, [{ start: 600, end: 660 }], 15);
    expect(gaps).toEqual([
      { start: 540, end: 585 },
      { start: 675, end: 1080 },
    ]);
  });

  it("non produce buchi vuoti o rovesciati", () => {
    // L'impegno tocca l'inizio della finestra: davanti non resta niente.
    const gaps = availableGaps(window, [{ start: 540, end: 660 }], 15);
    expect(gaps).toEqual([{ start: 675, end: 1080 }]);
  });

  it("senza impegni restituisce tutta la finestra", () => {
    expect(availableGaps(window, [], 15)).toEqual([window]);
  });
});

describe("planDays", () => {
  const base = {
    settings: SETTINGS,
    coefficient: null,
    today: TODAY,
  };

  it("colloca il primo task all'inizio della giornata libera", () => {
    const { placements, unplaced } = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 60 })],
      days: [day(TODAY)],
    });

    expect(unplaced).toEqual([]);
    expect(placements).toEqual([
      {
        taskId: "a",
        day: TODAY,
        startMinute: 540,
        estMinutes: 60,
        originalMinutes: 60,
        reason: "spazio disponibile",
      },
    ]);
  });

  it("lascia il buffer fra un blocco e il successivo", () => {
    const { placements } = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 60 }), task({ id: "b", est_minutes: 30 })],
      days: [day(TODAY)],
    });

    const [first, second] = placements;
    expect(first.startMinute).toBe(540);
    // 540 + 60 = 600, più 15 di buffer, arrotondato allo slot successivo.
    expect(second.startMinute).toBe(615);
    expect(second.startMinute - (first.startMinute + first.estMinutes)).toBe(
      SETTINGS.bufferMinutes,
    );
  });

  it("rispetta gli impegni già presenti", () => {
    const { placements } = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 60 })],
      days: [day(TODAY, [{ start: 540, end: 660 }])],
    });

    expect(placements[0].startMinute).toBe(675);
  });

  it("non esce mai dalla finestra di lavoro", () => {
    const { placements, unplaced } = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 120 })],
      // Libero solo dalle 17 in poi: due ore non ci stanno prima delle 18.
      days: [day(TODAY, [{ start: 540, end: 1005 }])],
    });

    expect(placements).toEqual([]);
    expect(unplaced).toEqual([
      {
        taskId: "a",
        reason: "Non c'è spazio nei giorni scelti senza sforare i tuoi limiti.",
      },
    ]);
  });

  it("non sfora il tetto giornaliero e passa al giorno dopo", () => {
    const domani = "2026-07-30";
    const { placements } = planDays({
      ...base,
      settings: { ...SETTINGS, dailyCapMinutes: 120 },
      tasks: [
        task({ id: "a", est_minutes: 90 }),
        task({ id: "b", est_minutes: 90 }),
      ],
      days: [day(TODAY), day(domani)],
    });

    expect(placements.map((p) => p.day)).toEqual([TODAY, domani]);
  });

  it("conta i minuti già pianificati contro il tetto", () => {
    const { placements, unplaced } = planDays({
      ...base,
      settings: { ...SETTINGS, dailyCapMinutes: 120 },
      tasks: [task({ id: "a", est_minutes: 60 })],
      // Il giorno è materialmente libero, ma il tetto è già quasi esaurito.
      days: [day(TODAY, [], 90)],
    });

    expect(placements).toEqual([]);
    expect(unplaced).toHaveLength(1);
  });

  it("il tetto è un massimo, non un obiettivo", () => {
    const { placements } = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 30 })],
      days: [day(TODAY)],
    });

    // Con sei ore di tetto e mezz'ora di lavoro, il solver non inventa altro.
    expect(placements).toHaveLength(1);
  });

  it("preferisce le ore di picco per l'energia alta", () => {
    const { placements } = planDays({
      ...base,
      tasks: [task({ id: "a", energy: "alta", est_minutes: 60 })],
      days: [day(TODAY)],
    });

    expect(placements[0].startMinute).toBeGreaterThanOrEqual(SETTINGS.peakStart!);
    expect(placements[0].startMinute).toBeLessThan(SETTINGS.peakEnd!);
  });

  it("preferisce le ore di calo per l'energia bassa", () => {
    const { placements } = planDays({
      ...base,
      tasks: [task({ id: "a", energy: "bassa", est_minutes: 60 })],
      days: [day(TODAY)],
    });

    expect(placements[0].startMinute).toBe(SETTINGS.lowStart);
  });

  it("la fascia è una preferenza, non un vincolo", () => {
    const { placements, unplaced } = planDays({
      ...base,
      tasks: [task({ id: "a", energy: "bassa", est_minutes: 60 })],
      // Il pomeriggio è pieno: meglio un blocco fuori fascia che nessun blocco.
      days: [day(TODAY, [{ start: 12 * 60, end: 18 * 60 }])],
    });

    expect(unplaced).toEqual([]);
    expect(placements[0].startMinute).toBeLessThan(SETTINGS.lowStart!);
  });

  it("corregge le stime col coefficiente e lo dice", () => {
    const { placements } = planDays({
      ...base,
      coefficient: 1.35,
      tasks: [task({ id: "a", est_minutes: 60 })],
      days: [day(TODAY)],
    });

    expect(placements[0].originalMinutes).toBe(60);
    expect(placements[0].estMinutes).toBe(80);
    expect(placements[0].reason).toContain("stima corretta da 60 a 80 minuti");
  });

  it("ordina per priorità, non per ordine di arrivo", () => {
    const { placements } = planDays({
      ...base,
      tasks: [
        task({ id: "normale" }),
        task({ id: "scaduto", deadline: "2026-07-28" }),
        task({ id: "highlight", is_daily_highlight: true }),
      ],
      days: [day(TODAY)],
    });

    expect(placements.map((p) => p.taskId)).toEqual([
      "highlight",
      "scaduto",
      "normale",
    ]);
  });

  it("spiega perché ha scelto un task", () => {
    const { placements } = planDays({
      ...base,
      tasks: [
        task({
          id: "a",
          is_daily_highlight: true,
          deadline: "2026-07-31",
          postpone_count: 3,
        }),
      ],
      days: [day(TODAY)],
    });

    // La scadenza si legge come si direbbe a voce, non come sta nel database.
    expect(placements[0].reason).toBe(
      "è l'highlight del giorno, scade dopodomani, rinviato 3 volte",
    );
  });

  it("senza giorni dice che non c'è dove mettere le cose", () => {
    const { unplaced } = planDays({
      ...base,
      tasks: [task({ id: "a" })],
      days: [],
    });

    expect(unplaced).toEqual([
      { taskId: "a", reason: "Nessun giorno selezionato." },
    ]);
  });

  it("non modifica gli impegni ricevuti", () => {
    const busy = [{ start: 600, end: 660 }];
    const context = day(TODAY, busy);
    planDays({ ...base, tasks: [task({ id: "a" })], days: [context] });

    expect(busy).toHaveLength(1);
    expect(context.usedMinutes).toBe(0);
  });

  it("i task senza stima valgono mezz'ora", () => {
    const { placements } = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: null })],
      days: [day(TODAY)],
    });

    expect(placements[0].estMinutes).toBe(30);
  });

  it("riempie un buco stretto fra due impegni", () => {
    const busy = [
      { start: 540, end: 600 },
      { start: 675, end: 1080 },
    ];

    // Fra le 10:00 e le 11:15 ci sono 75 minuti, 45 dopo i buffer.
    const ci = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 30 })],
      days: [day(TODAY, busy)],
    });
    expect(ci.placements[0].startMinute).toBe(615);
    expect(ci.placements[0].startMinute + ci.placements[0].estMinutes).toBe(645);

    const nonCiSta = planDays({
      ...base,
      tasks: [task({ id: "a", est_minutes: 60 })],
      days: [day(TODAY, busy)],
    });
    expect(nonCiSta.placements).toEqual([]);
  });

  it("parte da uno slot valido anche con buffer non multipli di 15", () => {
    const { placements } = planDays({
      ...base,
      settings: { ...SETTINGS, bufferMinutes: 10 },
      tasks: [task({ id: "a", est_minutes: 60 })],
      days: [day(TODAY, [{ start: 540, end: 630 }])],
    });

    // Il buco comincia alle 640: il blocco parte al primo slot successivo.
    expect(placements[0].startMinute).toBe(645);
  });
});

describe("planningDays", () => {
  it("restituisce giorni consecutivi a partire da quello dato", () => {
    expect(planningDays(TODAY, 3)).toEqual([
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
    ]);
  });

  it("sta fra uno e sette giorni", () => {
    expect(planningDays(TODAY, 0)).toHaveLength(1);
    expect(planningDays(TODAY, 99)).toHaveLength(7);
  });

  it("attraversa il cambio di mese", () => {
    expect(planningDays("2026-07-31", 2)).toEqual(["2026-07-31", "2026-08-01"]);
  });
});
