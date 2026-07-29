import { describe, expect, it } from "vitest";

import {
  completionRate,
  correctedEstimate,
  DECAY_DAYS,
  isStale,
  mostPostponed,
  optimismCoefficient,
  optimismMessage,
  plannedVsDone,
  CAP_CEILING,
  CAP_COLD_START,
  capExplanation,
  realisticCap,
  weeklyHighlights,
} from "./calibration";
import { addDaysISO } from "./time";
import type { FocusSession, Task } from "./types";

const TODAY = "2026-07-29";

function session(
  planned: number,
  actual: number | null,
  overrides: Partial<FocusSession> = {},
): FocusSession {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    task_id: null,
    started_at: "2026-07-20T09:00:00Z",
    ended_at: null,
    planned_minutes: planned,
    actual_minutes: actual,
    outcome: "completed",
    was_micro_start: false,
    paused_seconds: 0,
    created_at: "",
    ...overrides,
  };
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    user_id: "u1",
    title: overrides.id,
    notes: "",
    status: "inbox",
    day: null,
    start_minute: null,
    est_minutes: null,
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

describe("coefficiente di ottimismo", () => {
  it("vale 1 quando le stime sono giuste", () => {
    const sessions = Array.from({ length: 6 }, () => session(60, 60));
    expect(optimismCoefficient(sessions)).toBe(1);
  });

  it("riconosce chi sottostima", () => {
    // Sei sessioni che durano il 40% in più del previsto.
    const sessions = Array.from({ length: 6 }, () => session(60, 84));
    expect(optimismCoefficient(sessions)).toBe(1.4);
  });

  it("riconosce chi sovrastima", () => {
    const sessions = Array.from({ length: 6 }, () => session(60, 45));
    expect(optimismCoefficient(sessions)).toBe(0.75);
  });

  it("tace finché i dati non bastano", () => {
    expect(optimismCoefficient([])).toBeNull();
    expect(
      optimismCoefficient(Array.from({ length: 4 }, () => session(60, 90))),
    ).toBeNull();
  });

  it("non si fa rovinare da un timer dimenticato aperto", () => {
    // Cinque sessioni giuste più una da 5 minuti previsti e 5 ore reali.
    const sane = Array.from({ length: 5 }, () => session(60, 60));
    const outlier = session(5, 300);
    const coefficient = optimismCoefficient([...sane, outlier]) as number;

    // Senza il limite la media sarebbe (5 + 60) / 6 ≈ 10,8.
    expect(coefficient).toBeLessThan(1.6);
    expect(coefficient).toBeGreaterThan(1);
  });

  it("ignora le sessioni abbandonate", () => {
    const sessions = [
      ...Array.from({ length: 5 }, () => session(60, 60)),
      session(60, 5, { outcome: "abandoned" }),
    ];
    expect(optimismCoefficient(sessions)).toBe(1);
  });

  it("ignora le sessioni ancora aperte", () => {
    const sessions = [
      ...Array.from({ length: 5 }, () => session(60, 60)),
      session(60, null),
    ];
    expect(optimismCoefficient(sessions)).toBe(1);
  });

  it("guarda solo le trenta più recenti", () => {
    const vecchie = Array.from({ length: 40 }, () =>
      session(60, 120, { started_at: "2026-01-01T09:00:00Z" }),
    );
    const recenti = Array.from({ length: 30 }, () =>
      session(60, 60, { started_at: "2026-07-28T09:00:00Z" }),
    );
    expect(optimismCoefficient([...vecchie, ...recenti])).toBe(1);
  });
});

describe("optimismMessage", () => {
  it("dice di quanto si sbaglia", () => {
    expect(optimismMessage(1.4)).toBe("Sottostimi del 40%.");
    expect(optimismMessage(0.7)).toBe("Sovrastimi del 30%.");
  });

  it("tace sotto il 10%: quello è rumore", () => {
    expect(optimismMessage(1.05)).toBeNull();
    expect(optimismMessage(0.95)).toBeNull();
    expect(optimismMessage(1)).toBeNull();
  });

  it("tace se non c'è un coefficiente", () => {
    expect(optimismMessage(null)).toBeNull();
  });
});

describe("correctedEstimate", () => {
  it("allunga la stima secondo il coefficiente", () => {
    expect(correctedEstimate(60, 1.4)).toBe(85);
  });

  it("arrotonda a cinque minuti", () => {
    expect(correctedEstimate(30, 1.4) % 5).toBe(0);
  });

  it("lascia la stima com'è senza coefficiente", () => {
    expect(correctedEstimate(60, null)).toBe(60);
  });

  it("non scende mai sotto i cinque minuti", () => {
    expect(correctedEstimate(5, 0.25)).toBe(5);
  });
});

describe("completionRate", () => {
  const tasks = [
    task({ id: "a", day: TODAY, status: "done" }),
    task({ id: "b", day: TODAY }),
    task({ id: "c", day: addDaysISO(TODAY, -3), status: "done" }),
    task({ id: "d", day: addDaysISO(TODAY, -30) }), // fuori finestra
    task({ id: "e" }), // mai pianificato
  ];

  it("conta solo i blocchi dentro la finestra", () => {
    const result = completionRate(tasks, { days: 14, today: TODAY });
    expect(result.planned).toBe(3);
    expect(result.done).toBe(2);
    expect(result.rate).toBeCloseTo(2 / 3);
  });

  it("non inventa una percentuale senza dati", () => {
    expect(completionRate([], { today: TODAY }).rate).toBeNull();
  });
});

describe("plannedVsDone", () => {
  it("restituisce una riga per giorno, in ordine", () => {
    const series = plannedVsDone([], { days: 14, today: TODAY });
    expect(series).toHaveLength(14);
    expect(series[13].day).toBe(TODAY);
    expect(series[0].day).toBe(addDaysISO(TODAY, -13));
  });

  it("usa la durata reale per l'eseguito, non la stima", () => {
    const series = plannedVsDone(
      [task({ id: "a", day: TODAY, est_minutes: 60, status: "done", actual_duration_minutes: 95 })],
      { days: 1, today: TODAY },
    );
    expect(series[0]).toEqual({ day: TODAY, planned: 60, done: 95 });
  });

  it("ripiega sulla stima se la durata reale manca", () => {
    const series = plannedVsDone(
      [task({ id: "a", day: TODAY, est_minutes: 60, status: "done" })],
      { days: 1, today: TODAY },
    );
    expect(series[0].done).toBe(60);
  });

  it("non conta come eseguito ciò che è ancora aperto", () => {
    const series = plannedVsDone(
      [task({ id: "a", day: TODAY, est_minutes: 60 })],
      { days: 1, today: TODAY },
    );
    expect(series[0]).toEqual({ day: TODAY, planned: 60, done: 0 });
  });
});

describe("mostPostponed", () => {
  it("mette in cima i più rinviati", () => {
    const ranking = mostPostponed([
      task({ id: "poco", postpone_count: 1 }),
      task({ id: "tanto", postpone_count: 7 }),
      task({ id: "medio", postpone_count: 3 }),
    ]);
    expect(ranking.map((t) => t.id)).toEqual(["tanto", "medio", "poco"]);
  });

  it("esclude chi non è mai stato rinviato e chi è già chiuso", () => {
    const ranking = mostPostponed([
      task({ id: "mai" }),
      task({ id: "chiuso", postpone_count: 5, status: "done" }),
    ]);
    expect(ranking).toEqual([]);
  });
});

describe("isStale", () => {
  const old = addDaysISO(TODAY, -DECAY_DAYS - 1) + "T00:00:00Z";

  it("segnala un task mai pianificato da tre settimane", () => {
    expect(isStale(task({ id: "a", created_at: old }), { today: TODAY })).toBe(
      true,
    );
  });

  it("lascia stare chi è stato pianificato almeno una volta", () => {
    // Rimandato non è dimenticato: quello lo racconta il conteggio dei rinvii.
    expect(
      isStale(
        task({
          id: "b",
          created_at: old,
          first_planned_at: "2026-07-10T09:00:00Z",
        }),
        { today: TODAY },
      ),
    ).toBe(false);
  });

  it("lascia stare chi è recente", () => {
    expect(
      isStale(task({ id: "c", created_at: "2026-07-25T00:00:00Z" }), {
        today: TODAY,
      }),
    ).toBe(false);
  });

  it("lascia stare chiusi e archiviati", () => {
    expect(
      isStale(task({ id: "d", created_at: old, status: "done" }), {
        today: TODAY,
      }),
    ).toBe(false);
    expect(
      isStale(task({ id: "e", created_at: old, status_review: "archived" }), {
        today: TODAY,
      }),
    ).toBe(false);
  });

  it("lascia stare chi è sul calendario adesso", () => {
    expect(
      isStale(task({ id: "f", created_at: old, day: TODAY }), { today: TODAY }),
    ).toBe(false);
  });
});

describe("realisticCap", () => {
  /** Una serie di giorni: `[pianificati, fatti]` in minuti. */
  const series = (pairs: Array<[number, number]>) =>
    pairs.map(([planned, done], i) => ({
      day: `2026-07-${String(10 + i).padStart(2, "0")}`,
      planned,
      done,
    }));

  it("con poco storico parte da quattro ore, non da sei", () => {
    // La prima giornata pianificata troppo piena è anche la prima delusione.
    const cap = realisticCap(series([[300, 200]]));
    expect(cap.minutes).toBe(CAP_COLD_START);
    expect(cap.source).toBe("nuovo");
    expect(cap.typicalMinutes).toBeNull();
  });

  it("segue il completato reale, con un margine del 15%", () => {
    const cap = realisticCap(
      series([
        [300, 180],
        [300, 200],
        [300, 220],
      ]),
    );
    expect(cap.typicalMinutes).toBe(200);
    expect(cap.minutes).toBe(230); // 200 × 1.15
    expect(cap.source).toBe("storico");
  });

  it("non sfora mai le sei ore, per bravi che si sia", () => {
    const cap = realisticCap(
      series([
        [600, 560],
        [600, 580],
        [600, 600],
      ]),
    );
    expect(cap.minutes).toBe(CAP_CEILING);
    expect(cap.source).toBe("impostazioni");
  });

  it("ignora i giorni senza niente in programma", () => {
    // Due domeniche vuote non devono stringere le giornate lavorative.
    const conRiposo = realisticCap(
      series([
        [300, 200],
        [300, 200],
        [300, 200],
        [0, 0],
        [0, 0],
      ]),
    );
    expect(conRiposo.typicalMinutes).toBe(200);
  });

  it("rispetta un tetto più basso scelto nelle impostazioni", () => {
    const cap = realisticCap(
      series([
        [600, 560],
        [600, 580],
        [600, 600],
      ]),
      120,
    );
    expect(cap.minutes).toBe(120);
  });

  it("non scende sotto un'ora", () => {
    // Sotto quella soglia non è più un limite realistico: è un'app che si
    // arrende.
    const cap = realisticCap(
      series([
        [300, 0],
        [300, 10],
        [300, 5],
      ]),
    );
    expect(cap.minutes).toBe(60);
  });
});

describe("capExplanation", () => {
  it("spiega il tetto solo quando c'è qualcosa da spiegare", () => {
    expect(
      capExplanation({ minutes: 230, source: "storico", typicalMinutes: 200 }),
    ).toBe(
      "Ho pianificato al massimo 3h 50m al giorno invece di 6h: ultimamente completi in media 3h 20m.",
    );
    expect(
      capExplanation({ minutes: 240, source: "nuovo", typicalMinutes: null }),
    ).toMatch(/Parto da 4h/);
    // Il tetto viene dalle impostazioni: dirlo non aggiunge nulla.
    expect(
      capExplanation({ minutes: 360, source: "impostazioni", typicalMinutes: 400 }),
    ).toBeNull();
  });
});

describe("weeklyHighlights", () => {
  const week = { from: "2026-07-27", to: "2026-08-02" };

  it("conta scelti e fatti dentro la settimana", () => {
    const tasks = [
      task({ id: "a", is_daily_highlight: true, highlight_date: "2026-07-27", status: "done" }),
      task({ id: "b", is_daily_highlight: true, highlight_date: "2026-07-28" }),
      task({ id: "c", is_daily_highlight: true, highlight_date: "2026-07-29", status: "done" }),
    ];

    expect(weeklyHighlights(tasks, week)).toEqual({ chosen: 3, done: 2, days: 7 });
  });

  it("il denominatore è sette, non i giorni in cui si è scelto", () => {
    // Una giornata senza Highlight non è neutra: è una giornata in cui non si
    // è deciso cosa contava.
    const tasks = [
      task({ id: "a", is_daily_highlight: true, highlight_date: "2026-07-27", status: "done" }),
    ];
    expect(weeklyHighlights(tasks, week).days).toBe(7);
  });

  it("ignora ciò che sta fuori dalla settimana e chi non è highlight", () => {
    const tasks = [
      task({ id: "a", is_daily_highlight: true, highlight_date: "2026-07-20", status: "done" }),
      task({ id: "b", is_daily_highlight: false, highlight_date: "2026-07-28", status: "done" }),
      task({ id: "c", is_daily_highlight: true, highlight_date: null, status: "done" }),
    ];
    expect(weeklyHighlights(tasks, week)).toEqual({ chosen: 0, done: 0, days: 7 });
  });
});
