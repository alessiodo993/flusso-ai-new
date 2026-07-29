"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Distingue il clic singolo dal doppio sullo stesso elemento.
 *
 * Sul titolo di un task il clic singolo apre la scheda e il doppio rinomina:
 * senza questa attesa il primo dei due clic aprirebbe sempre la scheda,
 * rendendo la rinomina irraggiungibile. È un errore già commesso in passato,
 * e questo hook esiste per non rifarlo in ogni card.
 */
export function useClickOrDouble(
  onSingle: () => void,
  onDouble: () => void,
  delay = 220,
) {
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      // Il secondo clic di un doppio arriva già marcato: lasciamo fare a lui.
      if (event.detail > 1) return;
      clear();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onSingle();
      }, delay);
    },
    [clear, delay, onSingle],
  );

  const onDoubleClick = useCallback(() => {
    clear();
    onDouble();
  }, [clear, onDouble]);

  return { onClick, onDoubleClick };
}
