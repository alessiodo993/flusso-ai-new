import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Unisce classi condizionali risolvendo i conflitti Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Vero quando il codice gira nel browser. */
export const isBrowser = typeof window !== "undefined";

/** Un id opaco per sottotask e proposte AI, senza dipendenze esterne. */
export function uid(): string {
  if (isBrowser && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Riporta un numero dentro un intervallo. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Vibrazione breve sul pickup e sul drop, dove il dispositivo la supporta. */
export function haptic(ms = 15): void {
  if (isBrowser && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
}
