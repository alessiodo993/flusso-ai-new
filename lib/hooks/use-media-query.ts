"use client";

import { useEffect, useState } from "react";

/**
 * Il layout lo decide il CSS, non JavaScript. Questo hook serve solo dove il
 * *comportamento* cambia — menu contestuale contro action sheet, zoom di
 * default del calendario — e per questo parte da `false`: al primo render il
 * server non sa nulla dello schermo, e fingere di saperlo produrrebbe una
 * differenza di idratazione.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** La stessa soglia del layout a due colonne. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1080px)");
}

/**
 * Vero su un dispositivo senza puntatore fine. Distingue i gesti — long-press
 * invece di tasto destro — meglio della sola larghezza dello schermo: un
 * tablet grande resta touch.
 */
export function useIsTouch(): boolean {
  return useMediaQuery("(hover: none) and (pointer: coarse)");
}
