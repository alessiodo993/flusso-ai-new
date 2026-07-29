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
}: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  let text: string;

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content.find((one) => one.type === "text");
    text = block && block.type === "text" ? block.text : "";
  } catch (error) {
    throw translate(error);
  }

  return parseJson(schema, text);
}

/**
 * Estrae l'oggetto JSON da una risposta e lo valida.
 *
 * Esportata perché è la parte che si può testare senza rete: è anche quella
 * che sbaglia più spesso.
 */
export function parseJson<T>(schema: z.ZodType<T>, raw: string): T {
  const candidate = extractObject(raw);
  if (candidate === null) {
    throw new AiError(
      "invalid_output",
      "L'AI ha risposto in un formato che non riusciamo a leggere. Riprova.",
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(candidate);
  } catch {
    throw new AiError(
      "invalid_output",
      "L'AI ha risposto con un JSON incompleto. Riprova.",
    );
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiError(
      "invalid_output",
      "La risposta dell'AI non ha la forma attesa. Riprova.",
    );
  }
  return parsed.data;
}

/**
 * Il primo oggetto JSON bilanciato dentro il testo.
 *
 * Contare le parentesi invece di tagliare fra la prima `{` e l'ultima `}`:
 * quel taglio ingoia anche l'eventuale coda di testo dopo l'oggetto, e le
 * graffe dentro le stringhe — un titolo come «rivedi {bozza}» — spostano il
 * conteggio se non si tiene conto delle virgolette.
 */
function extractObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}
