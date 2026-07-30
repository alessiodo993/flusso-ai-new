"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { qk } from "@/lib/hooks/query-keys";
import { FALLBACK_SETTINGS } from "@/lib/hooks/use-settings";
import { addDaysISO, todayISO } from "@/lib/time";
import { quarterOf } from "@/lib/time";
import type {
  FocusSession,
  GoogleAccount,
  GoogleCalendar,
  GoogleEvent,
  Idea,
  Okr,
  Project,
  Task,
} from "@/lib/types";

/**
 * Riempie la cache di TanStack Query con dati verosimili, senza toccare la
 * rete. Serve a guardare le sezioni piene — chip, semafori, raggruppamenti —
 * in sviluppo e negli screenshot di verifica. Non viene mai montato in
 * produzione: lo monta solo `/anteprima`, che in produzione non esiste.
 */
export function DemoData({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // Un solo riempimento, prima del primo render dei figli.
  const [ready] = useState(() => {
    const today = todayISO();

    const projects: Project[] = [
      row("p1", { name: "Tesi", color: "#3f6b4f", sort_order: 1 }),
      row("p2", { name: "Flusso", color: "#5b7c99", sort_order: 2 }),
      row("p3", { name: "Casa", color: "#a4713f", sort_order: 3 }),
    ].map((project) => ({
      deadline: null,
      archived: false,
      created_at: "",
      ...project,
    })) as Project[];

    const tasks: Task[] = [
      task("t1", {
        title: "Riscrivere il capitolo sui metodi",
        project_id: "p1",
        deadline: today,
        est_minutes: 90,
        energy: "alta",
        is_daily_highlight: true,
        highlight_date: today,
        subtasks: [
          { id: "s1", text: "Rileggere gli appunti", done: true },
          { id: "s2", text: "Scaletta", done: true },
          { id: "s3", text: "Prima stesura", done: false },
        ],
      }),
      task("t2", {
        title: "Rispondere al relatore",
        project_id: "p1",
        deadline: addDaysISO(today, 2),
        est_minutes: 25,
        energy: "bassa",
        postpone_count: 3,
      }),
      task("t3", {
        title: "Sistemare la sincronizzazione del calendario",
        project_id: "p2",
        est_minutes: 120,
        energy: "alta",
        deadline: addDaysISO(today, 9),
      }),
      task("t4", {
        title: "Provare il flusso di cattura a voce",
        project_id: "p2",
        est_minutes: 45,
      }),
      task("t5", {
        title: "Chiamare l'idraulico",
        project_id: "p3",
        deadline: addDaysISO(today, -2),
        est_minutes: 15,
        energy: "bassa",
      }),
      task("t6", { title: "Prenotare il treno", est_minutes: 15 }),
      task("t7", {
        title: "Archiviare le ricevute del trimestre",
        project_id: "p3",
        status: "done",
      }),

      // Giornata di oggi: un highlight, un blocco col buffer subito dopo,
      // due sovrapposti e uno già chiuso.
      task("t8", {
        title: "Deep work sul capitolo 3",
        project_id: "p1",
        day: today,
        start_minute: 540,
        est_minutes: 90,
        energy: "alta",
        is_daily_highlight: true,
        highlight_date: today,
      }),
      task("t9", {
        title: "Revisione delle note",
        project_id: "p1",
        day: today,
        start_minute: 640,
        est_minutes: 30,
        // Già rinviato due volte: spostarlo ancora avanti fa scattare l'attrito.
        postpone_count: 2,
      }),
      task("t10", {
        title: "Chiamata con il team",
        project_id: "p2",
        day: today,
        start_minute: 720,
        est_minutes: 60,
      }),
      task("t11", {
        title: "Preparare la demo",
        project_id: "p2",
        day: today,
        start_minute: 750,
        est_minutes: 60,
        energy: "media",
      }),
      task("t13", {
        title: "Leggere il paper sul metodo Delphi",
        project_id: "p1",
        created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        status_review: "stale",
      }),
      task("t12", {
        title: "Spesa",
        project_id: "p3",
        day: today,
        start_minute: 1020,
        est_minutes: 45,
        status: "done",
      }),
    ];

    const ideas: Idea[] = [
      idea("i1", "Un capitolo sul metodo di calibrazione", "p1", 1),
      idea("i2", "Vista annuale degli OKR", "p2", 2),
      idea("i3", "Cambiare le gomme prima dell'inverno", "p3", 3),
      idea("i4", "Rileggere gli appunti di gennaio", null, 4),
    ];

    // Dodici sessioni concluse, con una tendenza chiara a sottostimare:
    // servono a far comparire numeri veri in «Realtà vs Piano».
    const sessions: FocusSession[] = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      user_id: "demo",
      task_id: null,
      started_at: new Date(Date.now() - i * 86_400_000).toISOString(),
      ended_at: null,
      planned_minutes: 60,
      actual_minutes: [78, 90, 66, 84, 96, 72][i % 6],
      outcome: "completed" as const,
      was_micro_start: false,
      paused_seconds: 0,
      created_at: "",
    }));

    // Due obiettivi del trimestre corrente, uno indietro e uno in linea.
    const quarter = quarterOf(today);
    const okrs: Okr[] = [
      {
        id: "o1",
        user_id: "demo",
        project_id: "p1",
        quarter,
        objective: "Consegnare la prima stesura completa della tesi",
        created_at: "",
        key_results: [
          { id: "k1", text: "Capitoli scritti", current: 2, target: 6, unit: "capitoli" },
          { id: "k2", text: "Fonti schedate", current: 18, target: 60, unit: "fonti" },
          { id: "k3", text: "Revisioni col relatore", current: 1, target: 4, unit: "incontri" },
        ],
      },
      {
        id: "o2",
        user_id: "demo",
        project_id: "p2",
        quarter,
        objective: "Portare Flusso al primo uso quotidiano",
        created_at: "",
        key_results: [
          { id: "k4", text: "Giornate pianificate di seguito", current: 9, target: 30, unit: "giorni" },
          { id: "k5", text: "Sezioni finite", current: 8, target: 13, unit: "sezioni" },
        ],
      },
    ];

    /*
     * Due account Google, di cui uno scaduto: senza, il pannello Google resta
     * nello stato vuoto e non si vedono né «Aggiungi account» né il banner di
     * riconnessione — cioè proprio i due punti in cui il collegamento si è
     * rotto.
     */
    const googleAccounts: GoogleAccount[] = [
      {
        id: "ga1",
        user_id: "demo",
        email: "alessio@esempio.it",
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
        token_expires_at: null,
        needs_reconnect: false,
        created_at: "",
      },
      {
        id: "ga2",
        user_id: "demo",
        email: "alessio@lavoro.esempio.it",
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
        token_expires_at: null,
        needs_reconnect: true,
        created_at: "",
      },
    ];

    const googleCalendars: GoogleCalendar[] = [
      cal("gc1", "ga1", "Personale", "#5b7c99", true, true),
      cal("gc2", "ga1", "Compleanni", "#8a5b7a", false, false),
      cal("gc3", "ga2", "Team", "#9a5a4a", true, false),
    ];

    /*
     * Gli eventi Google mancavano del tutto, e la mancanza non era innocua:
     * l'anteprima è ciò su cui girano gli script di accessibilità e le
     * verifiche a schermo, quindi il blocco «evento che subisci» non è mai
     * stato guardato da nessuno dei due. Uno cade dentro la fascia di picco
     * apposta: è lì che le tre categorie rischiano di confondersi.
     */
    const googleEvents: GoogleEvent[] = [
      event("ge1", "gc1", "Dentista", today, 630, 690),
      event("ge2", "gc3", "Riunione di reparto", today, 900, 960),
      event("ge3", "gc1", "Compleanno di Marta", today, 0, 1440, {
        allDay: true,
      }),
      event("ge4", "gc3", "Retrospettiva", addDaysISO(today, 1), 960, 1020),
    ];

    queryClient.setQueryData(qk.googleAccounts, googleAccounts);
    queryClient.setQueryData(qk.googleCalendars, googleCalendars);
    queryClient.setQueryData(
      qk.googleEvents(addDaysISO(today, -30), addDaysISO(today, 90)),
      googleEvents,
    );
    queryClient.setQueryData(qk.okrs(quarter), okrs);
    queryClient.setQueryData(qk.projects, projects);
    queryClient.setQueryData(qk.focusSessions, sessions);
    queryClient.setQueryData(qk.calibration, tasks);
    queryClient.setQueryData(qk.tasks, tasks);
    queryClient.setQueryData(qk.ideas, ideas);
    queryClient.setQueryData(qk.settings, FALLBACK_SETTINGS);
    return true;
  });

  return ready ? <>{children}</> : null;
}

function row(id: string, rest: Record<string, unknown>) {
  return { id, user_id: "demo", ...rest };
}

function idea(
  id: string,
  title: string,
  projectId: string | null,
  order: number,
): Idea {
  return {
    id,
    user_id: "demo",
    title,
    project_id: projectId,
    sort_order: order,
    created_at: "",
  };
}

function task(id: string, overrides: Partial<Task>): Task {
  return {
    id,
    user_id: "demo",
    title: id,
    notes: "",
    status: "inbox",
    day: null,
    start_minute: null,
    est_minutes: null,
    energy: null,
    project_id: null,
    deadline: null,
    subtasks: [],
    recur_id: null,
    sort_order: Number(id.slice(1)) * 100,
    created_at: "",
    postpone_count: 0,
    last_postponed_at: null,
    actual_duration_minutes: null,
    is_daily_highlight: false,
    highlight_date: null,
    first_planned_at: null,
    status_review: "active",
    google_event_id: null,
    ...overrides,
  };
}

/** Un calendario Google finto, con i campi che il pannello legge davvero. */
function event(
  id: string,
  calendarId: string,
  title: string,
  day: string,
  startMinute: number,
  endMinute: number,
  extra: { allDay?: boolean; done?: boolean } = {},
): GoogleEvent {
  return {
    id,
    user_id: "demo",
    calendar_id: calendarId,
    google_event_id: `${id}@google.com`,
    title,
    day,
    start_minute: startMinute,
    end_minute: endMinute,
    all_day: extra.allDay ?? false,
    local_done: extra.done ?? false,
    updated_at: "",
    created_at: "",
  };
}

function cal(
  id: string,
  accountId: string,
  name: string,
  color: string,
  enabled: boolean,
  writeTarget: boolean,
): GoogleCalendar {
  return {
    id,
    user_id: "demo",
    account_id: accountId,
    google_calendar_id: `${id}@group.calendar.google.com`,
    name,
    color,
    enabled,
    is_write_target: writeTarget,
    sync_token: null,
    last_synced_at: null,
    created_at: "",
    channel_id: null,
    channel_resource_id: null,
    channel_expires_at: null,
  };
}
