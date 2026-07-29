/**
 * Service worker di Flusso.
 *
 * Serve a due cose, in quest'ordine di importanza:
 *
 * 1. **I pulsanti nelle notifiche.** «Inizia» e «Rimanda 15 min» esistono solo
 *    se la notifica la mostra un service worker: una `new Notification()` dal
 *    documento non supporta le azioni. È il motivo per cui questo file esiste.
 * 2. **Un guscio offline.** Non una cache dei dati — quelli stanno su
 *    Supabase e mostrarli vecchi sarebbe peggio che non mostrarli — ma
 *    abbastanza da non far comparire il dinosauro se la rete cade per un
 *    minuto.
 */

const SHELL = "flusso-shell-v1";

/*
 * Solo le risorse statiche, e solo quelle che esistono di sicuro. Mettere
 * qui `/app` significherebbe servire una versione vecchia dell'applicazione
 * dopo un rilascio, che è il modo classico di rendere un aggiornamento
 * invisibile agli utenti.
 */
const PRECACHE = ["/icon.svg", "/icon-maskable.svg", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Rete prima, cache come rete di sicurezza.
 *
 * Il contrario — cache prima — darebbe un'app più veloce e più sbagliata:
 * un calendario è utile solo se dice la verità adesso.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Le chiamate all'API non si servono mai da cache: meglio un errore.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline.html").then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && PRECACHE.includes(url.pathname)) {
          const copy = response.clone();
          void caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
  );
});

/** Il documento chiede al worker di mostrare l'avviso, per avere le azioni. */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "flusso:notifica") return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon.svg",
      badge: "/icon-maskable.svg",
      data: { taskId: data.taskId },
      actions: [
        { action: "inizia", title: "Inizia" },
        { action: "rimanda", title: "Rimanda 15 min" },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const taskId = event.notification.data?.taskId;
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const action = event.action || "apri";
        const open = clients.find((client) => client.url.includes("/app"));

        if (open) {
          open.focus();
          open.postMessage({ type: "flusso:azione-notifica", action, taskId });
          return undefined;
        }

        // Nessuna finestra aperta: l'azione viaggia nell'URL e la raccoglie
        // la shell al primo render.
        return self.clients.openWindow(
          `/app?azione=${encodeURIComponent(action)}&task=${encodeURIComponent(taskId ?? "")}`,
        );
      }),
  );
});
