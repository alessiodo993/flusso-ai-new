import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normalizeCapture, captureContext, mergePatch } from "./capture";
import { AiError, parseJson } from "./client";
import {
  keepOrFail,
  sift,
  toAction,
  toDeadline,
  toEnergy,
  toEstimate,
  toText,
  captureSchema,
  type CaptureProposal,
} from "./schemas";
import type { Project, Task } from "@/lib/types";

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

const PROJECTS: Project[] = [
  {
    id: "p1",
    user_id: "u1",
    name: "Tesi",
    color: "#3f6b4f",
    deadline: null,
    archived: false,
    sort_order: 1,
    created_at: "2026-07-01T00:00:00Z",
  },
];

const TASKS = [task({ id: "t1", title: "Rivedere il capitolo 2" })];

describe("parseJson", () => {
  const schema = z.object({ a: z.number() });

  it("legge un oggetto pulito", () => {
    expect(parseJson(schema, '{"a":1}')).toEqual({ a: 1 });
  });

  it("scarta il preambolo e la coda", () => {
    expect(parseJson(schema, 'Certo, ecco:\n{"a":1}\nSpero sia utile!')).toEqual({
      a: 1,
    });
  });

  it("sopravvive alle graffe dentro le stringhe", () => {
    const schema = z.object({ titolo: z.string() });
    expect(parseJson(schema, '{"titolo":"rivedi {bozza}"} e basta')).toEqual({
      titolo: "rivedi {bozza}",
    });
  });

  it("prende il primo oggetto, non tutto fino all'ultima graffa", () => {
    const schema = z.object({ a: z.number() });
    expect(parseJson(schema, '{"a":1} poi {"a":2}')).toEqual({ a: 1 });
  });

  it("**se il primo oggetto non ha la forma giusta, prova il successivo**", () => {
    // Capita che il modello scriva un esempio prima della risposta vera.
    // Fermarsi al primo significava dichiarare illeggibile un output che
    // conteneva, due righe più sotto, esattamente ciò che serviva.
    const schema = z.object({ a: z.number() });
    expect(parseJson(schema, 'tipo {"b":0} ma in realtà {"a":7}')).toEqual({
      a: 7,
    });
  });

  it("dice che l'output non è valido invece di lanciare a caso", () => {
    expect(() => parseJson(schema, "non è JSON")).toThrowError(AiError);
    expect(() => parseJson(schema, '{"a":')).toThrowError(AiError);
    // Forma sbagliata: il JSON è valido ma non è quello che serve.
    expect(() => parseJson(schema, '{"b":1}')).toThrowError(AiError);

    try {
      parseJson(schema, "niente");
    } catch (error) {
      expect((error as AiError).kind).toBe("invalid_output");
      expect((error as AiError).status).toBe(502);
    }
  });
});

describe("normalizzazione dei valori", () => {
  it("riconosce le azioni, anche coniugate diversamente", () => {
    expect(toAction("crea")).toBe("crea");
    expect(toAction("Eliminare")).toBe("elimina");
    expect(toAction("merge")).toBe("unisci");
    // Un verbo inventato non deve diventare una cancellazione.
    expect(toAction("archivia")).toBe("crea");
    expect(toAction(null)).toBe("crea");
  });

  it("accetta solo i livelli di energia esistenti", () => {
    expect(toEnergy("Alta")).toBe("alta");
    expect(toEnergy("molto alta")).toBeNull();
    expect(toEnergy(undefined)).toBeNull();
  });

  it("clampa le stime invece di rifiutarle", () => {
    expect(toEstimate(37)).toBe(35);
    expect(toEstimate(2)).toBe(5);
    expect(toEstimate(9000)).toBe(480);
    expect(toEstimate(0)).toBeNull();
    expect(toEstimate(null)).toBeNull();
  });

  it("tiene solo le date che esistono davvero", () => {
    expect(toDeadline("2026-08-01")).toBe("2026-08-01");
    expect(toDeadline("2026-08-01T10:00:00Z")).toBe("2026-08-01");
    expect(toDeadline("2026-02-31")).toBeNull();
    expect(toDeadline("01/08/2026")).toBeNull();
    expect(toDeadline("domani")).toBeNull();
  });

  it("accorcia i testi lunghi senza tagliarli a metà parola", () => {
    expect(toText("  due   spazi  ", 100)).toBe("due spazi");
    expect(toText("abcdefghij", 5)).toBe("abcd…");
    expect(toText(null, 10)).toBe("");
  });
});

describe("normalizeCapture", () => {
  const base = { projects: PROJECTS, tasks: TASKS };

  /** Le sole proposte utilizzabili: gli scarti si contano a parte. */
  const capture = (input: Parameters<typeof normalizeCapture>[0]) =>
    normalizeCapture(input).items;

  it("costruisce una proposta di creazione completa", () => {
    const [proposal] = capture({
      ...base,
      raw: {
        proposte: [
          {
            azione: "crea",
            titolo: "Preparare la presentazione",
            progetto: "tesi",
            scadenza: "2026-08-03",
            stimaMinuti: 90,
            energia: "alta",
            sottotask: ["outline", "  ", "slide"],
            motivo: "citato esplicitamente",
          },
        ],
      },
    });

    expect(proposal).toMatchObject({
      action: "crea",
      title: "Preparare la presentazione",
      taskId: null,
      projectId: "p1",
      deadline: "2026-08-03",
      estMinutes: 90,
      energy: "alta",
      subtasks: ["outline", "slide"],
    });
  });

  it("scarta i progetti inventati invece di crearli", () => {
    const [proposal] = capture({
      ...base,
      raw: { proposte: [{ azione: "crea", titolo: "x", progetto: "Inesistente" }] },
    });

    expect(proposal.projectId).toBeNull();
  });

  it("rifiuta unisci, completa ed elimina senza un task che esiste", () => {
    const proposals = capture({
      ...base,
      raw: {
        proposte: [
          { azione: "elimina", titolo: "x", taskId: "inventato" },
          { azione: "completa", titolo: "x" },
          { azione: "unisci", titolo: "x", taskId: null },
        ],
      },
    });

    expect(proposals).toEqual([]);
  });

  it("tiene le operazioni su task veri e ne eredita il progetto", () => {
    const proposals = capture({
      projects: PROJECTS,
      tasks: [task({ id: "t1", title: "Capitolo 2", project_id: "p1" })],
      raw: {
        proposte: [
          {
            azione: "unisci",
            taskId: "t1",
            titolo: "Capitolo 2, rivisto",
            motivo: "dice quasi la stessa cosa",
          },
          { azione: "completa", taskId: "t1" },
        ],
      },
    });

    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({
      action: "unisci",
      taskId: "t1",
      title: "Capitolo 2, rivisto",
      projectId: "p1",
    });
    // Senza titolo proprio si usa quello del task bersaglio.
    expect(proposals[1].title).toBe("Capitolo 2");
  });

  it("scarta le proposte senza titolo", () => {
    expect(
      capture({ ...base, raw: { proposte: [{ azione: "crea" }] } }),
    ).toEqual([]);
  });

  it("regge una risposta vuota o senza l'array", () => {
    expect(capture({ ...base, raw: { proposte: null } })).toEqual([]);
    expect(capture({ ...base, raw: { proposte: [] } })).toEqual([]);
  });

  it("si ferma a dodici proposte", () => {
    const proposte = Array.from({ length: 30 }, (_, i) => ({
      azione: "crea",
      titolo: `task ${i}`,
    }));

    expect(capture({ ...base, raw: { proposte } })).toHaveLength(12);
  });

  it("dà a ogni proposta un id distinto", () => {
    const proposals = capture({
      ...base,
      raw: {
        proposte: [
          { azione: "crea", titolo: "a" },
          { azione: "crea", titolo: "b" },
        ],
      },
    });

    expect(new Set(proposals.map((p) => p.id)).size).toBe(2);
  });

  it("regge la risposta vera del modello, copiata così com'è", () => {
    // Output letterale di `claude-sonnet-5` sul prompt della cattura, per la
    // frase: «Devo finire il capitolo 3 della tesi entro venerdì, sono circa
    // due ore, e ricordami di chiamare l'idraulico. Il capitolo sui metodi
    // l'ho già fatto.» Vale più di un finto: è la forma che arriva davvero,
    // campi facoltativi omessi compresi.
    const raw = captureSchema.parse(
      JSON.parse(
        `{"proposte":[{"azione":"completa","taskId":"t1","motivo":"L'utente ha dichiarato di aver già completato il capitolo sui metodi"},{"azione":"crea","titolo":"Finire il capitolo 3 della tesi","progetto":"Tesi","scadenza":"2026-07-31","stimaMinuti":120,"energia":"media","motivo":"Richiesta esplicita con scadenza venerdì e stima di circa due ore"},{"azione":"crea","titolo":"Chiamare l'idraulico","progetto":"Casa","energia":"bassa","motivo":"Promemoria richiesto dall'utente"}]}`,
      ),
    );

    const proposals = capture({
      projects: [...PROJECTS, { ...PROJECTS[0], id: "p3", name: "Casa" }],
      tasks: [task({ id: "t1", title: "Riscrivere il capitolo sui metodi" })],
      raw,
    });

    expect(proposals).toHaveLength(3);
    // Il "completa" senza titolo eredita quello del task bersaglio.
    expect(proposals[0]).toMatchObject({
      action: "completa",
      taskId: "t1",
      title: "Riscrivere il capitolo sui metodi",
    });
    expect(proposals[1]).toMatchObject({
      action: "crea",
      projectId: "p1",
      deadline: "2026-07-31",
      estMinutes: 120,
      energy: "media",
    });
    expect(proposals[2]).toMatchObject({ projectId: "p3", energy: "bassa" });
  });

  it("accetta l'output completo che passa dallo schema", () => {
    const raw = captureSchema.parse(
      JSON.parse(
        '{"proposte":[{"azione":"crea","titolo":"Chiamare il relatore","stimaMinuti":15}]}',
      ),
    );

    expect(capture({ ...base, raw })[0].title).toBe(
      "Chiamare il relatore",
    );
  });
});

describe("**quando la risposta del modello non si può usare**", () => {
  const base = { projects: PROJECTS, tasks: TASKS };

  it("una chiave di primo livello sbagliata è un errore, non una risposta vuota", () => {
    // Il difetto che l'utente vedeva come «non ho trovato niente di
    // azionabile»: con la chiave facoltativa questo JSON passava lo schema
    // come un successo con zero proposte, e la colpa sembrava sua.
    expect(() =>
      parseJson(captureSchema, '{"proposals":[{"azione":"crea","titolo":"X"}]}'),
    ).toThrowError(AiError);
  });

  it("**una voce storta non fa cadere le altre undici**", () => {
    const raw = parseJson(
      captureSchema,
      '{"proposte":[{"azione":"crea","titolo":"A"},{"action":"crea","title":"B"},{"azione":"crea","titolo":"C"}]}',
    );
    const { items, discarded } = normalizeCapture({ ...base, raw });

    expect(items.map((one) => one.title)).toEqual(["A", "C"]);
    expect(discarded).toBe(1);
  });

  it("gli id inventati si contano invece di sparire", () => {
    const { items, discarded } = normalizeCapture({
      ...base,
      raw: {
        proposte: [
          { azione: "unisci", titolo: "x", taskId: "mai-esistito" },
          { azione: "completa", titolo: "y", taskId: "nemmeno" },
        ],
      },
    });

    expect(items).toEqual([]);
    expect(discarded).toBe(2);
  });

  it("niente di buono e qualcosa di scartato: si dichiara illeggibile", () => {
    expect(() => keepOrFail({ items: [], discarded: 3 }, "boom")).toThrowError(
      AiError,
    );
  });

  it("niente di buono e niente di scartato: è davvero vuota", () => {
    expect(keepOrFail({ items: [], discarded: 0 }, "boom")).toEqual([]);
  });

  it("qualcosa di buono passa, anche con degli scarti", () => {
    expect(keepOrFail({ items: ["a"], discarded: 5 }, "boom")).toEqual(["a"]);
  });
});

describe("sift", () => {
  const schema = z.object({ a: z.number() });

  it("tiene i buoni e conta i cattivi", () => {
    const esito = sift([{ a: 1 }, { a: "no" }, { b: 2 }, { a: 3 }], schema);
    expect(esito.items).toEqual([{ a: 1 }, { a: 3 }]);
    expect(esito.discarded).toBe(2);
  });

  it("regge il null di una risposta senza elementi", () => {
    expect(sift(null, schema)).toEqual({ items: [], discarded: 0 });
  });
});

describe("mergePatch", () => {
  const base = task({
    id: "t1",
    title: "Rivedere il capitolo 2",
    notes: "Il relatore vuole più fonti.",
    est_minutes: 90,
    deadline: "2026-08-10",
    subtasks: [
      { id: "s1", text: "Rileggere gli appunti", done: true },
      { id: "s2", text: "Aggiornare la bibliografia", done: false },
    ],
  });

  const proposal = (over: Partial<CaptureProposal>): CaptureProposal => ({
    id: "unisci-0-t1",
    action: "unisci",
    title: "Rivedere il capitolo 2",
    taskId: "t1",
    projectId: null,
    deadline: null,
    estMinutes: null,
    energy: null,
    subtasks: [],
    notes: "",
    reason: "",
    ...over,
  });

  it("non tocca ciò di cui la frase non ha parlato", () => {
    const patch = mergePatch(base, proposal({ title: "Rivedere il capitolo 2" }));
    expect(patch).toEqual({ title: "Rivedere il capitolo 2" });
  });

  it("sovrascrive solo i campi dedotti", () => {
    const patch = mergePatch(
      base,
      proposal({ estMinutes: 120, energy: "alta" }),
    );
    expect(patch.est_minutes).toBe(120);
    expect(patch.energy).toBe("alta");
    expect(patch.deadline).toBeUndefined();
  });

  it("**le note si aggiungono in coda, non al posto delle altre**", () => {
    // Sovrascrivere significherebbe cancellare quello che l'utente si era
    // scritto, a partire da un campo che nella revisione si legge di sfuggita.
    const patch = mergePatch(base, proposal({ notes: "Chiedere a Marta." }));
    expect(patch.notes).toBe("Il relatore vuole più fonti.\nChiedere a Marta.");
  });

  it("non riscrive una nota che c'è già", () => {
    const patch = mergePatch(
      base,
      proposal({ notes: "il relatore vuole più fonti." }),
    );
    expect(patch.notes).toBeUndefined();
  });

  it("**i sottotask spuntati sopravvivono al merge**", () => {
    const patch = mergePatch(
      base,
      proposal({ subtasks: ["Rileggere gli appunti", "Rifare i grafici"] }),
    );
    expect(patch.subtasks?.map((one) => one.text)).toEqual([
      "Rileggere gli appunti",
      "Aggiornare la bibliografia",
      "Rifare i grafici",
    ]);
    // Quello già fatto resta fatto: un duplicato non spuntato lo farebbe
    // ricomparire da fare.
    expect(patch.subtasks?.[0].done).toBe(true);
  });

  it("senza passaggi nuovi non tocca la lista", () => {
    const patch = mergePatch(
      base,
      proposal({ subtasks: ["  rileggere gli appunti "] }),
    );
    expect(patch.subtasks).toBeUndefined();
  });
});

describe("captureContext", () => {
  it("manda al modello solo ciò che è ancora aperto", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", status: "done" }),
      task({ id: "c", status_review: "archived" }),
    ];

    expect(captureContext(tasks).map((one) => one.id)).toEqual(["a"]);
  });

  it("non supera il limite", () => {
    const tasks = Array.from({ length: 100 }, (_, i) => task({ id: `t${i}` }));
    expect(captureContext(tasks, 10)).toHaveLength(10);
  });
});
