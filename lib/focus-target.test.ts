import { describe, expect, it } from "vitest";

import { resolveFocusTarget } from "./focus-target";
import type { Task } from "./types";

const DAY = "2026-07-29";

function block(
  id: string,
  startMinute: number | null,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    user_id: "u1",
    title: id,
    notes: "",
    status: "inbox",
    day: startMinute === null ? null : DAY,
    start_minute: startMinute,
    est_minutes: startMinute === null ? null : 60,
    energy: null,
    project_id: null,
    deadline: null,
    subtasks: [],
    recur_id: null,
    sort_order: 0,
    created_at: "",
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

describe("resolveFocusTarget", () => {
  const giornata = [
    block("mattina", 540), // 09:00–10:00
    block("mezzogiorno", 720), // 12:00–13:00
    block("pomeriggio", 900), // 15:00–16:00
  ];

  it("preferisce il blocco in corso", () => {
    const choice = resolveFocusTarget(giornata, { day: DAY, minute: 570 });
    expect(choice).toMatchObject({ reason: "in-corso" });
    expect(choice?.task.id).toBe("mattina");
  });

  it("prende il prossimo quando non c'è niente in corso", () => {
    // Le 11:00: la mattina è finita, mezzogiorno non è cominciato.
    const choice = resolveFocusTarget(giornata, { day: DAY, minute: 660 });
    expect(choice).toMatchObject({ reason: "prossimo" });
    expect(choice?.task.id).toBe("mezzogiorno");
  });

  it("a giornata finita propone il primo rimasto, non nulla", () => {
    const choice = resolveFocusTarget(giornata, { day: DAY, minute: 1200 });
    expect(choice).toMatchObject({ reason: "primo-rimasto" });
    expect(choice?.task.id).toBe("mattina");
  });

  it("considera in corso il minuto d'inizio", () => {
    expect(
      resolveFocusTarget(giornata, { day: DAY, minute: 540 })?.task.id,
    ).toBe("mattina");
  });

  it("non considera in corso il minuto di fine", () => {
    // Alle 10:00 in punto la mattina è chiusa: tocca al prossimo.
    const choice = resolveFocusTarget(giornata, { day: DAY, minute: 600 });
    expect(choice?.reason).toBe("prossimo");
  });

  it("salta i blocchi già completati", () => {
    const choice = resolveFocusTarget(
      [block("fatto", 540, { status: "done" }), block("aperto", 720)],
      { day: DAY, minute: 570 },
    );
    expect(choice?.task.id).toBe("aperto");
  });

  it("ignora i task non pianificati", () => {
    expect(
      resolveFocusTarget([block("in-lista", null)], { day: DAY, minute: 570 }),
    ).toBeNull();
  });

  it("ignora i blocchi di altri giorni", () => {
    const altroGiorno = block("domani", 540, { day: "2026-07-30" });
    expect(
      resolveFocusTarget([altroGiorno], { day: DAY, minute: 570 }),
    ).toBeNull();
  });

  it("non trova nulla in una giornata vuota", () => {
    expect(resolveFocusTarget([], { day: DAY, minute: 570 })).toBeNull();
  });

  it("non si fa confondere dall'ordine di arrivo", () => {
    const shuffled = [giornata[2], giornata[0], giornata[1]];
    expect(
      resolveFocusTarget(shuffled, { day: DAY, minute: 660 })?.task.id,
    ).toBe("mezzogiorno");
  });
});
