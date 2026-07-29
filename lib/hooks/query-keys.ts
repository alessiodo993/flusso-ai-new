import type { DayISO } from "@/lib/time";

/**
 * Le chiavi delle query stanno tutte qui: le invalidazioni devono essere
 * mirate, e per esserlo bisogna poter vedere l'albero in un colpo d'occhio.
 */
export const qk = {
  projects: ["projects"] as const,
  ideas: ["ideas"] as const,
  tasks: ["tasks"] as const,
  settings: ["settings"] as const,
  okrs: (quarter: string) => ["okrs", quarter] as const,
  okrsAll: ["okrs"] as const,
  blocks: ["blocks"] as const,
  recurring: ["recurring"] as const,
  focusSessions: ["focus-sessions"] as const,
  calibration: ["calibration"] as const,
  reviews: (day: DayISO) => ["reviews", day] as const,
  googleAccounts: ["google", "accounts"] as const,
  googleCalendars: ["google", "calendars"] as const,
  googleEvents: (from: DayISO, to: DayISO) =>
    ["google", "events", from, to] as const,
};
