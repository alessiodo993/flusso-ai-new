"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { qk } from "@/lib/hooks/query-keys";
import { replaceById, useOptimisticMutation } from "@/lib/hooks/use-optimistic";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDaysISO, todayISO, type DayISO } from "@/lib/time";
import type { GoogleAccount, GoogleCalendar, GoogleEvent } from "@/lib/types";

/** La stessa finestra della sincronizzazione: un mese indietro, tre avanti. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 90;

function eventWindow(): { from: DayISO; to: DayISO } {
  const today = todayISO();
  return { from: addDaysISO(today, -PAST_DAYS), to: addDaysISO(today, FUTURE_DAYS) };
}

/**
 * Gli account collegati, letti dalla vista che espone stato ed email ma mai i
 * token: quelli non hanno alcun permesso per `authenticated`.
 */
export function useGoogleAccounts() {
  const query = useQuery({
    queryKey: qk.googleAccounts,
    queryFn: async (): Promise<GoogleAccount[]> => {
      const { data, error } = await supabaseBrowser()
        .from("google_accounts_public")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const accounts = useMemo(() => query.data ?? [], [query.data]);
  const needReconnect = useMemo(
    () => accounts.filter((account) => account.needs_reconnect),
    [accounts],
  );

  return { ...query, accounts, needReconnect };
}

export function useGoogleCalendars() {
  const query = useQuery({
    queryKey: qk.googleCalendars,
    queryFn: async (): Promise<GoogleCalendar[]> => {
      const { data, error } = await supabaseBrowser()
        .from("google_calendars")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const calendars = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars],
  );
  const enabled = useMemo(
    () => calendars.filter((calendar) => calendar.enabled),
    [calendars],
  );

  return { ...query, calendars, byId, enabled };
}

export function useUpdateGoogleCalendar() {
  return useOptimisticMutation<
    { id: string } & Partial<
      Pick<GoogleCalendar, "enabled" | "color" | "is_write_target">
    >,
    GoogleCalendar,
    GoogleCalendar[]
  >({
    key: qk.googleCalendars,
    errorMessage: "Non è stato possibile aggiornare il calendario.",
    async mutationFn({ id, ...changes }) {
      const supabase = supabaseBrowser();

      // Il calendario di destinazione è uno solo: l'indice unico rifiuterebbe
      // il secondo, quindi va liberato prima di assegnarlo.
      if (changes.is_write_target) {
        const { error: clearError } = await supabase
          .from("google_calendars")
          .update({ is_write_target: false })
          .neq("id", id);
        if (clearError) throw clearError;
      }

      const { data, error } = await supabase
        .from("google_calendars")
        .update(changes)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    optimistic(current, { id, ...changes }) {
      return current?.map((calendar) => {
        if (calendar.id === id) return { ...calendar, ...changes };
        if (changes.is_write_target) {
          return { ...calendar, is_write_target: false };
        }
        return calendar;
      });
    },
  });
}

/** Gli eventi in cache, già raggruppati per giorno. */
export function useGoogleEvents() {
  const { from, to } = eventWindow();

  const query = useQuery({
    queryKey: qk.googleEvents(from, to),
    queryFn: async (): Promise<GoogleEvent[]> => {
      const { data, error } = await supabaseBrowser()
        .from("google_events")
        .select("*")
        .gte("day", from)
        .lte("day", to)
        .order("start_minute", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = useMemo(() => query.data ?? [], [query.data]);

  const byDay = useMemo(() => {
    const map = new Map<DayISO, GoogleEvent[]>();
    for (const event of events) {
      const list = map.get(event.day);
      if (list) list.push(event);
      else map.set(event.day, [event]);
    }
    return map;
  }, [events]);

  return { ...query, events, byDay };
}

/** Spunta locale su un evento Google: non viene mai scritta su Google. */
export function useToggleGoogleEventDone() {
  const { from, to } = eventWindow();

  return useOptimisticMutation<
    { id: string; done: boolean },
    void,
    GoogleEvent[]
  >({
    key: qk.googleEvents(from, to),
    errorMessage: "Non è stato possibile aggiornare l'evento.",
    async mutationFn({ id, done }) {
      const { error } = await supabaseBrowser()
        .from("google_events")
        .update({ local_done: done })
        .eq("id", id);
      if (error) throw error;
    },
    optimistic(current, { id, done }) {
      return replaceById(current, id, (event) => ({
        ...event,
        local_done: done,
      }));
    },
  });
}

/** Chiede al server di sincronizzare, e ricarica ciò che ne dipende. */
export function useGoogleSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/google/sync", { method: "POST" });
      const body = (await response.json()) as {
        eventi?: number;
        errori?: Array<{ calendario: string; errore: string }>;
        errore?: string;
      };
      if (!response.ok) throw new Error(body.errore ?? "Sincronizzazione non riuscita.");
      return body;
    },
    onSuccess(body) {
      void queryClient.invalidateQueries({ queryKey: ["google"] });

      // Gli errori arrivano per calendario: uno rotto non deve far sembrare
      // fallito tutto il resto.
      for (const failure of body.errori ?? []) {
        toast.error(`${failure.calendario}: ${failure.errore}`);
      }
      if ((body.errori ?? []).length === 0) {
        toast.success(`Calendari aggiornati: ${body.eventi ?? 0} eventi.`);
      }
    },
    onError(error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Sincronizzazione non riuscita.",
      );
    },
  });
}

/**
 * Riflette un task sul calendario di destinazione. È volutamente silenziosa:
 * la scrittura in uscita è un effetto collaterale della pianificazione, non
 * un'azione dell'utente, e non deve produrre un toast per ogni spostamento.
 */
export function usePushTaskToGoogle() {
  return useCallback(async (taskId: string) => {
    try {
      await fetch("/api/google/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
    } catch {
      // Il prossimo spostamento riproverà: l'operazione è idempotente.
    }
  }, []);
}
