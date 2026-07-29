/**
 * Ordinamento manuale con chiavi frazionarie: spostare un elemento riscrive
 * una sola riga, non tutta la lista. È ciò che rende il riordino trascinabile
 * istantaneo anche con l'aggiornamento ottimistico.
 */

const GAP = 1000;

/** Un valore che sta fra i due vicini. Estremi assenti = inizio o fine lista. */
export function orderBetween(
  before: number | null | undefined,
  after: number | null | undefined,
): number {
  if (before == null && after == null) return Date.now();
  if (before == null) return (after as number) - GAP;
  if (after == null) return before + GAP;
  return (before + after) / 2;
}

/**
 * Ricalcola il `sort_order` di un elemento spostato in una lista già ordinata.
 * `toIndex` è la posizione finale, come la intende `arrayMove`.
 */
export function orderForMove(
  ordered: Array<{ sort_order: number }>,
  fromIndex: number,
  toIndex: number,
): number {
  const without = ordered.filter((_, index) => index !== fromIndex);
  const before = without[toIndex - 1]?.sort_order ?? null;
  const after = without[toIndex]?.sort_order ?? null;
  return orderBetween(before, after);
}

/**
 * Le chiavi frazionarie si avvicinano a ogni spostamento. Oltre una certa
 * soglia i double non distinguono più due vicini: qui si riconosce il caso,
 * così il chiamante può riscrivere la lista con valori nuovi.
 */
export function needsRebalance(
  ordered: Array<{ sort_order: number }>,
): boolean {
  for (let i = 1; i < ordered.length; i += 1) {
    const gap = ordered[i].sort_order - ordered[i - 1].sort_order;
    if (gap > 0 && gap < 1e-6) return true;
  }
  return false;
}

/** Valori equidistanti per ricostruire un ordinamento degenerato. */
export function rebalanced<T extends { sort_order: number }>(
  ordered: T[],
): T[] {
  return ordered.map((item, index) => ({
    ...item,
    sort_order: (index + 1) * GAP,
  }));
}
