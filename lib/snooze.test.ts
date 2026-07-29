import { describe, expect, it } from "vitest";

import {
  canSnooze,
  MAX_SNOOZES,
  snoozesUsed,
  withoutSnoozes,
  withSnooze,
  type SnoozeLog,
} from "./snooze";

const OGGI = "2026-07-29";
const IERI = "2026-07-28";

describe("il conteggio dei micro-rinvii", () => {
  it("parte da zero e si può rimandare due volte", () => {
    let log: SnoozeLog = {};
    expect(snoozesUsed(log, OGGI, "t1")).toBe(0);
    expect(canSnooze(log, OGGI, "t1")).toBe(true);

    log = withSnooze(log, OGGI, "t1");
    expect(canSnooze(log, OGGI, "t1")).toBe(true);

    log = withSnooze(log, OGGI, "t1");
    expect(snoozesUsed(log, OGGI, "t1")).toBe(MAX_SNOOZES);
    // Alla terza il quarto d'ora non è più un imprevisto.
    expect(canSnooze(log, OGGI, "t1")).toBe(false);
  });

  it("conta ogni task per suo conto", () => {
    let log: SnoozeLog = {};
    log = withSnooze(log, OGGI, "t1");
    log = withSnooze(log, OGGI, "t1");

    expect(canSnooze(log, OGGI, "t1")).toBe(false);
    expect(canSnooze(log, OGGI, "t2")).toBe(true);
  });

  it("ricomincia ogni giorno", () => {
    let log: SnoozeLog = {};
    log = withSnooze(log, IERI, "t1");
    log = withSnooze(log, IERI, "t1");

    // Lo stesso task, il giorno dopo: si riparte.
    expect(canSnooze(log, OGGI, "t1")).toBe(true);
  });

  it("non tiene i giorni passati", () => {
    // Nessuno svuota il localStorage: il registro deve potarsi da sé.
    let log: SnoozeLog = { [IERI]: { t1: 2 } };
    log = withSnooze(log, OGGI, "t2");

    expect(Object.keys(log)).toEqual([OGGI]);
  });

  it("un micro-avvio concluso ripulisce quel task", () => {
    let log: SnoozeLog = {};
    log = withSnooze(log, OGGI, "t1");
    log = withSnooze(log, OGGI, "t1");
    log = withSnooze(log, OGGI, "t2");

    log = withoutSnoozes(log, OGGI, "t1");

    // Chi ha lavorato dieci minuti si è guadagnato di poter rimandare ancora.
    expect(canSnooze(log, OGGI, "t1")).toBe(true);
    // E non tocca gli altri.
    expect(snoozesUsed(log, OGGI, "t2")).toBe(1);
  });

  it("azzerare un task mai rimandato non rompe niente", () => {
    expect(withoutSnoozes({}, OGGI, "t1")).toEqual({ [OGGI]: {} });
  });
});
