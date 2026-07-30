/**
 * `server-only` esiste per far fallire la build quando un modulo server
 * finisce in un bundle del browser. Sotto Vitest quel guardiano non ha niente
 * da sorvegliare — non c'è nessun bundle — e si limita a impedire di testare
 * proprio il codice server, che è quello dove gli errori costano di più.
 *
 * Qui viene sostituito con il nulla. La protezione vera resta dov'è utile:
 * `next build` continua a rifiutare un import sbagliato.
 */
export {};
