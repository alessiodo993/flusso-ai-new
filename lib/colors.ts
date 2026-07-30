/**
 * I colori dei progetti sono l'unica eccezione ai token del design system:
 * arrivano dal database e vanno resi così come sono. Tutto il resto passa
 * dalle CSS variables.
 */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Palette proposta alla creazione di un progetto: coerente col tema, ma non
 * timida.
 *
 * Ogni valore regge **testo bianco al 4.5:1**, che è il modo in cui questi
 * colori vengono davvero usati: sfondo pieno dei blocchi sul calendario, con
 * il titolo sopra. Tutti stanno sopra il 4.85, con un margine voluto sulla
 * soglia perché `blockSurface` non debba intervenire scurendoli.
 *
 * Rispetto ai primi valori la saturazione è più alta di circa un terzo, e la
 * luminosità è stata riportata giù quel tanto che serve a tenere il margine:
 * otto tinte spente si distinguono male fra loro proprio dove serve
 * distinguerle, cioè in un blocco alto trenta pixel visto di sfuggita.
 */
export const PROJECT_COLORS = [
  "#39724e", // verde bosco (accento)
  "#4c7599", // blu polvere
  "#9e632a", // cuoio
  "#90537c", // prugna
  "#427a75", // verde acqua
  "#a85540", // terracotta
  "#686d90", // ardesia
  "#6a7733", // oliva
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0];

/**
 * Il primo colore della tavolozza che nessun progetto sta già usando.
 *
 * Serve perché il default fisso era il primo della lista: due progetti creati
 * di fila nascevano **dello stesso verde**, e il colore — che sul calendario è
 * l'unico modo di riconoscere a chi appartiene un blocco — non distingueva
 * niente finché non lo si cambiava a mano. Chi crea un progetto pensa al nome,
 * non alla tinta.
 *
 * Esaurita la tavolozza si riparte dal principio: otto progetti attivi con
 * otto colori diversi sono già più di quanti si distinguano a colpo d'occhio,
 * e a quel punto ripetere è meno peggio che inventare una tinta fuori sistema.
 */
export function nextDistinctColor(
  used: Array<string | null | undefined>,
): string {
  /*
   * Si contano le occorrenze, non si raccolgono in un insieme: un `Set`
   * perde i doppioni, e senza doppioni «il meno usato» è indistinguibile da
   * «usato una volta». Con la tavolozza esaurita la funzione ricadeva sempre
   * sul primo colore, cioè proprio sul difetto che deve evitare.
   */
  const counts = new Map<string, number>(
    PROJECT_COLORS.map((color) => [color, 0]),
  );

  for (const value of used) {
    if (typeof value !== "string" || !HEX.test(value.trim())) continue;
    const color = safeColor(value);
    if (counts.has(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  // Il primo con zero occorrenze; se non ce n'è, il meno usato in assoluto.
  let best = PROJECT_COLORS[0] as string;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const color of PROJECT_COLORS) {
    const count = counts.get(color) ?? 0;
    if (count === 0) return color;
    if (count < bestCount) {
      bestCount = count;
      best = color;
    }
  }
  return best;
}

/**
 * Il colore di ripiego per un calendario Google senza colore proprio.
 *
 * **Non** è il verde di Flusso, ed è la differenza che conta: con il default
 * dei progetti, un calendario non ancora configurato si presentava esattamente
 * del colore dei blocchi decisi da te. Un blu freddo dice «viene da fuori»
 * prima ancora che si legga il titolo.
 */
export const EXTERNAL_COLOR = "#4c7599";

/** Come `safeColor`, ma per i calendari: ripiega sul colore «esterno». */
export function safeCalendarColor(value: string | null | undefined): string {
  if (typeof value !== "string" || !HEX.test(value.trim())) {
    return EXTERNAL_COLOR;
  }
  return safeColor(value);
}

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

/**
 * Lo sfondo di un evento Google: **opaco**, non una velatura.
 *
 * La differenza è tutta qui. Una velatura al 14% assume il colore di ciò che
 * ha sotto, e sotto c'è la fascia di picco: un evento tenue su una fascia
 * tenue diventava una macchia sola, senza inizio né fine. Un colore pieno
 * sopra la superficie del tema, invece, si stacca sempre — dalla fascia, dalle
 * ore fuori orario, da qualunque cosa venga aggiunta domani.
 *
 * Resta comunque **tenue**: il colore pieno è la firma dei blocchi decisi da
 * te. Un evento che subisci si distingue per la forma — superficie chiara,
 * barra laterale colorata — non per l'intensità.
 */
export function eventSurface(
  value: string | null | undefined,
  dimmed = false,
): string {
  return tintedSurface(safeCalendarColor(value), dimmed ? 0.08 : 0.17);
}

/**
 * Lo sfondo di un blocco già fatto: spento, ma **opaco** anche lui.
 *
 * Era una velatura al 22%, cioè la stessa tecnica degli eventi Google, e ne
 * seguiva lo stesso guaio al quadrato: un task completato sopra la fascia di
 * picco assumeva il colore della fascia *ed* era indistinguibile da una
 * riunione. Restano due segnali a separarli: qui il riempimento è più deciso e
 * non c'è cornice — i blocchi di Flusso sono forme piene, gli eventi che
 * subisci sono schede con un bordo.
 */
export function doneSurface(value: string | null | undefined): string {
  return tintedSurface(safeColor(value), 0.3);
}

/** Una tinta stesa sopra la superficie del tema: il risultato è opaco. */
function tintedSurface(hex: string, alpha: number): string {
  const tint = withAlpha(hex, alpha);
  return `linear-gradient(${tint}, ${tint}), var(--surface)`;
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
  return (id && GOOGLE_EVENT_COLORS[id]) || EXTERNAL_COLOR;
}
