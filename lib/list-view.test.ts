import { describe, expect, it } from "vitest";

import { NO_FILTERS } from "@/components/list/list-toolbar";
import { buildListGroups, countVisible, isListable } from "./list-view";
import type { Project, Task } from "./types";

const TODAY = "2026-07-29";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    user_id: "u1",
    title: overrides.id,
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
    sort_order: 0,
    created_at: "2026-07-01T00:00:00Z",
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

function project(id: string, name: string, sort: number): Project {
  return {
    id,
    user_id: "u1",
    name,
    color: "#3f6b4f",
    deadline: null,
    archived: false,
    sort_order: sort,
    created_at: "2026-07-01T00:00:00Z",
  };
}

const PROJECTS = [project("p1", "Tesi", 1), project("p2", "Casa", 2)];

describe("isListable", () => {
  it("tiene fuori chi è già sul calendario", () => {
    expect(isListable(task({ id: "a" }))).toBe(true);
    expect(isListable(task({ id: "b", day: TODAY }))).toBe(false);
  });

  it("tiene fuori archiviati e da rivedere", () => {
    expect(isListable(task({ id: "c", status_review: "archived" }))).toBe(false);
    // I «da rivedere» hanno la loro sezione in fondo: mostrarli anche qui
    // li farebbe comparire due volte.
    expect(isListable(task({ id: "d", status_review: "stale" }))).toBe(false);
  });
});

describe("raggruppamento per progetto", () => {
  const tasks = [
    task({ id: "a", project_id: "p2", deadline: "2026-08-10" }),
    task({ id: "b", project_id: "p1", deadline: "2026-08-01" }),
    task({ id: "c", project_id: null }),
    task({ id: "d", project_id: "p1", deadline: "2026-07-30" }),
  ];

  const groups = buildListGroups({
    tasks,
    projects: PROJECTS,
    sort: "progetto",
    filters: NO_FILTERS,
    today: TODAY,
  });

  it("segue l'ordine dei progetti e mette per ultimo chi non ne ha", () => {
    expect(groups.map((group) => group.label)).toEqual([
      "Tesi",
      "Casa",
      "Senza progetto",
    ]);
  });

  it("ordina per scadenza dentro ogni gruppo", () => {
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["d", "b"]);
  });

  it("non crea gruppi per i progetti senza task", () => {
    const only = buildListGroups({
      tasks: [task({ id: "x", project_id: "p1" })],
      projects: PROJECTS,
      sort: "progetto",
      filters: NO_FILTERS,
      today: TODAY,
    });
    expect(only).toHaveLength(1);
    expect(only[0].label).toBe("Tesi");
  });
});

describe("ordinamento per scadenza", () => {
  it("mette in fondo chi non ha scadenza, non in cima", () => {
    const groups = buildListGroups({
      tasks: [
        task({ id: "senza" }),
        task({ id: "tardi", deadline: "2026-09-01" }),
        task({ id: "presto", deadline: "2026-07-30" }),
      ],
      projects: PROJECTS,
      sort: "scadenza",
      filters: NO_FILTERS,
      today: TODAY,
    });

    expect(groups[0].tasks.map((t) => t.id)).toEqual([
      "presto",
      "tardi",
      "senza",
    ]);
  });
});

describe("ordinamento manuale", () => {
  it("rispetta il sort_order", () => {
    const groups = buildListGroups({
      tasks: [
        task({ id: "terzo", sort_order: 300 }),
        task({ id: "primo", sort_order: 100 }),
        task({ id: "secondo", sort_order: 200 }),
      ],
      projects: PROJECTS,
      sort: "manuale",
      filters: NO_FILTERS,
      today: TODAY,
    });

    expect(groups[0].tasks.map((t) => t.id)).toEqual([
      "primo",
      "secondo",
      "terzo",
    ]);
  });
});

describe("i completati scendono in fondo", () => {
  it("senza sparire dalla lista", () => {
    const groups = buildListGroups({
      tasks: [
        task({ id: "fatto", status: "done", deadline: "2026-07-01" }),
        task({ id: "aperto", deadline: "2026-09-01" }),
      ],
      projects: PROJECTS,
      sort: "scadenza",
      filters: NO_FILTERS,
      today: TODAY,
    });

    // «fatto» avrebbe la scadenza più vicina, ma è chiuso.
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["aperto", "fatto"]);
  });
});

describe("filtri", () => {
  const tasks = [
    task({ id: "scaduto", deadline: "2026-07-20", project_id: "p1" }),
    task({ id: "domani", deadline: "2026-07-30", energy: "alta" }),
    task({ id: "lontano", deadline: "2026-12-01" }),
    task({ id: "nudo" }),
  ];

  it("«in scadenza» tiene solo scadute, oggi e i due giorni dopo", () => {
    const groups = buildListGroups({
      tasks,
      projects: PROJECTS,
      sort: "scadenza",
      filters: { ...NO_FILTERS, deadlineSoon: true },
      today: TODAY,
    });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["scaduto", "domani"]);
  });

  it("filtra per progetto", () => {
    const groups = buildListGroups({
      tasks,
      projects: PROJECTS,
      sort: "scadenza",
      filters: { ...NO_FILTERS, projectId: "p1" },
      today: TODAY,
    });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["scaduto"]);
  });

  it("filtra per energia", () => {
    const groups = buildListGroups({
      tasks,
      projects: PROJECTS,
      sort: "scadenza",
      filters: { ...NO_FILTERS, energy: "alta" },
      today: TODAY,
    });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["domani"]);
  });

  it("combina più filtri in AND", () => {
    const groups = buildListGroups({
      tasks,
      projects: PROJECTS,
      sort: "scadenza",
      filters: { ...NO_FILTERS, deadlineSoon: true, energy: "alta" },
      today: TODAY,
    });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["domani"]);
  });

  it("senza risultati non produce gruppi vuoti", () => {
    expect(
      buildListGroups({
        tasks,
        projects: PROJECTS,
        sort: "progetto",
        filters: { ...NO_FILTERS, projectId: "p2" },
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("countVisible concorda con i gruppi", () => {
    const filters = { ...NO_FILTERS, deadlineSoon: true };
    const groups = buildListGroups({
      tasks,
      projects: PROJECTS,
      sort: "progetto",
      filters,
      today: TODAY,
    });
    const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);
    expect(countVisible(tasks, filters, TODAY)).toBe(total);
  });
});
