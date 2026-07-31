import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeCapture } from "@/lib/ai/capture";
import { askJson } from "@/lib/ai/client";
import {
  CAPTURE_SYSTEM,
  capturePrompt,
  OKR_SYSTEM,
  okrPrompt,
  PLAN_SYSTEM,
  planPrompt,
  SHUTDOWN_SYSTEM,
  shutdownPrompt,
} from "@/lib/ai/prompts";
import {
  captureSchema,
  okrSchema,
  planSchema,
  shutdownSchema,
} from "@/lib/ai/schemas";
import type { DayISO } from "@/lib/time";
import type { Okr, Project, Task } from "@/lib/types";

/**
 * Il banco di prova con il modello vero.
 *
 * Gli altri test dimostrano che il codice attorno al modello regge qualunque
 * risposta. Nessuno dimostra che le risposte siano **buone**: quella è una
 * proprietà dei prompt, e si misura solo chiamando davvero.
 *
 * Non gira con `npm test`: costa e ha bisogno di rete. Si lancia a mano con
 * `PROVA_AI=1 npx vitest run tests/ai-live.test.ts`.
 */

const attivo = process.env.PROVA_AI === "1";

if (attivo && !process.env.ANTHROPIC_API_KEY) {
  try {
    const env = readFileSync(".env.local", "utf8");
    const found = /^ANTHROPIC_API_KEY=(.*)$/m.exec(env)?.[1]?.trim();
    if (found) process.env.ANTHROPIC_API_KEY = found;
  } catch {
    // Senza .env.local la chiave deve arrivare dall'ambiente.
  }
}

const OGGI = "2026-07-31" as DayISO;

const progetti = [
  { id: "p1", name: "Tesi" },
  { id: "p2", name: "Casa" },
  { id: "p3", name: "Flusso" },
] as Project[];

const task = (one: Partial<Task> & { id: string; title: string }): Task =>
  ({
    project_id: null,
    deadline: null,
    est_minutes: null,
    energy: null,
    status: "todo",
    status_review: "active",
    is_daily_highlight: false,
    postpone_count: 0,
    subtasks: [],
    notes: "",
    ...one,
  }) as Task;

const esistenti: Task[] = [
  task({ id: "t1", title: "Scrivere il capitolo 3", project_id: "p1" }),
  task({ id: "t2", title: "Chiamare l'idraulico", project_id: "p2" }),
  task({ id: "t3", title: "Rivedere la bibliografia", project_id: "p1" }),
];

async function cattura(testo: string) {
  const raw = await askJson({
    schema: captureSchema,
    system: CAPTURE_SYSTEM,
    prompt: capturePrompt({
      text: testo,
      today: OGGI,
      projects: progetti,
      tasks: esistenti,
    }),
  });
  const proposte = normalizeCapture({ raw, projects: progetti, tasks: esistenti });
  console.log(`\n--- «${testo.slice(0, 60)}…»`);
  for (const one of proposte) {
    console.log(
      JSON.stringify({
        azione: one.action,
        titolo: one.title,
        taskId: one.taskId,
        progetto: progetti.find((p) => p.id === one.projectId)?.name ?? null,
        scadenza: one.deadline,
        stima: one.estMinutes,
        energia: one.energy,
        sottotask: one.subtasks,
        note: one.notes,
        motivo: one.reason,
      }),
    );
  }
  if (proposte.length === 0) console.log("(nessuna proposta)");
  return proposte;
}

describe.skipIf(!attivo)("cattura magica, con il modello vero", () => {
  it("una frase con due cose dentro le separa", { timeout: 60_000 }, async () => {
    const proposte = await cattura(
      "domani devo chiamare l'idraulico e finire la relazione, tipo due ore",
    );
    expect(proposte.length).toBeGreaterThanOrEqual(2);
  });

  it("una dettatura lunga e sconnessa", { timeout: 60_000 }, async () => {
    await cattura(
      "allora dunque devo ricordarmi di prenotare il volo per Berlino entro fine mese poi c'è la questione della tesi che devo finire il capitolo 3 credo mi serva tipo mezza giornata e comunque l'idraulico l'ho già chiamato quindi quello è fatto",
    );
  });

  it("una cosa grossa e vaga", { timeout: 60_000 }, async () => {
    await cattura(
      "devo organizzare la festa di compleanno di mia sorella sabato prossimo",
    );
  });

  it("una cosa senza tempi dichiarati", { timeout: 60_000 }, async () => {
    await cattura("bisogna che rifaccia il curriculum");
  });

  it("una frase senza niente di azionabile", { timeout: 60_000 }, async () => {
    const proposte = await cattura("che bella giornata, mi sento riposato");
    expect(proposte.length).toBe(0);
  });
});

describe.skipIf(!attivo)("planner", () => {
  it("sceglie e ordina", { timeout: 60_000 }, async () => {
    const candidati: Task[] = [
      task({
        id: "a",
        title: "Consegnare la relazione",
        project_id: "p1",
        deadline: "2026-08-01",
        est_minutes: 120,
        energy: "alta",
      }),
      task({
        id: "b",
        title: "Riordinare il garage",
        project_id: "p2",
        est_minutes: 90,
        energy: "bassa",
      }),
      task({
        id: "c",
        title: "Preparare la demo",
        project_id: "p3",
        est_minutes: 60,
        is_daily_highlight: true,
      }),
      task({
        id: "d",
        title: "Rispondere alle mail arretrate",
        est_minutes: 30,
        postpone_count: 4,
      }),
    ];

    const raw = await askJson({
      schema: planSchema,
      system: PLAN_SYSTEM,
      prompt: planPrompt({
        tasks: candidati,
        projects: progetti,
        days: ["2026-08-01", "2026-08-02"] as DayISO[],
        minutesAvailable: 180,
        coefficient: 1.3,
        behindProjects: ["Tesi"],
      }),
    });

    console.log("\n--- planner\n", JSON.stringify(raw, null, 2));
    const ids = (raw.scelte ?? []).map((one) => one.taskId);
    expect(ids.every((id) => ["a", "b", "c", "d"].includes(id))).toBe(true);
  });
});

describe.skipIf(!attivo)("analisi dei risultati chiave", () => {
  it("distingue misurabile da vago", { timeout: 60_000 }, async () => {
    const okr = {
      id: "o1",
      objective: "Chiudere la tesi senza arrivare in riserva",
      quarter: "2026-Q3",
      project_id: "p1",
      key_results: [
        { id: "k1", text: "Studiare di più", current: 0, target: 1, unit: "" },
        {
          id: "k2",
          text: "Consegnare 3 capitoli al relatore",
          current: 1,
          target: 3,
          unit: "capitoli",
        },
      ],
    } as Okr;

    const raw = await askJson({
      schema: okrSchema,
      system: OKR_SYSTEM,
      prompt: okrPrompt({ okr, project: progetti[0] }),
    });

    console.log("\n--- okr\n", JSON.stringify(raw, null, 2));
    const byId = new Map((raw.analisi ?? []).map((one) => [one.keyResultId, one]));
    expect(byId.get("k1")?.misurabile).toBe(false);
    expect(byId.get("k2")?.misurabile).toBe(true);
  });
});

describe.skipIf(!attivo)("shutdown", () => {
  it("propone orari dentro gli spazi liberi", { timeout: 60_000 }, async () => {
    const rimasti: Task[] = [
      task({ id: "x", title: "Finire le slide", est_minutes: 60, energy: "alta" }),
      task({ id: "y", title: "Archiviare le fatture", est_minutes: 30, energy: "bassa" }),
    ];

    const raw = await askJson({
      schema: shutdownSchema,
      system: SHUTDOWN_SYSTEM,
      prompt: shutdownPrompt({
        tasks: rimasti,
        projects: progetti,
        tomorrow: "2026-08-01" as DayISO,
        freeSlots: ["09:00–11:00", "15:00–16:00"],
      }),
    });

    console.log("\n--- shutdown\n", JSON.stringify(raw, null, 2));
    expect((raw.suggerimenti ?? []).length).toBeGreaterThan(0);
  });
});
