import { describe, expect, it } from "vitest";

import {
  averageProgress,
  daysLeftInQuarter,
  formatQuarter,
  isQuarter,
  nextQuarter,
  okrProgress,
  parseQuarter,
  previousQuarter,
  quarterBounds,
  quarterProgress,
  rhythmOf,
} from "./quarter";
import type { KeyResult, Okr } from "./types";

function okr(keyResults: Array<Partial<KeyResult>>): Okr {
  return {
    id: "o1",
    user_id: "u1",
    project_id: null,
    quarter: "2026-Q3",
    objective: "Un obiettivo",
    created_at: "",
    key_results: keyResults.map((kr, index) => ({
      id: `k${index}`,
      text: `Risultato ${index}`,
      current: 0,
      target: 10,
      unit: "",
      ...kr,
    })),
  };
}

describe("parsing", () => {
  it("legge un trimestre valido", () => {
    expect(parseQuarter("2026-Q3")).toEqual({ year: 2026, quarter: 3 });
  });

  it("rifiuta ciò che non lo è", () => {
    expect(parseQuarter("2026-T3")).toBeNull();
    expect(parseQuarter("2026-Q5")).toBeNull();
    expect(parseQuarter("26-Q1")).toBeNull();
    expect(isQuarter("2026-Q0")).toBe(false);
  });

  it("formatta e rilegge senza perdere niente", () => {
    expect(parseQuarter(formatQuarter(2029, 2))).toEqual({
      year: 2029,
      quarter: 2,
    });
  });
});

describe("quarterBounds", () => {
  it("copre i tre mesi giusti", () => {
    expect(quarterBounds("2026-Q1")).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    });
    expect(quarterBounds("2026-Q2")).toEqual({
      start: "2026-04-01",
      end: "2026-06-30",
    });
    expect(quarterBounds("2026-Q3")).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
    expect(quarterBounds("2026-Q4")).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
  });

  it("gestisce febbraio senza doverne sapere la lunghezza", () => {
    expect(quarterBounds("2027-Q1").end).toBe("2027-03-31");
    // 2028 è bisestile: il primo trimestre ha un giorno in più.
    expect(quarterBounds("2028-Q1").start).toBe("2028-01-01");
    expect(quarterBounds("2028-Q1").end).toBe("2028-03-31");
  });
});

describe("trimestre precedente e successivo", () => {
  it("scorre dentro l'anno", () => {
    expect(previousQuarter("2026-Q3")).toBe("2026-Q2");
    expect(nextQuarter("2026-Q3")).toBe("2026-Q4");
  });

  it("cambia anno ai bordi", () => {
    expect(previousQuarter("2026-Q1")).toBe("2025-Q4");
    expect(nextQuarter("2026-Q4")).toBe("2027-Q1");
  });
});

describe("quarterProgress", () => {
  it("vale zero il giorno prima e uno alla fine", () => {
    expect(quarterProgress("2026-Q3", "2026-06-30")).toBe(0);
    expect(quarterProgress("2026-Q3", "2026-09-30")).toBe(1);
    expect(quarterProgress("2026-Q3", "2026-12-01")).toBe(1);
  });

  it("il primo giorno conta già", () => {
    // 1 giorno su 92: piccolo, ma non zero.
    expect(quarterProgress("2026-Q3", "2026-07-01")).toBeGreaterThan(0);
  });

  it("a metà trimestre sta intorno a metà", () => {
    const progress = quarterProgress("2026-Q3", "2026-08-15");
    expect(progress).toBeGreaterThan(0.45);
    expect(progress).toBeLessThan(0.55);
  });

  it("conta i giorni che restano", () => {
    expect(daysLeftInQuarter("2026-Q3", "2026-09-20")).toBe(10);
    expect(daysLeftInQuarter("2026-Q3", "2026-10-05")).toBe(0);
  });
});

describe("avanzamento", () => {
  it("è la media dei risultati chiave", () => {
    expect(
      okrProgress(okr([{ current: 10, target: 10 }, { current: 0, target: 10 }])),
    ).toBe(0.5);
  });

  it("non supera il 100% anche a obiettivo sforato", () => {
    expect(okrProgress(okr([{ current: 30, target: 10 }]))).toBe(1);
  });

  it("un obiettivo senza risultati vale zero", () => {
    expect(okrProgress(okr([]))).toBe(0);
  });

  it("la media generale ignora gli obiettivi senza risultati", () => {
    const pieno = okr([{ current: 10, target: 10 }]);
    const vuoto = { ...okr([]), id: "o2" };
    // Contando anche il vuoto verrebbe 0,5 e sembrerebbe di essere a metà.
    expect(averageProgress([pieno, vuoto])).toBe(1);
  });

  it("senza obiettivi la media è zero", () => {
    expect(averageProgress([])).toBe(0);
  });
});

describe("rhythmOf", () => {
  it("dice quando sei indietro, e quanti giorni restano", () => {
    // Metà trimestre, risultati al 10%.
    const rhythm = rhythmOf(
      [okr([{ current: 1, target: 10 }])],
      "2026-Q3",
      "2026-08-15",
    );
    expect(rhythm.status).toBe("indietro");
    expect(rhythm.message).toContain("sei indietro");
    expect(rhythm.message).toMatch(/\d+ giorni davanti/);
  });

  it("dice quando sei avanti", () => {
    const rhythm = rhythmOf(
      [okr([{ current: 9, target: 10 }])],
      "2026-Q3",
      "2026-08-15",
    );
    expect(rhythm.status).toBe("avanti");
  });

  it("non commenta gli scarti piccoli", () => {
    // Trimestre al 50%, risultati al 50%.
    const rhythm = rhythmOf(
      [okr([{ current: 5, target: 10 }])],
      "2026-Q3",
      "2026-08-15",
    );
    expect(rhythm.status).toBe("in-linea");
  });

  it("a trimestre chiuso non promette giorni che non ci sono", () => {
    const rhythm = rhythmOf(
      [okr([{ current: 1, target: 10 }])],
      "2026-Q3",
      "2026-10-15",
    );
    expect(rhythm.status).toBe("indietro");
    expect(rhythm.message).not.toContain("giorni davanti");
    expect(rhythm.message).toContain("finito");
  });

  it("all'inizio del trimestre non accusa nessuno", () => {
    const rhythm = rhythmOf([okr([{ current: 0, target: 10 }])], "2026-Q3", "2026-07-01");
    expect(rhythm.status).toBe("in-linea");
  });
});
