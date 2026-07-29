/** Chiave in localStorage: la preferenza grezza, che può valere "auto". */
export const THEME_KEY = "flusso:theme";

export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Gira inline nel <head>, prima del primo paint. Traduce la preferenza in un
 * `data-theme` concreto su <html>, così il CSS non deve mai gestire "auto".
 */
export const THEME_BOOTSTRAP = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_KEY)})||"auto";
var d=window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme=(p==="dark"||(p==="auto"&&d))?"dark":"light";
}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Applica una preferenza risolvendola contro il sistema. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved: ResolvedTheme =
    preference === "dark" || (preference === "auto" && prefersDark)
      ? "dark"
      : "light";
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

/** Legge la preferenza salvata, con ripiego su "auto". */
export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  } catch {
    // localStorage non disponibile: resta "auto".
  }
  return "auto";
}

/** Salva la preferenza e la applica subito. */
export function storeThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Preferenza non persistita: il tema resta comunque applicato.
  }
  applyTheme(preference);
}
