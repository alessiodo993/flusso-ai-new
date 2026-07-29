import { describe, expect, it } from "vitest";

import {
  needsRebalance,
  orderBetween,
  orderForMove,
  rebalanced,
} from "./sort-order";

describe("orderBetween", () => {
  it("si mette in mezzo ai due vicini", () => {
    expect(orderBetween(100, 200)).toBe(150);
  });

  it("va prima del primo o dopo l'ultimo", () => {
    expect(orderBetween(null, 100)).toBeLessThan(100);
    expect(orderBetween(100, null)).toBeGreaterThan(100);
  });

  it("regge la lista vuota", () => {
    expect(Number.isFinite(orderBetween(null, null))).toBe(true);
  });
});

describe("orderForMove", () => {
  const list = [
    { sort_order: 100 },
    { sort_order: 200 },
    { sort_order: 300 },
    { sort_order: 400 },
  ];

  it("colloca l'elemento fra i suoi nuovi vicini", () => {
    // Il primo scende di un posto: [200, 100, 300, 400], quindi fra 200 e 300.
    expect(orderForMove(list, 0, 1)).toBe(250);
  });

  it("usa gli indici come li intende arrayMove, sulla lista già senza l'elemento", () => {
    // Il primo va al terzo posto: [200, 300, 100, 400], quindi fra 300 e 400.
    expect(orderForMove(list, 0, 2)).toBe(350);
  });

  it("sposta in cima", () => {
    expect(orderForMove(list, 3, 0)).toBeLessThan(100);
  });

  it("sposta in fondo", () => {
    expect(orderForMove(list, 0, 3)).toBeGreaterThan(400);
  });

  it("non conta l'elemento spostato fra i propri vicini", () => {
    // Muovendo il secondo di un posto in giù finisce fra 300 e 400, non 200.
    expect(orderForMove(list, 1, 2)).toBe(350);
  });
});

describe("rebilanciamento", () => {
  it("non serve su una lista sana", () => {
    expect(needsRebalance([{ sort_order: 1 }, { sort_order: 2 }])).toBe(false);
  });

  it("si accorge quando due chiavi si sono avvicinate troppo", () => {
    expect(
      needsRebalance([{ sort_order: 1 }, { sort_order: 1 + 1e-9 }]),
    ).toBe(true);
  });

  it("ridistribuisce mantenendo l'ordine", () => {
    const before = [
      { id: "a", sort_order: 1 },
      { id: "b", sort_order: 1 + 1e-9 },
      { id: "c", sort_order: 2 },
    ];
    const after = rebalanced(before);

    expect(after.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(needsRebalance(after)).toBe(false);
  });
});

describe("spostamenti ripetuti", () => {
  it("un elemento trascinato più volte resta dove lo si è messo", () => {
    let list = [
      { id: "a", sort_order: 1000 },
      { id: "b", sort_order: 2000 },
      { id: "c", sort_order: 3000 },
    ];

    // Porta "c" in cima, poi "a" in fondo, poi "b" in mezzo.
    for (const [id, to] of [
      ["c", 0],
      ["a", 2],
      ["b", 1],
    ] as const) {
      const from = list.findIndex((item) => item.id === id);
      const sort = orderForMove(list, from, to);
      const moved = { ...list[from], sort_order: sort };
      list = list
        .filter((item) => item.id !== id)
        .concat(moved)
        .sort((a, b) => a.sort_order - b.sort_order);
    }

    expect(list.map((item) => item.id)).toEqual(["c", "b", "a"]);
  });
});
