/**
 * Supabase risponde in inglese e con messaggi tecnici. Qui li traduciamo in
 * frasi che dicono all'utente cosa fare, non cosa è andato storto nel client.
 */
const MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email o password non corretti."],
  [
    /email not confirmed/i,
    "Devi prima confermare l'email: controlla la posta in arrivo.",
  ],
  [
    /user already registered|already been registered/i,
    "Esiste già un account con questa email. Prova ad accedere.",
  ],
  [
    /password should be at least/i,
    "La password deve avere almeno 8 caratteri.",
  ],
  [
    /new password should be different/i,
    "La nuova password deve essere diversa dalla precedente.",
  ],
  [/unable to validate email|invalid email/i, "L'indirizzo email non è valido."],
  [
    /for security purposes.*(\d+) seconds/i,
    "Hai richiesto troppe email di seguito: riprova fra un minuto.",
  ],
  [
    /email rate limit exceeded|over_email_send_rate_limit/i,
    "Hai richiesto troppe email di seguito: riprova fra qualche minuto.",
  ],
  [
    /auth session missing|session_not_found/i,
    "La sessione è scaduta. Richiedi un nuovo link.",
  ],
  [
    /token has expired or is invalid|otp_expired/i,
    "Il link non è più valido. Richiedine uno nuovo.",
  ],
  [
    /failed to fetch|networkerror/i,
    "Connessione non riuscita. Controlla la rete e riprova.",
  ],
];

export function authErrorMessage(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  for (const [pattern, message] of MAP) {
    if (pattern.test(raw)) return message;
  }
  return raw || "Qualcosa è andato storto. Riprova.";
}
