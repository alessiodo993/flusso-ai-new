"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Quante card mostrare prima di chiedere «ne vuoi altre?».
 *
 * Il calendario non ha bisogno di virtualizzazione — le sue righe sono al
 * massimo 96 su una giornata intera a zoom 15, misurate — ma una Lista sì:
 * quella cresce senza limite, e con qualche centinaio di task ogni tasto
 * premuto nel filtro ricalcolerebbe qualche migliaio di nodi.
 *
 * Il taglio è preferibile a una finestra scorrevole: una lista virtualizzata
 * rompe `Ctrl+F` del browser e la selezione del testo, e qui il caso d'uso
 * non è scorrere mille task ma trovarne uno — cosa che si fa coi filtri.
 */
export const PAGE = 150;

export function useVisibleLimit(total: number, page = PAGE) {
  const [limit, setLimit] = useState(page);

  const showMore = useCallback(
    () => setLimit((current) => current + page),
    [page],
  );

  // Se i filtri cambiano e restano meno elementi del limite, il pulsante
  // deve sparire da sé senza che nessuno lo azzeri a mano.
  const hidden = Math.max(0, total - limit);

  return useMemo(
    () => ({ limit, hidden, showMore, next: Math.min(page, hidden) }),
    [hidden, limit, page, showMore],
  );
}
