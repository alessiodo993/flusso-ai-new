# FLUSSO — SPECIFICA DI COSTRUZIONE COMPLETA

> Prompt master per la ricostruzione da zero di **Flusso** (Claude Code · Next.js 15 · Supabase · Vercel).
> Documento di riferimento: ogni decisione implementativa deve essere coerente con quanto scritto qui.

## 0. Ruolo, contesto, criterio di successo

Sei un senior full-stack engineer e product designer. Costruisci da zero **Flusso**, web app di produttività personale monoutente (single-tenant per account), interfaccia **interamente in italiano**, mobile-first ma con pieno layout desktop.

**Modello mentale unico, mai violarlo:** `cattura → triage → pianifica → esegui → calibra`.

Flusso non è una to-do list. È un sistema di deep work che collega la strategia (OKR trimestrali) all'esecuzione reale (blocchi di calendario cronometrati) e usa i dati di esecuzione per rendere realistiche le pianificazioni successive. Il calendario è **la verità del giorno**: se non è sul calendario, non succede.

**Definizione di "fatto"**: l'app è completa quando un utente può, senza leggere istruzioni, catturare un pensiero in <3 secondi, trasformarlo in un blocco pianificato in <3 tap, avviarlo con 1 tap, e a fine giornata sapere quanto ha pianificato vs quanto ha eseguito.

**Principi di prodotto (usali per ogni decisione ambigua):**
1. Ridurre il rumore prima di aggiungere funzioni.
2. Rendere l'avvio facile e il rinvio *costoso* (attrito deliberato sui rinvii ripetuti).
3. Mai chiedere all'utente dati che l'app può dedurre.
4. Nessuna scrittura AI senza conferma umana.
5. Parità funzionale mobile/desktop: ogni comfort desktop ha un equivalente touch.

---

## 1. Stack tecnico obbligatorio

| Area | Scelta | Vincoli |
|---|---|---|
| Framework | **Next.js 15** App Router, React 19, TypeScript `strict` | Server Components di default; `"use client"` solo dove serve interattività |
| Hosting | **Vercel** | Route Handlers su runtime Node dove serve `crypto`; edge altrove |
| DB/Auth | **Supabase** Postgres + Auth + RLS | `@supabase/supabase-js` + `@supabase/ssr`. **Nessun ORM** |
| Data layer | **TanStack Query v5** | Optimistic update ovunque; **zero fetching in `useEffect`** |
| Styling | **Tailwind v4** + CSS variables | **Vietati** colori hardcoded nei componenti |
| UI base | shadcn/ui + componenti custom | |
| DnD | `@dnd-kit/core` + `@dnd-kit/sortable` | |
| Icone / toast | `lucide-react` / `sonner` | |
| Validazione | `zod` su ogni input server e ogni output AI | |
| AI | **Anthropic Claude** via `@anthropic-ai/sdk` | Solo in `app/api/ai/*`. Modello unico **`claude-sonnet-5`** per tutte le chiamate (cattura magica, planner, analisi OKR, shutdown) |
| Voce | Web Speech API + fallback upload audio → endpoint server | |
| Date | `date-fns` + `date-fns-tz` | |

**Regole temporali non negoziabili:**
- Timezone **sempre `Europe/Rome`**, mai quello del browser. Una sola utility `nowRome()`, `todayISO()`, `toRomeDay(date)`.
- Giorni = stringhe `YYYY-MM-DD`. Orari = **minuti dalla mezzanotte** (`0–1439`). Mai `Date` serializzati nello state o nel DB per gli slot.
- Utility centrali in `lib/time.ts`: `fmtMin(480) → "08:00"`, `snap(min, 15)`, `overlaps(a,b)`, `SLOT = 15`.

**Env richieste:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_SECRET` (32 byte base64), `APP_URL`.

---

## 2. Struttura del progetto

```
app/
  (public)/page.tsx              landing
  (public)/login/page.tsx
  (public)/reset-password/page.tsx
  (app)/app/page.tsx             shell unica protetta
  api/ai/capture/route.ts        cattura magica (Haiku)
  api/ai/plan/route.ts           planner multi-giorno (Sonnet)
  api/ai/okr/route.ts            analisi KR (Sonnet)
  api/ai/shutdown/route.ts       slot liberi di domani
  api/google/connect/route.ts    avvio OAuth
  api/google/callback/route.ts
  api/google/sync/route.ts       sync incrementale
  api/google/push/route.ts       scrittura evento
  api/public/google/webhook/route.ts
middleware.ts                    refresh sessione Supabase SSR
components/
  shell/  (Header, BottomNav, CommandPalette, QuickCaptureFab, ResponsiveSheet)
  ideas/ list/ calendar/ focus/ okr/ ai/ settings/
lib/
  supabase/{client,server,admin}.ts
  time.ts  colors.ts  types.ts
  hooks/   (query hooks per dominio)
  ai/      (prompt template + schemi zod)
  google/  (oauth, sync, crypto)
supabase/migrations/
docs/
```

Regole di codice: componenti < 200 righe; nessuna logica di dominio nei componenti (sta negli hook); un hook per dominio (`useTasks`, `useIdeas`, `useOkrs`, `useFocus`, `useGoogle`); estrai da subito `TaskMetaChips` e `useTaskQuickActions` per evitare duplicazione tra Lista, Idee e Calendario.

---

## 3. Database — una migrazione unica

Tutte le tabelle in `public`, ognuna con `user_id uuid not null`. Per **ogni** tabella, in quest'ordine: `CREATE TABLE` → `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated` (+ `GRANT ALL ... TO service_role`) → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY <t>_owner_all FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. **Nessuna FK verso `auth.users`.** Nessun `anon`.

**projects** — `id, user_id, name text, color text default '#3f6b4f', deadline date null, archived bool default false, sort_order double precision, created_at`.

**ideas** — `id, user_id, title text, project_id uuid null, sort_order double precision default extract(epoch from now()), created_at`.

**tasks** — base: `id, user_id, title, notes text default '', status text default 'inbox'` (`inbox|done`), `day date null, start_minute int null, est_minutes int null, energy text null` (`alta|media|bassa`), `project_id null, deadline date null, subtasks jsonb default '[]', recur_id null, sort_order, created_at`.
Esecuzione/calibrazione: `postpone_count int default 0, last_postponed_at timestamptz null, actual_duration_minutes int null, is_daily_highlight bool default false, highlight_date date null, first_planned_at timestamptz null, status_review text default 'active'` (`active|stale|archived`), `google_event_id text null`.
Vincoli: `unique (user_id, highlight_date) where is_daily_highlight` (un solo highlight al giorno). Indici su `(user_id, day)`, `(user_id, status)`, `(user_id, deadline)`.
`subtasks` = `[{ id, text, done, deadline? }]`.
Validazione con **trigger**, non CHECK: `end = start_minute + est_minutes <= 1440`; `est_minutes` tra 5 e 240.

**focus_sessions** — `id, user_id, task_id null, started_at, ended_at null, planned_minutes int, actual_minutes int null, outcome text null` (`completed|partial|abandoned|extended`), `was_micro_start bool default false, paused_seconds int default 0, created_at`.

**daily_reviews** — `id, user_id, date, type` (`kickoff|shutdown`), `planned_minutes, completed_minutes, tasks_planned, tasks_completed, notes null, confirmed_at, created_at`. Unique `(user_id, date, type)`.

**okrs** — `id, user_id, project_id null, quarter text` (`2026-Q3`), `objective text, key_results jsonb` = `[{id,text,current,target,unit}]`, `created_at`.

**recurring** — `id, user_id, title, project_id null, est_minutes null, energy null, subtasks jsonb, freq` (`daily|weekly`), `dow int[], start_minute null, skip date[] default '{}', created_at`.

**blocks** (impegni fissi non-task) — `id, user_id, type text, label null, day date null, recur bool default false, dow int[], start_minute, end_minute`.

**google_accounts** — `id, user_id, email, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes text[], needs_reconnect bool default false, created_at`. **Solo `service_role`**, nessun grant a `authenticated`.

**google_calendars** — `id, user_id, account_id, google_calendar_id, name, color, enabled bool default true, is_write_target bool default false, sync_token null, last_synced_at null`. Unique `(user_id, account_id, google_calendar_id)`.

**google_events** (cache locale) — `id, user_id, calendar_id, google_event_id, title, day, start_minute, end_minute, all_day bool, local_done bool default false, updated_at`. Unique `(user_id, calendar_id, google_event_id)`.

**user_settings** — `user_id pk, work_start int default 480, work_end int default 1200, theme text default 'auto', peak_hours_start time default '09:00', peak_hours_end time default '12:00', low_hours_start time null, low_hours_end time null, buffer_minutes int default 10, micro_start_minutes int default 10, daily_cap_minutes int default 360, google_write_enabled bool default false, created_at, updated_at`.

Trigger `handle_new_user()` (`SECURITY DEFINER`, `set search_path = public`) su signup → crea la riga `user_settings`. Trigger `updated_at` dove presente.

---

## 4. Design system

Stile **calmo, editoriale, low-noise**. Esplicitamente **NON**: dashboard SaaS generica, gradienti viola/indaco su bianco, Inter/Poppins, card ombreggiate ovunque.

**Token (CSS variables, entrambi i temi):**

```
--bg          carta calda      #faf8f4   (dark: #14171a)
--surface     bianco sporco    #fffdf9   (dark: #1b1f23)
--ink         verde-inchiostro #1d2b22   (dark: #e8ece8)
--ink-soft                     #52607a-ish desaturato
--ink-faint
--line / --line-strong         hairline
--accent      verde bosco      #3f6b4f
--accent-ink  testo su accento #ffffff
--warn        ambra            scadenze ≤2gg
--danger      rosso desaturato scadute
--shadow-lift 0 1px 2px + 0 8px 24px molto tenui
```

Tipografia: display serif (es. Instrument Serif / Fraunces) per titoli, numeri del timer e cifre OKR; sans neutro non-Inter (es. Work Sans / Karla) per il corpo. Numeri sempre `tabular-nums`.
Radius 12–16px. Spaziatura su scala 4. Animazioni 150–200ms `ease-out`, disattivate con `prefers-reduced-motion`.

**Utility riusabili obbligatorie:** `.btn` + varianti `.btn-primary/.btn-soft/.btn-ghost`, `.icon-btn` (target ≥44px), `.panel`, `.panel-soft`, `.chip`, `.seg` (segmented control: `data-on` → sfondo `--accent`, testo `--accent-ink`).

Unica eccezione ai token: i colori progetto, che arrivano dal DB.

---

## 5. Schermate e navigazione

Pubbliche: `/` landing minimale (titolo, una frase, CTA), `/login` (email+password + Google), `/reset-password`. Protette: **`/app`**, shell unica. `middleware.ts` fa refresh sessione e redirect.

**Header:** logo cerchio verde, data compatta (`gio 4 giu`), **badge "N in scadenza"** cliccabile → Lista filtrata, refresh calendari, Impostazioni, toggle tema.

**Mobile (<1080px):** una sezione per volta. **BottomNav a 5 slot**: `Idee · Lista · ▶ Adesso (centrale rialzato) · Pianifica · Obiettivi`. FAB QuickCapture.

**Desktop (≥1080px):** griglia **`5fr 7fr`**, entrambe le colonne `min-w-0` (obbligatorio, altrimenti la griglia esplode in larghezza), `sticky top-16`, `max-h-[calc(100vh-5rem)]`, **scroll indipendenti**. Colonna sinistra: segmented `Idee | Lista | Obiettivi`. Colonna destra: Calendario.
- Pulsante **collapse** → nasconde la sinistra, calendario centrato `max-width: 880px`, pulsante di riapertura flottante.
- Selezionando **Obiettivi**, il calendario **scompare** (griglia `1fr`).

**Command Palette `⌘K`**: naviga alle sezioni, "Adesso", nuovo task, nuova idea, pianifica con AI, shutdown, impostazioni.

**Comunicazione cross-sezione** via `CustomEvent` su `window`: `flusso:goto {section}`, `flusso:focus-now {taskId?, micro?, autoStart?}`, `flusso:focus-project {projectId}`.

---

## 6. Sezioni — specifica funzionale

### 6.1 Idee — capture puro
Zero campi obbligatori, zero attrito. CaptureBar: input testo + selettore progetto + **🪄 bacchetta AI**. `Enter` salva **e rifocalizza** l'input (cattura a raffica).
Card idea: pallino colore progetto, titolo (doppio click = rinomina inline), **drag handle dedicato** (necessario su touch), overflow menu.
Azioni: **promuovi a Lista** (con toast **Annulla** 5s), elimina, riordino manuale (`sort_order`, DnD verticale), selezione multipla + bulk (progetto, promuovi, elimina).
Le card sono trascinabili **direttamente su uno slot del calendario** → diventano task pianificato.

### 6.2 Lista — triage
CaptureBar avanzata: titolo + progetto + **scadenza** (usa `input.showPicker()`, altrimenti su alcuni browser non si apre) + stima + energia + AI.
Ordinamenti: **`Progetto` (default)** con gruppi collassabili, ognuno ordinato internamente per scadenza; `Scadenza`; `Manuale`. Filtri: progetto, energia, "in scadenza".
**TaskCard** — tutto visibile senza aprire nulla: barra colore progetto a sinistra; titolo (**click singolo = apre il TaskSheet**, **doppio click = rinomina** — distinzione critica, un errore già commesso in passato); **chip scadenza semaforo** (rosso = scaduta o oggi, ambra = ≤2 giorni, neutro oltre); chip energia; chip stima; contatore sottotask `3/5`; **stella** se Highlight; **badge `↺3`** se `postpone_count ≥ 2`; pulsante **📅** → ScheduleSheet; checkbox Fatto; cestino.
Bulk actions: cambia progetto, energia, stato, elimina, pianifica.
Desktop: context-menu tasto destro. Mobile: **action sheet al long-press** — il context-menu non deve mai comparire su touch.

### 6.3 TaskSheet
`ResponsiveSheet`: bottom-sheet su mobile, dialog centrato con larghezza contenuta su desktop.
Contenuto: titolo editabile con **stella accanto** (toggle Highlight del giorno), note, progetto, energia, stima, scadenza, **sottotask con DnD e scadenza propria**, blocco **storico esecuzione** (stimato vs reale, numero rinvii, prima pianificazione).
CTA in fondo: **Fatto · → Lista · Sposta a…** (giorno + selettore orario) **· ▶ Avvia focus ·** Elimina.

### 6.4 Calendario
Viste **Giorno** (default) e **Settimana**. DayStrip sticky con i 7 giorni e navigazione.
**Zoom 15 / 30 / 60 min** — default 30 su desktop, 60 su mobile; l'etichetta dello zoom deve essere sempre visibile su mobile.
Rendering **stile Google Calendar adattato ai token**: blocchi a colore pieno del progetto, testo chiaro, mezz'ore tratteggiate, **linea rossa dell'ora corrente**, griglia leggera.
Ogni blocco task: titolo, orario, **checkbox Fatto**, **▶ Avvia focus**, **resize handle in basso** (visibile anche su mobile) con snap 15 min.
**Drag & drop**: da Idee o Lista → slot; da slot → slot; `activationConstraint` **delay 220ms** su touch (altrimenti lo scroll si rompe); `DragOverlay` con **chip orario live** che mostra l'orario di destinazione; `navigator.vibrate(15)` su pickup e drop. **Deve funzionare anche con filtri e ordinamenti attivi** (bug storico: la lista ordinata rompeva il DnD — non ricadere nell'errore, non derivare l'ID del draggable dall'indice dell'array filtrato).
**Buffer**: fra due blocchi consecutivi inserisci `buffer_minutes` e rendilo visibile come spazio dedicato, non come vuoto anonimo.
Stato vuoto (giorno e settimana) progettato, con CTA "Pianifica con AI".

### 6.5 Focus Mode "Adesso"
Overlay fullscreen, `z-index` sopra tutto, sfondo `--bg`.
- Anello SVG `r=84`, `strokeDasharray = 2πr`, countdown `MM:SS` in font display.
- Sopra il titolo: pallino progetto e, se esiste un OKR di quel progetto nel trimestre corrente, la riga **"Questo blocco avanza: {KR meno avanzato}"** (KR con `current/target` più basso).
- Titolo del task (stella se Highlight), sottotask spuntabili inline (o le note se non ci sono sottotask).
- Controlli: **Inizia sessione** → **Pausa/Riprendi**. Barra bassa: **Fatto · Chiudi · +15 min**.
- **Il tempo in pausa non conta**: il contatore avanza solo mentre `running`.
- A tempo scaduto: dialog **Ho finito / +15 minuti / Continuo più tardi**. "Continuo più tardi" rimette il residuo in Lista (`day = null`, `start_minute = null`, `status = 'inbox'`).
- **Micro-avvio "Solo 10 minuti"**: mostra **un solo** sottotask aperto; allo scadere → *"Ottimo, sei partito. Vuoi continuare? (+20 min)"*.
- Estendendo di 15 min: se lo slot successivo è occupato, avvisa con toast e **estendi solo il timer**, non il blocco.
- Alla chiusura come completato, se esiste un KR collegato → prompt **"Vuoi aggiornare {KR}?"** con `−/+` di step `max(1, target/20)`.
- Ogni sessione scritta in `focus_sessions` (start, planned, actual, outcome, micro).
- Ingressi: **`▶ Adesso`** in BottomNav (risolve: blocco in corso → prossimo pianificato → primo del giorno; se nulla, toast informativo), ▶ sui blocchi, Command Palette.
- **Notifiche browser** all'inizio di ogni blocco, con azioni **Inizia** / **Rimanda 15 min** (chiedi il permesso solo dopo la prima pianificazione, mai al primo caricamento).

### 6.6 Pianifica con AI
Due modalità: **✨ Sceglie l'AI** (seleziona i task per highlight, scadenze, OKR, energia) e **✋ Scelgo io** (l'utente sceglie i task, l'AI trova solo gli slot).
Selezione **multi-giorno fino a 7 giorni**, distribuzione iterativa giorno per giorno.
**Vincoli rigidi, mai violabili:**
- max `daily_cap_minutes` (360) al giorno — è un **tetto, non un target**: se una giornata si chiude bene in 4 ore, è meglio;
- rispetto di `work_start`/`work_end`, dei `blocks` fissi e degli **eventi Google**;
- energia alta nelle fasce di picco, task leggeri nelle fasce di calo;
- `buffer_minutes` fra i blocchi;
- **stime corrette dal coefficiente di ottimismo** (§6.9);
- priorità: Highlight del giorno → scadenze imminenti → KR meno avanzati → task più rinviati.
Output = **schermata di review modificabile** (sposta, rimuovi, cambia orario). **Nessuna scrittura senza conferma.**

### 6.7 Cattura AI 🪄
Input **testo o voce** (stesso componente, due modalità; su desktop UI adattata, non solo un microfono grande).
Capacità: creare **più task su progetti diversi** in una sola frase; proporre **merge** con task simili esistenti invece di duplicare; comprendere comandi di **eliminazione/completamento**; estrarre progetto, scadenza, stima, energia e sottotask.
UI: schermata di **revisione con conferma globale**, ogni proposta accettabile/rifiutabile singolarmente. Mai scrivere senza conferma.
Output JSON validato con Zod: **schema piatto, senza vincoli** — niente `.min()`/`.max()`/`enum` lunghi/nesting profondo; i limiti si dichiarano nel prompt e si clampano in codice. Gestisci il caso di output malformato con un fallback di parsing e messaggio d'errore leggibile.

### 6.8 Obiettivi (OKR)
Selettori **Anno 2026–2030** e **Trimestre Q1–Q4**, con preselezione automatica del periodo corrente.
Per ogni Objective: bordo del colore progetto; KR **collassabili** con **`−/+` inline** (aggiornamento immediato, optimistic); progress ring; **ponte task** `N attivi · M completati` → apre Lista filtrata su quel progetto; **dashboard ritmo** (% di trimestre trascorso vs % di avanzamento medio dei KR, con avviso esplicito se sei indietro); stato vuoto con **"Copia dal trimestre precedente"**; **analisi AI** dei KR (misurabilità, riformulazioni proposte).

### 6.9 Calibrazione "Realtà vs Piano"
Dalle ultime 30 sessioni:
- **coefficiente di ottimismo** = media(`actual_minutes / planned_minutes`); se 1.4 → messaggio *"Sottostimi del 40%"* e il planner moltiplica ogni stima per 1.4;
- tasso di completamento giornaliero;
- grafico pianificato vs eseguito degli ultimi 14 giorni;
- classifica dei task più rinviati.

### 6.10 Rinvii, decay, Highlight
- Ogni rinvio incrementa `postpone_count` e aggiorna `last_postponed_at`; badge `↺N` sulla card.
- **Al 3° rinvio** dialog non ignorabile: *Spezzalo in sottotask · Riduci la stima · Eliminalo · Rimandalo comunque* (l'ultima meno evidente).
- **Decay**: task mai pianificati da 21 giorni → `status_review = 'stale'`, raccolti in una sezione "Da rivedere" con archivia/rilancia.
- **Highlight**: uno solo al giorno (garantito dall'indice unico), reso in modo distintivo in Lista, Calendario e Focus.

### 6.11 Kickoff & Shutdown
**Kickoff** (mattina): piano del giorno, confronto storico (*"Stai pianificando 5h, di solito ne esegui 3h20"*), scelta dell'Highlight se manca.
**Shutdown** (sera): riepilogo pianificato/eseguito; domanda **esplicita per ogni task non completato** (mai rinvio automatico); **tetto di 3 riporti** al giorno successivo, il resto torna in Lista; **suggerimento AI degli slot liberi di domani**; note libere.
Entrambi salvati in `daily_reviews`.

### 6.12 Impostazioni
Orari di lavoro, fasce picco/calo, `buffer_minutes`, `micro_start_minutes`, `daily_cap_minutes`, tema; CRUD progetti con colore; ricorrenti; **account e calendari Google** con colori per calendario e interruttore di scrittura; import/export JSON completo.

---

## 7. Google Calendar — multi-account, bidirezionale

**OAuth.** Client OAuth 2.0 "Web application" su Google Cloud. Scope: `openid email profile https://www.googleapis.com/auth/calendar` (serve read/write per la sincronizzazione in uscita; usa `calendar.readonly` se l'utente disattiva la scrittura). `access_type=offline`, `prompt=consent`. Redirect URI: `${APP_URL}/api/google/callback` — è l'unico URI da registrare.

**Multi-account.** Un utente Flusso collega **N account** (personale + workspace). Ogni account = una riga `google_accounts`. "Aggiungi account" riavvia il consent con `prompt=select_account consent`. Access e refresh token **cifrati AES-256-GCM** con `GOOGLE_TOKEN_SECRET` (formato `iv|tag|ciphertext` base64 in una sola colonna): mai in chiaro, mai esposti al browser. Refresh automatico server-side quando `token_expires_at` è passato; su `invalid_grant` imposta `needs_reconnect = true` e mostra un banner **"Riconnetti {email}"**.

**Selezione calendari.** Dopo il collegamento, `GET /users/me/calendarList` popola `google_calendars`; l'utente sceglie quali abilitare e assegna a ciascuno un **colore personalizzato** (default dal colore Google).

**Sync in ingresso.** Incrementale con `syncToken` per calendario: `GET /calendars/{id}/events` con `timeMin/timeMax`, `singleEvents=true`, `orderBy=startTime`. Converti tutto in `Europe/Rome` → `day` + `start_minute`/`end_minute`; gestisci gli all-day separatamente. Su **`410 Gone`** (token invalidato) esegui una full sync e rigenera il token. Cache in `google_events`. Trigger: al load, ogni 5 minuti in foreground (pausa se tab nascosta), e **refresh manuale** in Impostazioni e nell'header del calendario. Per il tempo reale aggiungi `events.watch` verso `POST /api/public/google/webhook` con verifica del canale (`X-Goog-Channel-Token`) e rinnovo del canale prima della scadenza; il polling resta come fallback.

**Sync in uscita.** Quando un task pianificato viene creato, spostato, ridimensionato o completato, riflettilo sul **calendario di destinazione** scelto dall'utente (`is_write_target`, uno solo). Evento: `summary` = titolo, `description` = note + deep link al task, `colorId` mappato dal colore progetto, **`extendedProperties.private.flussoTaskId`** per l'idempotenza (mai duplicati: cerca prima per questa proprietà, poi crea). Salva `google_event_id` sul task. Completamento → prefissa `✓` o sposta in "fatto" secondo preferenza. Interruttore **`google_write_enabled`, default OFF**, con conferma esplicita alla prima attivazione.

**Rendering.** Gli eventi Google appaiono nel calendario con **sfondo tenue + bordo laterale saturo**, visivamente distinti dai blocchi task (colore pieno). Colore per calendario. **Checkbox "Fatto" locale** (`local_done`, non scritto su Google). Non trascinabili se l'account è read-only. Sono **ostacoli invalicabili** per il planner AI e per il calcolo degli slot liberi.

**Errori.** Token scaduto → banner di riconnessione. `403` rate limit → backoff esponenziale + messaggio chiaro. Nessun calendario abilitato → stato vuoto con CTA.

**Tutte** le chiamate Google avvengono solo in Route Handlers server-side; nessun token raggiunge mai il browser.

---

## 8. Qualità non negoziabile

1. **Optimistic UI** su ogni mutation, con rollback e toast in caso di errore.
2. **Undo** su ogni azione distruttiva (elimina, promuovi, bulk).
3. **A11y**: `aria-label` su ogni icon-button, focus ring visibile, target ≥44px, navigazione completa da tastiera su desktop, `prefers-reduced-motion` rispettato.
4. **Parità mobile/desktop** verificata sezione per sezione.
5. **Stati vuoti** progettati ovunque (Idee, Lista, Giorno, Settimana, OKR, calendari Google), sempre con una CTA.
6. **Errori AI espliciti in UI**: 429, credito esaurito, output non valido — con input dell'utente **preservato**.
7. **Zero fetching in `useEffect`**: solo TanStack Query, `staleTime` sensati, invalidazioni mirate.
8. **Performance**: calendario virtualizzato oltre le 200 righe; nessun re-render globale su drag; `memo` sulle card.
9. **SEO/PWA**: meta uniche per landing e login (`title` <60 char, `description` <160), `og:type`, `twitter:card`, manifest con icona **cerchio verde**, `theme-color`.
10. **Test minimi**: unit su `lib/time.ts`, sul solver di slot del planner e sulla conversione eventi Google.

---

## 9. Ordine di implementazione (non saltare passi)

1. Scaffold Next.js + token CSS + Supabase Auth + `middleware.ts` + login/reset-password.
2. **Migrazione DB completa** con RLS, GRANT e trigger.
3. Tipi generati + client Supabase (browser/server/admin) + hook CRUD base.
4. Shell `/app`: header, BottomNav, layout 5/7 con scroll indipendenti, tema, Command Palette.
5. Idee + Lista + CaptureBar + TaskCard + TaskSheet + bulk actions.
6. Calendario giorno: griglia, zoom, blocchi, DnD, resize, buffer, checkbox.
7. **Google Calendar**: OAuth multi-account → calendarList → sync in ingresso → rendering → sync in uscita.
8. Focus Mode + `focus_sessions` + notifiche di inizio blocco.
9. Calibrazione, rinvii, decay, Highlight.
10. AI: cattura magica → planner multi-giorno → analisi OKR.
11. OKR + ponte task + dashboard ritmo.
12. Kickoff/Shutdown + Impostazioni + vista Settimana.
13. Rifinitura: stati vuoti, undo, a11y, performance, PWA.

Dopo **ogni** passo l'app deve compilare, passare il typecheck e restare deployabile su Vercel. Non procedere al passo successivo con errori aperti. Al termine di ogni passo scrivi in `docs/progress.md` cosa è stato fatto e cosa resta.
