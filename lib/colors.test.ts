import { describe, expect, it } from "vitest";

import {
  blockSurface,
  contrastRatio,
  DEFAULT_PROJECT_COLOR,
  fromGoogleColorId,
  PROJECT_COLORS,
  readableInk,
  safeColor,
  toGoogleColorId,
  withAlpha,
} from "./colors";

/** La soglia AA per il testo normale, che è quello dei titoli dei blocchi. */
const AA = 4.5;

describe("safeColor", () => {
  it("normalizza le forme valide", () => {
    expect(safeColor("#ABCDEF")).toBe("#abcdef");
    expect(safeColor("  #3f6b4f ")).toBe("#3f6b4f");
    expect(safeColor("#abc")).toBe("#aabbcc");
  });

  it("ripiega sul colore di default su tutto il resto", () => {
    for (const bad of ["rosso", "", "#12345", "rgb(0,0,0)", null, undefined]) {
      expect(safeColor(bad)).toBe(DEFAULT_PROJECT_COLOR);
    }
  });
});

describe("contrastRatio", () => {
  it("dà gli estremi noti", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("è simmetrico", () => {
    expect(contrastRatio("#3f6b4f", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#3f6b4f"),
      5,
    );
  });
});

describe("la palette", () => {
  it("regge il testo bianco su ogni colore", () => {
    // È così che vengono usati: sfondo pieno del blocco, titolo sopra.
    for (const color of PROJECT_COLORS) {
      expect(
        contrastRatio("#ffffff", color),
        `${color} non regge il bianco`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("non ha doppioni", () => {
    expect(new Set(PROJECT_COLORS).size).toBe(PROJECT_COLORS.length);
  });
});

describe("blockSurface", () => {
  it("lascia intatti i colori che già bastano", () => {
    for (const color of PROJECT_COLORS) {
      expect(blockSurface(color)).toBe(color);
    }
  });

  it("scurisce quelli che non bastano", () => {
    // I tre valori scartati dalla palette originale: sotto la soglia col bianco.
    for (const weak of ["#5b7c99", "#a4713f", "#7d8a4a"]) {
      const surface = blockSurface(weak);
      expect(surface).not.toBe(weak);
      expect(
        contrastRatio(readableInk(surface), surface),
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("regge anche i colori chiarissimi", () => {
    for (const light of ["#ffffff", "#fffde7", "#e8f5e9"]) {
      const surface = blockSurface(light);
      expect(
        contrastRatio(readableInk(surface), surface),
        `${light} → ${surface}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("qualunque colore diventa leggibile", () => {
    // Un giro grossolano su tutto lo spazio: nessuna combinazione deve
    // uscire dalla funzione con un testo illeggibile sopra.
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          const surface = blockSurface(hex);
          expect(
            contrastRatio(readableInk(surface), surface),
            `${hex} → ${surface}`,
          ).toBeGreaterThanOrEqual(AA);
        }
      }
    }
  });

  it("non cambia la tinta più del necessario", () => {
    // Lo scurimento è a passi del 4%: il blu resta blu.
    const surface = blockSurface("#5b7c99");
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(surface.slice(i, i + 2), 16),
    );
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  it("sui colori invalidi si comporta come sul default", () => {
    expect(blockSurface("non un colore")).toBe(
      blockSurface(DEFAULT_PROJECT_COLOR),
    );
  });
});

describe("withAlpha", () => {
  it("scrive un rgba leggibile", () => {
    expect(withAlpha("#3f6b4f", 0.14)).toBe("rgba(63, 107, 79, 0.14)");
  });

  it("limita l'alpha all'intervallo valido", () => {
    expect(withAlpha("#000000", 5)).toBe("rgba(0, 0, 0, 1)");
    expect(withAlpha("#000000", -2)).toBe("rgba(0, 0, 0, 0)");
  });
});

describe("colori Google", () => {
  it("mappa per tinta, non per distanza numerica", () => {
    // Il verde bosco deve finire nel verde: in distanza euclidea il suo
    // vicino più prossimo è il grigio, ed è il difetto che questo test
    // difende.
    expect(toGoogleColorId("#3f6b4f")).toBe("10");
    expect(fromGoogleColorId("10")).toBe("#0b8043");
  });

  it("manda ogni tinta nella sua famiglia", () => {
    const family = (hex: string) => fromGoogleColorId(toGoogleColorId(hex));

    expect(family("#5b7c99")).toMatch(/#039be5|#7986cb|#3f51b5/); // blu
    expect(family("#9c1a1a")).toBe("#d50000"); // rosso
    expect(family("#8a5b7a")).toBe("#8e24aa"); // prugna → viola
    expect(family("#c98a1e")).toMatch(/#f6bf26|#f4511e/); // ambra
  });

  it("i grigi vanno nel grigio", () => {
    for (const grey of ["#767676", "#2b2b2b", "#e0e0e0"]) {
      expect(toGoogleColorId(grey)).toBe("8");
    }
  });

  it("distingue il verde chiaro da quello scuro", () => {
    expect(toGoogleColorId("#0f5c33")).toBe("10");
    expect(toGoogleColorId("#5fd39b")).toBe("2");
  });

  it("su un id sconosciuto ripiega sul default", () => {
    expect(fromGoogleColorId("99")).toBe(DEFAULT_PROJECT_COLOR);
    expect(fromGoogleColorId(null)).toBe(DEFAULT_PROJECT_COLOR);
  });
});
