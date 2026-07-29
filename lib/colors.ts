/**
 * I colori dei progetti sono l'unica eccezione ai token del design system:
 * arrivano dal database e vanno resi così come sono. Tutto il resto passa
 * dalle CSS variables.
 */

/**
 * Palette proposta alla creazione di un progetto: tenue, coerente col tema.
 *
 * Ogni valore regge **testo bianco al 4.5:1**, che è il modo in cui questi
 * colori vengono davvero usati: sfondo pieno dei blocchi sul calendario, con
 * il titolo sopra. Tre dei valori originali stavano sotto la soglia (blu
 * 4.39, cuoio 4.19, oliva 3.75) e sono stati scuriti quel poco che serve —
 * la tinta si riconosce ancora, il titolo si legge anche fuori al sole.
 */
export const PROJECT_COLORS = [
  "#3f6b4f", // verde bosco (accento)
  "#577793", // blu polvere
  "#9d6c3c", // cuoio
  "#8a5b7a", // prugna
  "#4f7d78", // verde acqua
  "#9a5a4a", // terracotta
  "#6b6f8a", // ardesia
  "#6f7a41", // oliva
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalizza un colore utente, con ripiego sul colore di default. */
export function safeColor(value: string | null | undefined): string {
  if (typeof value !== "string" || !HEX.test(value.trim())) {
    return DEFAULT_PROJECT_COLOR;
  }
  const hex = value.trim().toLowerCase();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

function channels(hex: string): [number, number, number] {
  const c = safeColor(hex);
  return [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
}

/** Colore con trasparenza, per gli sfondi tenui degli eventi Google. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Luminanza relativa secondo WCAG. */
function luminance(hex: string): number {
  const srgb = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Il testo da mettere sopra un blocco a colore pieno: bianco sui colori scuri,
 * inchiostro su quelli chiari.
 *
 * La soglia sceglie fra i due, ma **non garantisce da sola** il 4.5:1: un
 * colore di mezza luminanza non lo raggiunge in nessuna delle due direzioni.
 * Per quello serve `blockSurface`, che scurisce lo sfondo quanto basta.
 */
export function readableInk(hex: string): string {
  return luminance(hex) > 0.45 ? "#1d2b22" : "#ffffff";
}

/** Contrasto WCAG fra due colori opachi. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Soglia AA per il testo normale. I titoli dei blocchi sono 13px: normale. */
const AA = 4.5;

/**
 * Lo sfondo da usare per un blocco a colore pieno, abbastanza scuro perché il
 * testo sopra si legga.
 *
 * I colori dei progetti arrivano dal database e possono essere qualunque cosa:
 * la palette proposta è già conforme, ma un colore scelto prima di questa
 * regola — o incollato a mano — no. Invece di rifiutarlo o di sostituirlo con
 * un colore diverso, si scurisce la stessa tinta a passi del 4% fino a
 * superare la soglia: il progetto resta riconoscibile e il titolo leggibile.
 */
export function blockSurface(hex: string): string {
  const base = safeColor(hex);
  const ink = readableInk(base);
  if (contrastRatio(ink, base) >= AA) return base;

  const [r, g, b] = channels(base);
  let factor = 0.96;

  // Venti passi coprono anche il bianco pieno; oltre non serve andare.
  for (let i = 0; i < 20; i += 1) {
    const candidate = toHex(r * factor, g * factor, b * factor);
    if (contrastRatio("#ffffff", candidate) >= AA) return candidate;
    factor *= 0.96;
  }
  return "#3f4a43";
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Mappa un colore progetto sul `colorId` di Google Calendar, che accetta solo
 * una tavolozza fissa.
 *
 * Il criterio è la **tinta**, non la distanza RGB. La distanza euclidea
 * sembra la scelta ovvia e sbaglia in modo visibile: il verde bosco di Flusso
 * (`#3f6b4f`) ha come vicino numerico il **grigio** di Google, perché è più
 * spento dei verdi saturi della tavolozza. Sul calendario condiviso il
 * progetto risulterebbe grigio, cioè privo dell'unica informazione che quel
 * colore doveva trasmettere.
 */
const GOOGLE_EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

/** L'id del grigio di Google: la scelta giusta solo per i colori senza tinta. */
const GOOGLE_GREY = "8";

export function toGoogleColorId(hex: string): string {
  const source = hsl(safeColor(hex));

  // Sotto il 12% di saturazione la tinta non significa niente: è un grigio,
  // e va nel grigio.
  if (source.s < 0.12) return GOOGLE_GREY;

  let best = "10";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const [id, candidate] of Object.entries(GOOGLE_EVENT_COLORS)) {
    if (id === GOOGLE_GREY) continue;

    const target = hsl(candidate);
    // La differenza di tinta domina; la luminosità fa da spareggio fra due
    // candidati della stessa famiglia (il verde chiaro e quello scuro).
    const score = hueDistance(source.h, target.h) + Math.abs(source.l - target.l) * 30;

    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** Distanza fra due tinte sul cerchio: 350° e 10° sono vicini. */
function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = channels(hex).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  return { h: ((h * 60) % 360 + 360) % 360, s, l };
}

/** Il colore esadecimale di un `colorId` Google, per il default dei calendari. */
export function fromGoogleColorId(id: string | null | undefined): string {
  return (id && GOOGLE_EVENT_COLORS[id]) || DEFAULT_PROJECT_COLOR;
}
