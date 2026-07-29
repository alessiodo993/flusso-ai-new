import { describe, expect, it } from "vitest";

import {
  BACKUP_VERSION,
  backupFilename,
  buildBackup,
  parseBackup,
  summarize,
} from "./backup";
import type { Project, Task, UserSettings } from "./types";

const SETTINGS = {
  user_id: "u1",
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as UserSettings;

const PROJECT = {
  id: "p1",
  user_id: "u1",
  name: "Tesi",
  color: "#3f6b4f",
  deadline: null,
  archived: false,
  sort_order: 1,
  created_at: "2026-07-01T00:00:00Z",
} as Project;

const EMPTY = {
  settings: null,
  projects: [],
  tasks: [],
  ideas: [],
  okrs: [],
  blocks: [],
  recurring: [],
};

describe("buildBackup", () => {
  it("toglie le colonne che non hanno senso altrove", () => {
    const backup = buildBackup({ ...EMPTY, settings: SETTINGS, projects: [PROJECT] });

    expect(backup.projects[0]).not.toHaveProperty("user_id");
    expect(backup.projects[0]).not.toHaveProperty("created_at");
    expect(backup.settings).not.toHaveProperty("user_id");
    expect(backup.settings).not.toHaveProperty("updated_at");
    // Quello che serve resta.
    expect(backup.projects[0]).toMatchObject({ id: "p1", name: "Tesi" });
    expect(backup.settings).toMatchObject({ work_start: 480 });
  });

  it("non modifica le righe che riceve", () => {
    buildBackup({ ...EMPTY, projects: [PROJECT] });
    expect(PROJECT.user_id).toBe("u1");
  });

  it("dichiara versione e momento dell'export", () => {
    const backup = buildBackup(EMPTY);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("parseBackup", () => {
  it("rilegge quello che ha scritto", () => {
    const original = buildBackup({
      ...EMPTY,
      settings: SETTINGS,
      projects: [PROJECT],
      tasks: [{ id: "t1", title: "Scrivere" } as Task],
    });

    const parsed = parseBackup(JSON.stringify(original));
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.tasks[0]).toMatchObject({ id: "t1" });
    expect(parsed.settings).toMatchObject({ work_start: 480 });
  });

  it("rifiuta un file che non è JSON", () => {
    expect(() => parseBackup("<html>")).toThrowError(/non è un JSON valido/);
  });

  it("rifiuta un JSON che non è un export di Flusso", () => {
    expect(() => parseBackup('{"foo":1}')).toThrowError(/export di Flusso/);
    expect(() => parseBackup("[1,2,3]")).toThrowError(/export di Flusso/);
    expect(() => parseBackup("null")).toThrowError(/export di Flusso/);
  });

  it("rifiuta un export più recente dell'app", () => {
    expect(() => parseBackup(`{"version":${BACKUP_VERSION + 1}}`)).toThrowError(
      /versione più recente/,
    );
  });

  it("regge le sezioni mancanti o del tipo sbagliato", () => {
    const parsed = parseBackup(`{"version":1,"tasks":"non un array"}`);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.projects).toEqual([]);
    expect(parsed.settings).toBeNull();
  });

  it("scarta le voci che non sono oggetti", () => {
    const parsed = parseBackup(`{"version":1,"tasks":[{"id":"t1"},null,42,[]]}`);
    expect(parsed.tasks).toHaveLength(1);
  });
});

describe("summarize", () => {
  it("conta quello che sta per entrare", () => {
    const backup = parseBackup(
      `{"version":1,"projects":[{"id":"p1"}],"tasks":[{"id":"t1"},{"id":"t2"}]}`,
    );

    expect(summarize(backup)).toEqual({
      progetti: 1,
      task: 2,
      idee: 0,
      obiettivi: 0,
      impegni: 0,
      ricorrenze: 0,
    });
  });
});

describe("backupFilename", () => {
  it("mette la data davanti, così l'ordine alfabetico è cronologico", () => {
    expect(backupFilename(new Date("2026-07-29T22:10:00Z"))).toBe(
      "flusso-2026-07-29.json",
    );
  });
});
