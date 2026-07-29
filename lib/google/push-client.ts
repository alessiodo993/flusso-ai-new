/**
 * Chiamata alla sincronizzazione in uscita, dal browser.
 *
 * Volutamente **silenziosa e senza attesa**: riflettere un blocco su Google è
 * una conseguenza della pianificazione, non un'azione dell'utente. Se fallisce,
 * il prossimo spostamento riproverà — la scrittura è idempotente — e nel
 * frattempo nessuno si vede comparire un errore per qualcosa che non ha
 * chiesto.
 */
export function pushTaskToGoogle(taskId: string): void {
  if (typeof window === "undefined") return;

  void fetch("/api/google/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId }),
    keepalive: true,
  }).catch(() => {
    // Nessun rumore: ci ripensa la prossima modifica.
  });
}
