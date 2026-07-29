"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  applyTheme,
  readThemePreference,
  storeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme-script";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Alterna chiaro/scuro uscendo da "auto" alla prima pressione. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lo script inline ha già scritto data-theme: qui allineiamo solo lo state.
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = readThemePreference();
    setPreferenceState(stored);
    setResolved(applyTheme(stored));
  }, []);

  // Con la preferenza su "auto" seguiamo il sistema anche a runtime.
  useEffect(() => {
    if (preference !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("auto"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storeThemePreference(next);
    setResolved(
      next === "auto"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next,
    );
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  return (
    <ThemeContext.Provider
      value={{ preference, resolved, setPreference, toggle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme richiede ThemeProvider");
  return context;
}
