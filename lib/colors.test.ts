import { describe, expect, it } from "vitest";

import {
  blockSurface,
  contrastRatio,
  DEFAULT_PROJECT_COLOR,
  doneSurface,
  EXTERNAL_COLOR,
  eventSurface,
  fromGoogleColorId,
  nextDistinctColor,
  PROJECT_COLORS,
  readableInk,
  safeCalendarColor,
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

  it("tiene un margine sopra la soglia", () => {
    // Con il minimo esatto `blockSurface` interverrebbe a scurire, e la
    // saturazione appena guadagnata se ne andrebbe subito.
    for (const color of PROJECT_COLORS) {
      expect(contrastRatio("#ffffff", color)).toBeGreaterThan(4.8);
    }
  });

  it("non ha doppioni", () => {
    expect(new Set(PROJECT_COLORS).size).toBe(PROJECT_COLORS.length);
  });
});

describe("nextDistinctColor", () => {
  it("dà il primo colore libero della tavolozza", () => {
    expect(nextDistinctColor([])).toBe(PROJECT_COLORS[0]);
    expect(nextDistinctColor([PROJECT_COLORS[0]])).toBe(PROJECT_COLORS[1]);
    expect(nextDistinctColor([PROJECT_COLORS[1], PROJECT_COLORS[0]])).toBe(
      PROJECT_COLORS[2],
    );
  });

  it("**due progetti di fila non nascono dello stesso colore**", () => {
    // È il difetto che questa funzione esiste per impedire: il default era
    // fisso sul primo della lista, e sul calendario il colore è l'unico modo
    // di riconoscere a chi appartiene un blocco.
    const primo = nextDistinctColor([]);
    const secondo = nextDistinctColor([primo]);
    expect(secondo).not.toBe(primo);
  });

  it("ignora i valori non validi invece di sprecare un colore", () => {
    expect(nextDistinctColor([null, undefined, "verde", ""])).toBe(
      PROJECT_COLORS[0],
    );
  });

  it("riconosce lo stesso colore scritto in modo diverso", () => {
    expect(nextDistinctColor([PROJECT_COLORS[0].toUpperCase()])).toBe(
      PROJECT_COLORS[1],
    );
  });

  it("esaurita la tavolozza riparte, senza inventare tinte", () => {
    const tutti = [...PROJECT_COLORS];
    const scelto = nextDistinctColor(tutti);
    expect(PROJECT_COLORS).toContain(scelto);
  });

  it("con la tavolozza esaurita sceglie il meno usato", () => {
    // Tutti presi una volta, il primo due: il ciclo riprende dal secondo.
    const scelto = nextDistinctColor([...PROJECT_COLORS, PROJECT_COLORS[0]]);
    expect(scelto).not.toBe(PROJECT_COLORS[0]);
  });
});

describe("eventSurface", () => {
  it("**è opaco: la superficie del tema sta sotto la tinta**", () => {
    // È l'invariante che tiene separate le tre categorie del calendario. Con
    // una velatura semplice, un evento Google finito dentro la fascia di picco
    // ne assumeva il colore e i due diventavano una macchia sola.
    const background = eventSurface("#8e24aa");
    expect(background).toContain("var(--surface)");
    expect(background).toContain("rgba(142, 36, 170, 0.17)");
  });

  it("l'evento spuntato si smorza, non sparisce", () => {
    expect(eventSurface("#8e24aa", true)).toContain("0.08");
  });

  it("senza colore usa quello esterno, mai il verde di Flusso", () => {
    const background = eventSurface(null);
    expect(background).toContain(withAlpha(EXTERNAL_COLOR, 0.17));
    expect(background).not.toContain(withAlpha(DEFAULT_PROJECT_COLOR, 0.17));
  });
});

describe("doneSurface", () => {
  it("**è opaco: un task fatto non prende il colore di ciò che ha sotto**", () => {
    const background = doneSurface("#39724e");
    expect(background).toContain("var(--surface)");
  });

  it("riempie più di un evento Google, che è ciò che li distingue", () => {
    // Stessa tinta, due ruoli: il blocco fatto resta una forma piena, l'evento
    // resta una scheda. Se le due opacità si avvicinassero, l'unico segnale
    // rimasto sarebbe la cornice.
    const fatto = Number(/, ([\d.]+)\)/.exec(doneSurface("#39724e"))?.[1]);
    const evento = Number(/, ([\d.]+)\)/.exec(eventSurface("#39724e"))?.[1]);
    expect(fatto).toBeGreaterThan(evento);
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

  it("**ripiega sul colore esterno, non su quello di Flusso**", () => {
    // Con il default dei progetti un calendario Google senza colore proprio
    // risultava dello stesso verde dei blocchi decisi dall'utente: le due
    // categorie che il calendario deve tenere distinte diventavano identiche.
    expect(fromGoogleColorId("99")).toBe(EXTERNAL_COLOR);
    expect(fromGoogleColorId(null)).toBe(EXTERNAL_COLOR);
    expect(EXTERNAL_COLOR).not.toBe(DEFAULT_PROJECT_COLOR);
  });
});

describe("safeCalendarColor", () => {
  it("tiene il colore del calendario quando c'è", () => {
    expect(safeCalendarColor("#8e24aa")).toBe("#8e24aa");
  });

  it("su un colore assente o malformato dà quello esterno", () => {
    expect(safeCalendarColor(null)).toBe(EXTERNAL_COLOR);
    expect(safeCalendarColor("verde")).toBe(EXTERNAL_COLOR);
  });
});
