/**
 * Accesso alle variabili d'ambiente con errori leggibili.
 *
 * Le `NEXT_PUBLIC_*` vanno lette con l'accesso letterale a `process.env`,
 * altrimenti Next non le sostituisce nel bundle del browser.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variabile d'ambiente mancante: ${name}. Aggiungila a .env.local (in locale) o alle Environment Variables del progetto Vercel.`,
    );
  }
  return value;
}

/** URL del progetto Supabase, disponibile anche nel browser. */
export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/** Chiave anonima Supabase: pubblica per definizione, protetta dalle RLS. */
export function supabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Chiave di servizio: scavalca le RLS, solo lato server. */
export function supabaseServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY non deve mai essere letta nel browser.",
    );
  }
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** URL pubblico dell'app, usato per i redirect OAuth e i link nelle email. */
export function appUrl(): string {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Vercel espone il dominio della deployment corrente per le preview.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
