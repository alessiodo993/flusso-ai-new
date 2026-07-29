import type {
  FixedBlock,
  Idea,
  Okr,
  Project,
  Recurring,
  Task,
  UserSettings,
} from "@/lib/types";

/**
 * Export e import in JSON.
 *
 * Il punto non è il backup tecnico — di quello si occupa Supabase — ma il
 * poter portare via i propri dati. Per questo il formato è leggibile a
 * occhio e non contiene gli id utente: un file esportato da un account deve
 * poter rientrare in un altro senza portarsi dietro chi era il proprietario.
 */

export const BACKUP_VERSION = 1;

export type Backup = {
  version: number;
  exportedAt: string;
  settings: Partial<UserSettings> | null;
  projects: Project[];
  tasks: Task[];
  ideas: Idea[];
  okrs: Okr[];
  blocks: FixedBlock[];
  recurring: Recurring[];
};

/** Le colonne che non hanno senso fuori dal database di partenza. */
const DROP = ["user_id", "created_at", "updated_at"] as const;

function clean<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const key of DROP) delete copy[key as keyof T];
  return copy;
}

export function buildBackup(data: {
  settings: UserSettings | null;
  projects: Project[];
  tasks: Task[];
  ideas: Idea[];
  okrs: Okr[];
  blocks: FixedBlock[];
  recurring: Recurring[];
}): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: data.settings ? clean(data.settings) : null,
    projects: data.projects.map(clean),
    tasks: data.tasks.map(clean),
    ideas: data.ideas.map(clean),
    okrs: data.okrs.map(clean),
    blocks: data.blocks.map(clean),
    recurring: data.recurring.map(clean),
  };
}

export type BackupSummary = {
  progetti: number;
  task: number;
  idee: number;
  obiettivi: number;
  impegni: number;
  ricorrenze: number;
};

export function summarize(backup: Backup): BackupSummary {
  return {
    progetti: backup.projects.length,
    task: backup.tasks.length,
    idee: backup.ideas.length,
    obiettivi: backup.okrs.length,
    impegni: backup.blocks.length,
    ricorrenze: backup.recurring.length,
  };
}

/**
 * Legge un file esportato.
 *
 * Un file scelto per sbaglio — un JSON qualsiasi, un export di un'altra app —
 * deve fallire **qui**, con un messaggio, e non a metà importazione con
 * mezzo database già sovrascritto.
 */
export function parseBackup(raw: string): Backup {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Questo file non è un JSON valido.");
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("Questo file non contiene un export di Flusso.");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.version !== "number") {
    throw new Error("Questo file non contiene un export di Flusso.");
  }
  if (record.version > BACKUP_VERSION) {
    throw new Error(
      `Questo file arriva da una versione più recente di Flusso (v${record.version}). Aggiorna l'app prima di importarlo.`,
    );
  }

  return {
    version: record.version,
    exportedAt:
      typeof record.exportedAt === "string" ? record.exportedAt : "",
    settings:
      typeof record.settings === "object" && record.settings !== null
        ? (record.settings as Partial<UserSettings>)
        : null,
    projects: arrayOf<Project>(record.projects),
    tasks: arrayOf<Task>(record.tasks),
    ideas: arrayOf<Idea>(record.ideas),
    okrs: arrayOf<Okr>(record.okrs),
    blocks: arrayOf<FixedBlock>(record.blocks),
    recurring: arrayOf<Recurring>(record.recurring),
  };
}

function arrayOf<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (one) => typeof one === "object" && one !== null && !Array.isArray(one),
  ) as T[];
}

/** Il nome del file: la data prima, così l'ordine alfabetico è cronologico. */
export function backupFilename(now = new Date()): string {
  return `flusso-${now.toISOString().slice(0, 10)}.json`;
}
