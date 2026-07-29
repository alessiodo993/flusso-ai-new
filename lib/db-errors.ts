import type { PostgrestError } from "@supabase/supabase-js";

/**
 * I trigger della migrazione parlano già italiano, quindi il loro messaggio si
 * mostra così com'è. Qui si traducono gli errori che arrivano invece da
 * Postgres o da PostgREST, che italiano non lo parlano.
 */
const BY_CONSTRAINT: Record<string, string> = {
  tasks_one_highlight_per_day:
    "C'è già un highlight per quel giorno: puoi averne uno solo.",
  google_calendars_one_write_target:
    "Puoi scegliere un solo calendario di destinazione per la scrittura.",
  daily_reviews_unique_per_day: "Quel rituale è già stato salvato per oggi.",
  google_accounts_unique_per_user: "Questo account Google è già collegato.",
  projects_color_hex: "Il colore del progetto non è valido.",
  projects_name_not_blank: "Il progetto ha bisogno di un nome.",
  tasks_title_not_blank: "Il task ha bisogno di un titolo.",
  ideas_title_not_blank: "L'idea ha bisogno di un titolo.",
  user_settings_work_window:
    "L'orario di fine giornata deve venire dopo quello di inizio.",
  user_settings_buffer_range:
    "Il buffer fra i blocchi deve stare fra 0 e 60 minuti.",
  user_settings_cap_range:
    "Il tetto giornaliero deve stare fra 30 minuti e 16 ore.",
  blocks_range_valid: "L'impegno deve finire dopo il suo inizio.",
  blocks_anchored:
    "Un impegno deve ripetersi su dei giorni oppure cadere in una data.",
  okrs_quarter_format: "Il trimestre va scritto come 2026-Q3.",
  recurring_weekly_needs_dow:
    "Una ricorrenza settimanale ha bisogno di almeno un giorno.",
};

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "code" in error
  );
}

export function dbErrorMessage(error: unknown, fallback?: string): string {
  if (!isPostgrestError(error)) {
    if (error instanceof Error && error.message) return error.message;
    return fallback ?? "Non è stato possibile salvare. Riprova.";
  }

  // I vincoli citano il proprio nome nel dettaglio o nel messaggio.
  const haystack = `${error.message} ${error.details ?? ""}`;
  for (const [constraint, message] of Object.entries(BY_CONSTRAINT)) {
    if (haystack.includes(constraint)) return message;
  }

  switch (error.code) {
    case "23505":
      return "Esiste già un record uguale.";
    case "23503":
      return "L'elemento collegato non esiste più: ricarica la pagina.";
    case "23514":
      return "Alcuni valori non sono ammessi.";
    case "42501":
    case "PGRST301":
      return "La sessione è scaduta. Accedi di nuovo.";
    case "PGRST116":
      return "L'elemento non esiste più.";
    default:
      break;
  }

  // I messaggi dei trigger di Flusso sono già in italiano e già chiari.
  if (/[àèéìòù]|blocco|task|stima|giorno/i.test(error.message)) {
    return error.message;
  }

  return fallback ?? "Non è stato possibile salvare. Riprova.";
}
