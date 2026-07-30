import { describe, expect, it } from "vitest";

import {
  bufferStrips,
  layoutOverlaps,
  HOUR_HEIGHT,
  pxPerMinute,
  visibleWindow,
} from "./calendar-layout";

function block(id: string, start: number, end: number) {
  return { item: id, start, end };
}

describe("layoutOverlaps", () => {
  it("dà tutta la larghezza a un blocco solo", () => {
    const [placed] = layoutOverlaps([block("a", 540, 600)]);
    expect(placed).toMatchObject({ item: "a", column: 0, columns: 1 });
  });

  it("lascia intera la larghezza a blocchi che non si toccano", () => {
    const placed = layoutOverlaps([
      block("a", 540, 600),
      block("b", 600, 660),
    ]);
    expect(placed.every((entry) => entry.columns === 1)).toBe(true);
  });

  it("divide in due i blocchi sovrapposti", () => {
    const placed = layoutOverlaps([
      block("a", 540, 660),
      block("b", 600, 720),
    ]);
    expect(placed.every((entry) => entry.columns === 2)).toBe(true);
    expect(placed.map((entry) => entry.column).sort()).toEqual([0, 1]);
  });

  it("tiene insieme il gruppo anche quando la catena è indiretta", () => {
    // A tocca B, B tocca C, ma A e C non si toccano: devono comunque stare
    // sulla stessa griglia, altrimenti le larghezze non tornano.
    const placed = layoutOverlaps([
      block("a", 540, 600),
      block("b", 570, 660),
      block("c", 630, 690),
    ]);
    expect(placed.every((entry) => entry.columns === 2)).toBe(true);
    const byId = new Map(placed.map((entry) => [entry.item, entry]));
    expect(byId.get("a")?.column).toBe(0);
    expect(byId.get("b")?.column).toBe(1);
    // «c» può riusare la colonna di «a», che nel frattempo si è liberata.
    expect(byId.get("c")?.column).toBe(0);
  });

  it("apre gruppi separati quando la catena si interrompe", () => {
    const placed = layoutOverlaps([
      block("a", 540, 660),
      block("b", 600, 660),
      block("c", 700, 760),
    ]);
    const byId = new Map(placed.map((entry) => [entry.item, entry]));
    expect(byId.get("a")?.columns).toBe(2);
    expect(byId.get("c")?.columns).toBe(1);
  });

  it("non perde nessun blocco", () => {
    const items = [
      block("a", 540, 600),
      block("b", 545, 610),
      block("c", 550, 620),
      block("d", 800, 860),
    ];
    expect(layoutOverlaps(items)).toHaveLength(4);
  });

  it("non dipende dall'ordine in cui arrivano", () => {
    const forward = layoutOverlaps([
      block("a", 540, 660),
      block("b", 600, 720),
    ]);
    const backward = layoutOverlaps([
      block("b", 600, 720),
      block("a", 540, 660),
    ]);
    const key = (list: typeof forward) =>
      list
        .map((entry) => `${entry.item}:${entry.column}/${entry.columns}`)
        .sort();
    expect(key(forward)).toEqual(key(backward));
  });

  it("regge tre blocchi tutti sovrapposti", () => {
    const placed = layoutOverlaps([
      block("a", 540, 660),
      block("b", 550, 660),
      block("c", 560, 660),
    ]);
    expect(placed.every((entry) => entry.columns === 3)).toBe(true);
    expect(placed.map((entry) => entry.column).sort()).toEqual([0, 1, 2]);
  });

  it("non si confonde con la lista vuota", () => {
    expect(layoutOverlaps([])).toEqual([]);
  });
});

describe("bufferStrips", () => {
  it("segna le pause brevi fra blocchi consecutivi", () => {
    expect(
      bufferStrips(
        [
          { start: 540, end: 600 },
          { start: 610, end: 660 },
        ],
        10,
      ),
    ).toEqual([{ start: 600, end: 610 }]);
  });

  it("ignora i buchi più lunghi del buffer: quello è tempo libero", () => {
    expect(
      bufferStrips(
        [
          { start: 540, end: 600 },
          { start: 660, end: 720 },
        ],
        10,
      ),
    ).toEqual([]);
  });

  it("non segna nulla fra blocchi attaccati", () => {
    expect(
      bufferStrips(
        [
          { start: 540, end: 600 },
          { start: 600, end: 660 },
        ],
        10,
      ),
    ).toEqual([]);
  });

  it("ordina i blocchi prima di guardarli", () => {
    expect(
      bufferStrips(
        [
          { start: 610, end: 660 },
          { start: 540, end: 600 },
        ],
        10,
      ),
    ).toEqual([{ start: 600, end: 610 }]);
  });

  it("con buffer a zero non produce nulla", () => {
    expect(
      bufferStrips(
        [
          { start: 540, end: 600 },
          { start: 605, end: 660 },
        ],
        0,
      ),
    ).toEqual([]);
  });
});

describe("visibleWindow", () => {
  it("mostra l'orario di lavoro quando non c'è nulla fuori", () => {
    expect(
      visibleWindow({ workStart: 480, workEnd: 1200, ranges: [] }),
    ).toEqual({ start: 480, end: 1200 });
  });

  it("si allarga per un blocco pianificato prima dell'orario di lavoro", () => {
    expect(
      visibleWindow({
        workStart: 480,
        workEnd: 1200,
        ranges: [{ start: 400, end: 460 }],
      }),
    ).toEqual({ start: 360, end: 1200 });
  });

  it("si allarga per un blocco che finisce dopo", () => {
    expect(
      visibleWindow({
        workStart: 480,
        workEnd: 1200,
        ranges: [{ start: 1180, end: 1250 }],
      }),
    ).toEqual({ start: 480, end: 1260 });
  });

  it("non esce mai dalla giornata", () => {
    const window = visibleWindow({
      workStart: 0,
      workEnd: 1440,
      ranges: [{ start: 0, end: 1440 }],
    });
    expect(window.start).toBe(0);
    expect(window.end).toBe(1440);
  });

  it("garantisce un'altezza minima anche con una finestra degenere", () => {
    const window = visibleWindow({ workStart: 600, workEnd: 630, ranges: [] });
    expect(window.end - window.start).toBeGreaterThanOrEqual(120);
  });
});

describe("pxPerMinute", () => {
  it("cresce quando lo zoom si stringe", () => {
    expect(pxPerMinute(15)).toBeGreaterThan(pxPerMinute(30));
    expect(pxPerMinute(30)).toBeGreaterThan(pxPerMinute(60));
  });

  it("un blocco da un'ora è alto quanto un'ora di griglia", () => {
    // Il numero esatto è una scelta di design e cambia; il vincolo che conta è
    // che le due misure coincidano, altrimenti i blocchi scivolano rispetto
    // alle righe delle ore.
    expect(pxPerMinute(30) * 60).toBe(HOUR_HEIGHT[30]);
  });
});
