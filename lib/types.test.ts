import { describe, expect, it } from "vitest";

import {
  keyResultProgress,
  keyResultStep,
  leastAdvancedKeyResult,
  parseKeyResults,
  parseSubtasks,
  subtaskProgress,
  toTask,
  type Okr,
} from "./types";
import type { Tables } from "./supabase/database.types";

function row(overrides: Partial<Tables<"tasks">> = {}): Tables<"tasks"> {
  return {
    id: "t1",
    user_id: "u1",
    title: "Un task",
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
    sort_order: 1,
    created_at: "2026-07-29T08:00:00Z",
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

describe("parseSubtasks", () => {
  it("legge i sottotask ben formati", () => {
    expect(
      parseSubtasks([
        { id: "s1", text: "Scaletta", done: true },
        { id: "s2", text: "Bozza", done: false, deadline: "2026-08-01" },
      ]),
    ).toEqual([
      { id: "s1", text: "Scaletta", done: true, deadline: null },
      { id: "s2", text: "Bozza", done: false, deadline: "2026-08-01" },
    ]);
  });

  it("scarta le voci senza testo invece di mostrare righe vuote", () => {
    expect(parseSubtasks([{ id: "s1", done: true }, { text: "   " }])).toEqual(
      [],
    );
  });

  it("dà un id a chi non ce l'ha", () => {
    const [first] = parseSubtasks([{ text: "Senza id" }]);
    expect(first.id).toBeTruthy();
    expect(first.done).toBe(false);
  });

  it("non esplode su un valore che non è un array", () => {
    expect(parseSubtasks(null)).toEqual([]);
    expect(parseSubtasks("rotto")).toEqual([]);
    expect(parseSubtasks({ text: "non è una lista" })).toEqual([]);
  });
});

describe("parseKeyResults", () => {
  it("legge i key result completi", () => {
    expect(
      parseKeyResults([
        { id: "k1", text: "Articoli", current: 3, target: 10, unit: "pezzi" },
      ]),
    ).toEqual([
      { id: "k1", text: "Articoli", current: 3, target: 10, unit: "pezzi" },
    ]);
  });

  it("non lascia mai un target a zero: renderebbe il progresso incalcolabile", () => {
    const [kr] = parseKeyResults([{ text: "Senza target", target: 0 }]);
    expect(kr.target).toBe(1);
    expect(kr.current).toBe(0);
  });

  it("ignora i valori non numerici", () => {
    const [kr] = parseKeyResults([
      { text: "Strano", current: "tre", target: "dieci" },
    ]);
    expect(kr.current).toBe(0);
    expect(kr.target).toBe(1);
  });
});

describe("toTask", () => {
  it("restringe i campi testuali alle unioni previste", () => {
    const task = toTask(
      row({ status: "done", energy: "alta", status_review: "stale" }),
    );
    expect(task.status).toBe("done");
    expect(task.energy).toBe("alta");
    expect(task.status_review).toBe("stale");
  });

  it("ripiega su valori sicuri quando il database dice qualcosa di ignoto", () => {
    const task = toTask(
      row({ status: "boh", energy: "altissima", status_review: "chissà" }),
    );
    expect(task.status).toBe("inbox");
    expect(task.energy).toBeNull();
    expect(task.status_review).toBe("active");
  });
});

describe("contatori", () => {
  it("conta i sottotask spuntati", () => {
    const task = toTask(
      row({
        subtasks: [
          { id: "a", text: "Uno", done: true },
          { id: "b", text: "Due", done: false },
          { id: "c", text: "Tre", done: true },
        ],
      }),
    );
    expect(subtaskProgress(task)).toEqual({ done: 2, total: 3 });
  });
});

describe("key result", () => {
  const okr: Okr = {
    id: "o1",
    user_id: "u1",
    project_id: null,
    quarter: "2026-Q3",
    objective: "Pubblicare",
    created_at: "2026-07-01T00:00:00Z",
    key_results: [
      { id: "k1", text: "Avanti", current: 8, target: 10, unit: "" },
      { id: "k2", text: "Indietro", current: 1, target: 10, unit: "" },
    ],
  };

  it("calcola l'avanzamento", () => {
    expect(keyResultProgress(okr.key_results[0])).toBeCloseTo(0.8);
  });

  it("non supera il 100% anche a obiettivo sforato", () => {
    expect(
      keyResultProgress({
        id: "k",
        text: "Sforato",
        current: 15,
        target: 10,
        unit: "",
      }),
    ).toBe(1);
  });

  it("trova il key result più indietro: è quello da citare nel focus", () => {
    expect(leastAdvancedKeyResult(okr)?.id).toBe("k2");
  });

  it("non trova nulla se non ci sono key result", () => {
    expect(leastAdvancedKeyResult({ ...okr, key_results: [] })).toBeNull();
  });

  it("il passo dei pulsanti è un ventesimo del target, mai zero", () => {
    expect(keyResultStep({ id: "k", text: "", current: 0, target: 100, unit: "" })).toBe(5);
    expect(keyResultStep({ id: "k", text: "", current: 0, target: 3, unit: "" })).toBe(1);
  });
});
