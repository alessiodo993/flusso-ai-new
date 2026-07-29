"use client";

import { useQuery } from "@tanstack/react-query";

import { qk } from "@/lib/hooks/query-keys";
import { useOptimisticMutation } from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { UserSettings } from "@/lib/types";

/**
 * Valori usati finché le impostazioni non sono arrivate. Coincidono con i
 * default della migrazione: l'interfaccia non deve mai mostrare una giornata
 * lavorativa vuota mentre carica.
 */
export const FALLBACK_SETTINGS: UserSettings = {
  user_id: "",
  work_start: 480,
  work_end: 1200,
  theme: "auto",
  peak_hours_start: "09:00:00",
  peak_hours_end: "12:00:00",
  low_hours_start: null,
  low_hours_end: null,
  buffer_minutes: 10,
  micro_start_minutes: 10,
  daily_cap_minutes: 360,
  google_write_enabled: false,
  created_at: "",
  updated_at: "",
};

async function fetchSettings(): Promise<UserSettings> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  /*
   * La riga la crea il trigger alla registrazione. Se manca — account creato
   * prima della migrazione, o trigger non installato — la creiamo qui invece
   * di lasciare l'app senza impostazioni.
   */
  const { data: created, error: insertError } = await supabase
    .from("user_settings")
    .insert({})
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

export function useSettings() {
  const query = useQuery({
    queryKey: qk.settings,
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
  });

  return { ...query, settings: query.data ?? FALLBACK_SETTINGS };
}

export function useUpdateSettings() {
  return useOptimisticMutation<
    Partial<Omit<UserSettings, "user_id" | "created_at" | "updated_at">>,
    UserSettings,
    UserSettings
  >({
    key: qk.settings,
    errorMessage: "Non è stato possibile salvare le impostazioni.",
    async mutationFn(changes) {
      const supabase = supabaseBrowser();
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) throw new Error("Sessione scaduta. Accedi di nuovo.");

      const { data, error } = await supabase
        .from("user_settings")
        .update(changes)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    optimistic(current, changes) {
      return current ? { ...current, ...changes } : current;
    },
  });
}
