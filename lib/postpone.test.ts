import { describe, expect, it } from "vitest";

import {
  isPostponement,
  MICRO_START_FROM,
  needsMicroStart,
} from "./postpone";
import type { Task } from "./types";

function task(day: string | null): Task {
  return {
    id: "t1",
    user_id: "u1",
    title: "Un task",
    notes: "",
    status: "inbox",
    day,
    start_minute: day ? 540 : null,
    est_minutes: day ? 60 : null,
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
  };
}

describe("isPostponement", () => {
  it("spostare a un giorno successivo è un rinvio", () => {
    expect(isPostponement(task("2026-07-29"), "2026-07-30")).toBe(true);
    expect(isPostponement(task("2026-07-29"), "2026-08-05")).toBe(true);
  });

  it("riordinare dentro la stessa giornata non lo è", () => {
    // Senza questa distinzione, sistemare la mattinata gonfierebbe il
    // contatore e farebbe comparire il dialogo del terzo rinvio a chi sta
    // solo mettendo a posto l'agenda.
    expect(isPostponement(task("2026-07-29"), "2026-07-29")).toBe(false);
  });

  it("anticipare non lo è", () => {
    expect(isPostponement(task("2026-07-29"), "2026-07-28")).toBe(false);
  });

  it("pianificare per la prima volta non lo è", () => {
    expect(isPostponement(task(null), "2026-07-30")).toBe(false);
  });

  it("togliere dal calendario un blocco già pianificato lo è", () => {
    expect(isPostponement(task("2026-07-29"), null)).toBe(true);
  });

  it("confronta i giorni come date, non come stringhe a caso", () => {
    // Il formato YYYY-MM-DD si ordina correttamente anche fra mesi e anni.
    expect(isPostponement(task("2026-09-30"), "2026-10-01")).toBe(true);
    expect(isPostponement(task("2026-12-31"), "2027-01-01")).toBe(true);
    expect(isPostponement(task("2027-01-01"), "2026-12-31")).toBe(false);
  });
});

describe("needsMicroStart", () => {
  /** Lo stesso task, con il contatore dei rinvii che ci serve. */
  const slipping = (count: number, extra: Partial<Task> = {}): Task => ({
    ...task(null),
    postpone_count: count,
    ...extra,
  });

  it("si offre dal secondo rinvio in poi", () => {
    expect(needsMicroStart(slipping(0))).toBe(false);
    expect(needsMicroStart(slipping(1))).toBe(false);
    expect(needsMicroStart(slipping(MICRO_START_FROM))).toBe(true);
    expect(needsMicroStart(slipping(7))).toBe(true);
  });

  it("non si offre su ciò che è già chiuso", () => {
    // Un permesso di cominciare non serve a un task finito, né a uno messo
    // via: comparirebbe come rumore in due liste che devono restare quiete.
    expect(needsMicroStart(slipping(5, { status: "done" }))).toBe(false);
    expect(needsMicroStart(slipping(5, { status_review: "archived" }))).toBe(
      false,
    );
  });
});
