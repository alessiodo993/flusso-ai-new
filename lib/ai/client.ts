import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

/**
 * L'unico punto da cui si parla con il modello.
 *
 * Tutto quello che sta qui gira solo lato server: la chiave non deve mai
 * finire in un bundle del browser, e il modulo lo fa rispettare invece di
 * limitarsi a sperarlo.
 */

/** Un modello solo per tutte le chiamate: cattura, planner, OKR, shutdown. */
export const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (typeof window !== "undefined") {
    throw new AiError(
      "config",
      "Le chiamate all'AI possono partire solo dal server.",
    );
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new AiError(
      "config",
      "Manca ANTHROPIC_API_KEY: aggiungila a .env.local o alle variabili d'ambiente del progetto.",
    );
  }
  client ??= new Anthropic({ apiKey: key });
  return client;
}

/**
 * I modi in cui una chiamata può andare male, ognuno con un messaggio
 * diverso da mostrare. La specifica li vuole distinti — «429, credito
 * esaurito, output non valido» — perché la reazione dell'utente cambia:
 * uno si risolve aspettando, uno pagando, uno riprovando.
 */
export type AiErrorKind =
  | "config"
  | "rate_limit"
  | "credit"
  | "invalid_output"
  | "overloaded"
  | "unknown";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status: number;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = STATUS[kind];
  }
}

const STATUS: Record<AiErrorKind, number> = {
  config: 500,
  rate_limit: 429,
  credit: 402,
  invalid_output: 502,
  overloaded: 503,
  unknown: 500,
};

function translate(error: unknown): AiError {
  if (error instanceof AiError) return error;

  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    if (status === 429) {
      return new AiError(
        "rate_limit",
        "Troppe richieste in poco tempo. Aspetta qualche secondo e riprova: quello che hai scritto è ancora qui.",
      );
    }
    if (status === 401 || status === 403) {
      return new AiError(
        "config",
        "La chiave dell'AI non è valida o è stata revocata.",
      );
    }
    if (status === 400 && /credit|billing/i.test(error.message)) {
      return new AiError(
        "credit",
        "Il credito Anthropic è esaurito. Ricaricalo dalla console per riprendere a usare l'AI.",
      );
    }
    if (status === 529 || status === 503) {
      return new AiError(
        "overloaded",
        "Il modello è sovraccarico in questo momento. Riprova fra poco.",
      );
    }
  }

  return new AiError(
    "unknown",
    error instanceof Error ? error.message : "Chiamata all'AI non riuscita.",
  );
}

/**
 * Chiede al modello un oggetto JSON e lo valida.
 *
 * Il trucco usuale — precompilare la risposta con `{` così il modello non
 * può aprire con «Certo, ecco il piano:» — qui non è disponibile:
 * `claude-sonnet-5` rifiuta il prefill dell'assistente con un 400. Regge
 * tutto `extractObject`, che pesca l'oggetto in mezzo al testo: da difesa
 * secondaria è diventato l'unica, ed è il motivo per cui è coperto dai test
 * caso per caso invece che di sfuggita.
 */
export async function askJson<T>({
  schema,
  system,
  prompt,
  maxTokens = 4000,
  attempts = 2,
}: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
  /**
   * Quante volte chiedere, se la risposta arriva illeggibile. Un JSON storto
   * è quasi sempre un incidente della singola generazione: ripetere la
   * domanda costa una frazione di secondo e un decimo di centesimo, mentre
   * far ricominciare l'utente costa il pensiero che stava scaricando.
   */
  attempts?: number;
}): Promise<T> {
  let last: AiError | null = null;

  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    let text: string;

    try {
      const response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });

      // Una risposta tagliata a metà non è illeggibile per caso: è finito lo
      // spazio. Dirlo permette di suggerire l'unica cosa che funziona —
      // dividere il testo — invece di far riprovare all'infinito.
      if (response.stop_reason === "max_tokens") {
        throw new AiError(
          "invalid_output",
          "La risposta si è interrotta: c'era troppa roba da elaborare in un colpo solo. Dividi il testo in due catture più corte.",
        );
      }

      const block = response.content.find((one) => one.type === "text");
      text = block && block.type === "text" ? block.text : "";
    } catch (error) {
      throw translate(error);
    }

    try {
      return parseJson(schema, text);
    } catch (error) {
      // Solo il formato si riprova: un errore di rete o di credito non
      // cambia esito alla seconda domanda.
      if (!(error instanceof AiError) || error.kind !== "invalid_output") {
        throw error;
      }
      last = error;
    }
  }

  throw last ?? new AiError("invalid_output", "Chiamata all'AI non riuscita.");
}

/**
 * Estrae l'oggetto JSON da una risposta e lo valida.
 *
 * Esportata perché è la parte che si può testare senza rete: è anche quella
 * che sbaglia più spesso.
 */
export function parseJson<T>(schema: z.ZodType<T>, raw: string): T {
  const candidates = extractObjects(raw);
  if (candidates.length === 0) {
    throw new AiError(
      "invalid_output",
      "L'AI ha risposto in un formato che non riusciamo a leggere. Riprova.",
    );
  }

  let readable = false;

  // Il primo oggetto non è per forza quello buono: capita che il modello ne
  // scriva uno d'esempio prima di quello vero. Vince il primo che ha la forma
  // giusta, non il primo che incontra il lettore.
  for (const candidate of candidates) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue;
    }
    readable = true;

    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
  }

  throw new AiError(
    "invalid_output",
    readable
      ? "La risposta dell'AI non ha la forma attesa. Riprova."
      : "L'AI ha risposto con un JSON incompleto. Riprova.",
  );
}

/**
 * Gli oggetti JSON bilanciati dentro il testo, nell'ordine in cui compaiono.
 *
 * Contare le parentesi invece di tagliare fra la prima `{` e l'ultima `}`:
 * quel taglio ingoia anche l'eventuale coda di testo dopo l'oggetto, e le
 * graffe dentro le stringhe — un titolo come «rivedi {bozza}» — spostano il
 * conteggio se non si tiene conto delle virgolette.
 */
function extractObjects(raw: string): string[] {
  const found: string[] = [];

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      if (depth > 0) inString = true;
    } else if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) found.push(raw.slice(start, i + 1));
    }
  }

  return found;
}
