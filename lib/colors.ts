/**
 * I colori dei progetti sono l'unica eccezione ai token del design system:
 * arrivano dal database e vanno resi così come sono. Tutto il resto passa
 * dalle CSS variables.
 */

/** Palette proposta alla creazione di un progetto: tenue, coerente col tema. */
export const PROJECT_COLORS = [
  "#3f6b4f", // verde bosco (accento)
  "#5b7c99", // blu polvere
  "#a4713f", // cuoio
  "#8a5b7a", // prugna
  "#4f7d78", // verde acqua
  "#9a5a4a", // terracotta
  "#6b6f8a", // ardesia
  "#7d8a4a", // oliva
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
 * inchiostro su quelli chiari. Serve a garantire il contrasto sui blocchi del
 * calendario, dove il colore lo sceglie l'utente.
 */
export function readableInk(hex: string): string {
  return luminance(hex) > 0.45 ? "#1d2b22" : "#ffffff";
}

/**
 * Mappa un colore progetto sul `colorId` di Google Calendar, che accetta solo
 * una tavolozza fissa. Sceglie l'id più vicino in distanza euclidea RGB.
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

export function toGoogleColorId(hex: string): string {
  const [r, g, b] = channels(hex);
  let best = "10";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [id, candidate] of Object.entries(GOOGLE_EVENT_COLORS)) {
    const [cr, cg, cb] = channels(candidate);
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

/** Il colore esadecimale di un `colorId` Google, per il default dei calendari. */
export function fromGoogleColorId(id: string | null | undefined): string {
  return (id && GOOGLE_EVENT_COLORS[id]) || DEFAULT_PROJECT_COLOR;
}
