/**
 * Nome del cookie che custodisce lo `state` di OAuth fra l'avvio del consenso
 * e il ritorno da Google.
 *
 * Sta qui e non nella rotta perché i file di route possono esportare solo i
 * nomi previsti da Next (`GET`, `POST`, `runtime`, …): qualunque altra
 * costante esportata da lì fa fallire il build.
 */
export const GOOGLE_STATE_COOKIE = "flusso_google_state";
