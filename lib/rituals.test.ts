import { describe, expect, it } from "vitest";

import {
  carryOverLeft,
  dayTotals,
  formatSlots,
  isReviewDay,
  kickoffMessage,
  MAX_CARRY_OVER,
  shutdownSummary,
  typicalCompleted,
  type PendingChoice,
} from "./rituals";
import { fmtMin } from "./time";
import type { DailyReview, Task } from "./types";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    user_id: "u1",
    title: overrides.id,
    notes: "",
    status: "inbox",
    day: "2026-07-29",
    start_minute: 540,
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

function review(overrides: Partial<DailyReview>): DailyReview {
  return {
    id: "r1",
    user_id: "u1",
    date: "2026-07-28",
    type: "shutdown",
    planned_minutes: 300,
    completed_minutes: 200,
    tasks_planned: 5,
    tasks_completed: 3,
    notes: null,
    confirmed_at: null,
    created_at: "",
    ...overrides,
  };
}

describe("dayTotals", () => {
  it("conta solo ciò che è sul calendario", () => {
    const totals = dayTotals([
      task({ id: "a" }),
      // In Lista, non pianificato: non entra nel conto della giornata.
      task({ id: "b", day: null, start_minute: null }),
    ]);

    expect(totals.tasksPlanned).toBe(1);
    expect(totals.plannedMinutes).toBe(60);
  });

  it("usa il tempo reale quando c'è, la stima quando manca", () => {
    const totals = dayTotals([
      task({ id: "a", status: "done", actual_duration_minutes: 90 }),
      task({ id: "b", status: "done", start_minute: 700 }),
    ]);

    expect(totals.tasksCompleted).toBe(2);
    expect(totals.completedMinutes).toBe(150);
  });

  it("su una giornata vuota non inventa numeri", () => {
    expect(dayTotals([])).toEqual({
      plannedMinutes: 0,
      completedMinutes: 0,
      tasksPlanned: 0,
      tasksCompleted: 0,
    });
  });
});

describe("typicalCompleted", () => {
  it("tace finché i giorni non bastano", () => {
    expect(typicalCompleted([review({}), review({})])).toBeNull();
  });

  it("fa la media dei minuti eseguiti", () => {
    const history = [
      review({ completed_minutes: 180 }),
      review({ completed_minutes: 200 }),
      review({ completed_minutes: 220 }),
    ];
    expect(typicalCompleted(history)).toBe(200);
  });

  it("ignora i giorni senza niente in programma", () => {
    // Le domeniche vuote abbasserebbero la media di una persona che lavora
    // cinque giorni su sette, e il confronto direbbe una cosa falsa.
    const history = [
      review({ completed_minutes: 180 }),
      review({ completed_minutes: 200 }),
      review({ completed_minutes: 220 }),
      review({ completed_minutes: 0, tasks_planned: 0 }),
    ];
    expect(typicalCompleted(history)).toBe(200);
  });
});

describe("kickoffMessage", () => {
  it("parla solo se lo scarto è grosso", () => {
    expect(kickoffMessage({ plannedMinutes: 300, typical: 200 })).toBe(
      "Stai pianificando 5h, di solito ne esegui 3h 20m.",
    );
    // Il 20% in più rientra nella normale variabilità: non è una notizia.
    expect(kickoffMessage({ plannedMinutes: 240, typical: 200 })).toBeNull();
  });

  it("tace senza storico o senza piano", () => {
    expect(kickoffMessage({ plannedMinutes: 300, typical: null })).toBeNull();
    expect(kickoffMessage({ plannedMinutes: 0, typical: 200 })).toBeNull();
  });
});

describe("carryOverLeft", () => {
  it("parte da tre e scende", () => {
    expect(carryOverLeft({})).toBe(MAX_CARRY_OVER);
    expect(carryOverLeft({ a: "domani", b: "lista" })).toBe(2);
  });

  it("non scende sotto zero", () => {
    const choices: Record<string, PendingChoice> = {
      a: "domani",
      b: "domani",
      c: "domani",
      d: "domani",
    };
    expect(carryOverLeft(choices)).toBe(0);
  });

  it("le altre scelte non consumano il tetto", () => {
    expect(carryOverLeft({ a: "lista", b: "fatto", c: "elimina" })).toBe(3);
  });
});

describe("shutdownSummary", () => {
  it("riconosce la giornata piena", () => {
    expect(
      shutdownSummary({
        plannedMinutes: 120,
        completedMinutes: 120,
        tasksPlanned: 2,
        tasksCompleted: 2,
      }),
    ).toBe("Tutto fatto: 2 blocchi, 2h.");
  });

  it("dice i numeri senza commentarli", () => {
    expect(
      shutdownSummary({
        plannedMinutes: 300,
        completedMinutes: 120,
        tasksPlanned: 5,
        tasksCompleted: 2,
      }),
    ).toBe("2 di 5 blocchi, 2h su 5h pianificati.");
  });

  it("non rimprovera una giornata senza piano", () => {
    expect(
      shutdownSummary({
        plannedMinutes: 0,
        completedMinutes: 0,
        tasksPlanned: 0,
        tasksCompleted: 0,
      }),
    ).toBe("Oggi non c'era niente sul calendario.");
  });
});

describe("formatSlots", () => {
  it("scrive gli intervalli come li legge il prompt", () => {
    expect(
      formatSlots(
        [
          { start: 540, end: 660 },
          { start: 900, end: 1080 },
        ],
        fmtMin,
      ),
    ).toEqual(["09:00–11:00", "15:00–18:00"]);
  });

  it("scarta i ritagli inutilizzabili", () => {
    expect(formatSlots([{ start: 540, end: 545 }], fmtMin)).toEqual([]);
  });
});

describe("isReviewDay", () => {
  it("è domenica o lunedì", () => {
    // 2026-08-02 è una domenica, 2026-08-03 il lunedì dopo.
    expect(isReviewDay("2026-08-02")).toBe(true);
    expect(isReviewDay("2026-08-03")).toBe(true);
  });

  it("non interrompe una giornata di lavoro", () => {
    // Proporre una revisione il mercoledì pomeriggio significa fermare
    // qualcuno che stava lavorando: l'opposto di quello che serve.
    for (const day of ["2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01"]) {
      expect(isReviewDay(day), day).toBe(false);
    }
  });
});
