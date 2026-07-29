"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { qk } from "@/lib/hooks/query-keys";
import { FALLBACK_SETTINGS } from "@/lib/hooks/use-settings";
import { addDaysISO, todayISO } from "@/lib/time";
import type { Idea, Project, Task } from "@/lib/types";

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
    ];

    const ideas: Idea[] = [
      idea("i1", "Un capitolo sul metodo di calibrazione", "p1", 1),
      idea("i2", "Vista annuale degli OKR", "p2", 2),
      idea("i3", "Cambiare le gomme prima dell'inverno", "p3", 3),
      idea("i4", "Rileggere gli appunti di gennaio", null, 4),
    ];

    queryClient.setQueryData(qk.projects, projects);
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
