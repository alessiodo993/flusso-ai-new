import { DAY_MINUTES, overlaps, type MinuteRange } from "@/lib/time";

/**
 * Disposizione dei blocchi in una giornata.
 *
 * Sta qui e non nel componente perché è aritmetica pura — quale blocco sta
 * accanto a quale, e quanto è largo — ed è esattamente il genere di calcolo
 * che sbaglia in silenzio: un blocco sovrapposto che scompare sotto un altro
 * non produce nessun errore, solo un'ora di lavoro che sparisce dalla vista.
 */

export type Placed<T> = {
  item: T;
  start: number;
  end: number;
  /** Colonna occupata dentro il gruppo di blocchi sovrapposti. */
  column: number;
  /** Quante colonne ha il gruppo: insieme a `column` dà larghezza e offset. */
  columns: number;
};

/**
 * Assegna una colonna a ogni blocco, come fa Google Calendar: i blocchi che
 * si sovrappongono si dividono la larghezza, quelli che non si toccano la
 * usano tutta.
 */
export function layoutOverlaps<T>(
  items: Array<{ item: T; start: number; end: number }>,
): Array<Placed<T>> {
  const sorted = items
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: Array<Placed<T>> = [];

  // Un gruppo è un insieme di blocchi legati a catena da sovrapposizioni:
  // A tocca B e B tocca C mette anche A e C nella stessa griglia, altrimenti
  // le larghezze non tornerebbero.
  let group: Array<Placed<T>> = [];
  let groupEnd = -1;

  const closeGroup = () => {
    if (group.length === 0) return;
    const columns = Math.max(...group.map((entry) => entry.column)) + 1;
    for (const entry of group) entry.columns = columns;
    placed.push(...group);
    group = [];
    groupEnd = -1;
  };

  for (const candidate of sorted) {
    if (group.length > 0 && candidate.start >= groupEnd) closeGroup();

    // La prima colonna libera fra quelle già usate nel gruppo.
    const taken = new Set(
      group
        .filter((entry) => overlaps(entry, candidate))
        .map((entry) => entry.column),
    );
    let column = 0;
    while (taken.has(column)) column += 1;

    group.push({ ...candidate, column, columns: 1 });
    groupEnd = Math.max(groupEnd, candidate.end);
  }

  closeGroup();
  return placed;
}

export type BufferStrip = { start: number; end: number };

/**
 * Le pause fra un blocco e il successivo, fino a `bufferMinutes`.
 *
 * La specifica chiede che il buffer sia **spazio dedicato e visibile**, non un
 * vuoto anonimo: un quarto d'ora fra due blocchi non è tempo libero da
 * riempire, è il tempo che serve per passare dall'uno all'altro.
 */
export function bufferStrips(
  ranges: MinuteRange[],
  bufferMinutes: number,
): BufferStrip[] {
  if (bufferMinutes <= 0) return [];

  const sorted = ranges.slice().sort((a, b) => a.start - b.start);
  const strips: BufferStrip[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gapStart = sorted[i].end;
    const gapEnd = sorted[i + 1].start;
    const gap = gapEnd - gapStart;
    // Solo le pause brevi: mezz'ora di buco è tempo libero, non un buffer.
    if (gap > 0 && gap <= bufferMinutes) {
      strips.push({ start: gapStart, end: gapEnd });
    }
  }

  return strips;
}

/**
 * La finestra oraria da disegnare: l'orario di lavoro, allargato quanto basta
 * a far entrare ciò che è stato pianificato fuori da esso. Un blocco alle
 * sette di sera non deve sparire solo perché la giornata è impostata fino
 * alle sei.
 */
export function visibleWindow({
  workStart,
  workEnd,
  ranges,
}: {
  workStart: number;
  workEnd: number;
  ranges: MinuteRange[];
}): MinuteRange {
  let start = workStart;
  let end = workEnd;

  for (const range of ranges) {
    if (range.start < start) start = range.start;
    if (range.end > end) end = range.end;
  }

  // Si arrotonda all'ora piena, così le etichette restano allineate.
  start = Math.max(0, Math.floor(start / 60) * 60);
  end = Math.min(DAY_MINUTES, Math.ceil(end / 60) * 60);

  // Una finestra degenere renderebbe una griglia alta zero pixel.
  if (end - start < 120) end = Math.min(DAY_MINUTES, start + 120);

  return { start, end };
}

/** Altezza in pixel di un'ora, per ciascun livello di zoom. */
/*
 * Alzate insieme alla scala tipografica: erano 176/112/72, misurate su un
 * testo più piccolo. Con i corpi nuovi un blocco da mezz'ora al minimo zoom
 * stringeva titolo e orario fino a farli sbattere contro i bordi.
 */
export const HOUR_HEIGHT: Record<number, number> = {
  15: 200,
  30: 128,
  60: 84,
};

export const ZOOMS = [15, 30, 60] as const;
export type Zoom = (typeof ZOOMS)[number];

/** Quanti pixel vale un minuto al livello di zoom indicato. */
export function pxPerMinute(zoom: Zoom): number {
  return HOUR_HEIGHT[zoom] / 60;
}
