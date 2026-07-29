import { describe, expect, it } from "vitest";

import { fmtClock } from "./use-focus-timer";

describe("fmtClock", () => {
  it("scrive minuti e secondi con due cifre", () => {
    expect(fmtClock(0)).toBe("00:00");
    expect(fmtClock(9)).toBe("00:09");
    expect(fmtClock(65)).toBe("01:05");
    expect(fmtClock(1500)).toBe("25:00");
  });

  it("aggiunge le ore solo quando servono", () => {
    expect(fmtClock(3599)).toBe("59:59");
    expect(fmtClock(3600)).toBe("1:00:00");
    expect(fmtClock(7325)).toBe("2:02:05");
  });

  it("non mostra mai un tempo negativo", () => {
    expect(fmtClock(-30)).toBe("00:00");
  });
});
