# Avanzamento

Stato della ricostruzione, passo per passo. La specifica di riferimento è
[`docs/rebuild-prompt.md`](./rebuild-prompt.md).

| # | Passo | Stato |
|---|---|---|
| 1 | Scaffold, token CSS, Supabase Auth, middleware, login | ✅ fatto |
| 2 | Migrazione DB completa (RLS, GRANT, trigger) | ✅ fatto |
| 3 | Tipi, client Supabase, hook CRUD base | ✅ fatto |
| 4 | Shell `/app` | ⏳ |
| 5 | Idee, Lista, TaskCard, TaskSheet | ⏳ |
| 6 | Calendario giorno | ⏳ |
| 7 | Google Calendar | ⏳ |
| 8 | Focus Mode | ⏳ |
| 9 | Calibrazione, rinvii, decay, Highlight | ⏳ |
| 10 | AI (cattura, planner, OKR) | ⏳ |
| 11 | OKR e dashboard ritmo | ⏳ |
| 12 | Kickoff/Shutdown, Impostazioni, Settimana | ⏳ |
| 13 | Rifinitura | ⏳ |

---

## Passo 1 — Scaffold, token, auth

### Fatto

**Impianto**
- Next.js 15 (App Router, React 19, TypeScript `strict`), Tailwind v4, ESLint 9
  in configurazione flat via `FlatCompat`.
- Dipendenze installate secondo §1 della specifica: `@supabase/{supabase-js,ssr}`,
  TanStack Query v5, `@dnd-kit/*`, `lucide-react`, `sonner`, `zod`, `date-fns` +
  `date-fns-tz`, `@anthropic-ai/sdk`, primitive Radix per i componenti custom.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` tutti verdi.

**Tempo — `lib/time.ts`**
- Fuso fissato su `Europe/Rome`: `nowRome()`, `todayISO()`, `toRomeDay()`,
  `toRomeMinute()`, `romeInstant()`, `toRomeSlot()`.
- Giorni come stringhe `YYYY-MM-DD`, orari come minuti dalla mezzanotte.
  L'aritmetica sui giorni è calcolata in UTC, quindi immune ai cambi di ora
  legale (verificato nei test su marzo e ottobre 2026).
- `fmtMin`, `parseHHMM`, `snap`/`snapDown`, `overlaps`, `overlapMinutes`,
  `contains`, `freeGaps` (base del solver di slot), `SLOT = 15`.
- Formattazione italiana: `fmtDuration`, `fmtRange`, `fmtDayShort`,
  `fmtRelativeDay`, `deadlineTone` (il semaforo delle scadenze).
- **44 test** in `lib/time.test.ts`.

**Design system — `app/globals.css`**
- Token completi di §4 per tema chiaro e scuro, esposti a Tailwind con
  `@theme inline`: nessun componente scrive colori esadecimali.
- Utility riusabili: `.btn` (+ `primary`/`soft`/`ghost`/`danger`), `.icon-btn`
  (target 44px), `.panel`/`.panel-soft`/`.panel-lift`, `.chip` (+ toni),
  `.seg` con `data-on`, `.field`, `.label`.
- Tipografia: Instrument Serif per i titoli, Work Sans per il corpo, numeri
  sempre tabulari. `prefers-reduced-motion` rispettato globalmente.
- Il tema è sempre risolto in `data-theme="light|dark"` su `<html>` da uno
  script inline nel `<head>`: il CSS non gestisce mai `auto` e non c'è flash.

**Auth**
- Client Supabase browser (singleton), server (cookie SSR) e admin
  (`service_role`, con `server-only`).
- `middleware.ts`: rinnova la sessione a ogni richiesta, protegge `/app`,
  ricopia i cookie sui redirect e conserva la destinazione in `?da=`.
  `/reset-password` resta accessibile da autenticati, perché il link di
  recupero apre una sessione.
- Pagine pubbliche: landing, `/login` (email+password, registrazione, Google),
  `/reset-password` (richiesta link **e** scelta della nuova password).
- `app/auth/callback` scambia il codice PKCE; `app/auth/signout` è in POST.
- Messaggi d'errore Supabase tradotti in italiano (`lib/auth-errors.ts`).

**PWA / SEO**
- Manifest con icona cerchio verde, `theme-color` per entrambi i temi,
  meta uniche su landing e login (`title` < 60, `description` < 160).

### Scelte da segnalare
- La specifica indica **Next.js 15**: `create-next-app` installa oggi la 16,
  quindi il progetto è stato **pinnato alla 15** e la config ESLint riscritta
  di conseguenza.
- Per l'AI si usa **`claude-sonnet-5`** su tutte le chiamate (indicazione
  esplicita dell'utente, sostituisce il Sonnet 4.5 / Haiku 4.5 della bozza).
- `lib/supabase/*` è ancora senza il generico `Database`: arriva al passo 3,
  insieme ai tipi allineati alla migrazione.

### Resta da fare
- Tutto il resto: la migrazione DB è il prossimo passo.
- L'app gira solo con le variabili di `.env.example` valorizzate; senza
  Supabase configurato il middleware lascia passare e le pagine mostrano
  l'errore, invece di rimbalzare su un login inutilizzabile.

---

## Passo 2 — Migrazione DB

### Fatto

Una sola migrazione, `supabase/migrations/0001_flusso.sql`, con tutte e dodici
le tabelle di §3. Per ognuna, nell'ordine richiesto: `CREATE TABLE` → `GRANT`
(`authenticated` + `service_role`) → `ENABLE ROW LEVEL SECURITY` → policy
`<tabella>_owner_all`. Nessuna foreign key verso `auth.users`, nessun permesso
per `anon`.

**Oltre alla struttura**
- `user_id` ha `default auth.uid()`: il client non deve passarlo, e non può
  sbagliarlo (la `WITH CHECK` lo rifiuterebbe comunque).
- Trigger `tasks_validate()` come da specifica — non solo validazione, anche
  deduzione: `first_planned_at` si scrive alla prima pianificazione e non
  viene più toccato, e `highlight_date` resta sempre coerente con
  `is_daily_highlight`. Messaggi d'errore in italiano.
- Indice unico parziale `tasks_one_highlight_per_day`: un solo highlight al
  giorno, garantito dal database.
- `focus_sessions.task_id` è `on delete set null`, non `cascade`: cancellare
  un task non deve cancellare i dati su cui si calcola il coefficiente di
  ottimismo.
- `handle_new_user()` (`security definer`, `search_path` fissato) crea la riga
  `user_settings` alla registrazione; trigger `updated_at` dove serve.
- Indici su `(user_id, day)`, `(user_id, status)`, `(user_id, deadline)`, più
  un indice parziale per la vista di default della Lista.

**Verifiche — `npm run db:test`**
Applica la migrazione a un Postgres usa e getta e ci lancia contro 30
controlli: isolamento fra due utenti reali (select, update e delete),
assenza totale di permessi per `anon`, irraggiungibilità dei token Google,
ogni singolo ramo del trigger dei task, unicità dell'highlight, un solo
calendario di scrittura, sopravvivenza delle sessioni alla cancellazione del
task, e la presenza di RLS e policy su *tutte* le tabelle.
`supabase/tests/harness.sql` ricostruisce il minimo di Supabase che serve
(i tre ruoli, `auth.users`, `auth.uid()`), così i test girano su qualunque
PostgreSQL senza dipendere dal cloud.

### Scelte da segnalare
- **Policy con `(select auth.uid())`** invece di `auth.uid()`. È identico nel
  significato, ma Postgres lo valuta una volta sola come InitPlan invece che
  riga per riga: su liste lunghe la differenza è sostanziale.
- **`google_events` ha il giorno nella chiave unica** — `(user_id, calendar_id,
  google_event_id, day)` e non la terna della specifica. Un evento che
  attraversa la mezzanotte viene salvato come una riga per giorno coperto:
  con la terna comparirebbe solo sul primo giorno e il planner non lo
  tratterebbe come ostacolo sugli altri.
- **Vista `google_accounts_public`** per l'interfaccia: espone email, scope e
  `needs_reconnect`, mai i token. La tabella resta senza alcun `GRANT` per
  `authenticated`, come richiesto.
- **Niente `pgcrypto`**: `gen_random_uuid()` è nel core da PostgreSQL 13.
- Gli eventi Google *all day* si salvano con `start_minute = 0` e
  `end_minute = 1440` e si distinguono dal flag `all_day`: vanno resi in una
  striscia a parte e **non** contano come ostacoli per il planner.

### Resta da fare
- Applicare la migrazione al progetto Supabase reale (va lanciata a mano dal
  SQL editor o con la CLI: qui non ci sono credenziali).
- Tipi TypeScript allineati e client tipizzati: passo 3.

---

## Passo 3 — Tipi, client tipizzati, hook dati

### Fatto

**Tipi**
- `lib/supabase/database.types.ts`: lo schema in TypeScript, allineato a mano
  alla migrazione (normalmente lo genera `supabase gen types`, che qui non ha
  credenziali). Va rigenerato a ogni migrazione futura.
- `lib/types.ts`: i tipi di dominio. Il database restituisce `text` dove noi
  vogliamo unioni e `Json` dove vogliamo una forma precisa, quindi la
  restrizione avviene **una volta sola, all'ingresso** — `toTask`, `toOkr`,
  `toRecurring`, `toFocusSession`, `toDailyReview`. Da lì in poi il resto
  dell'app non deve più dubitarne.
- `parseSubtasks` e `parseKeyResults` sono difensivi: una voce malformata
  viene scartata, una parziale completata. Un record storto non deve poter
  far sparire una lista.
- Predicati di dominio condivisi: `isScheduled`, `taskEnd`, `subtaskProgress`,
  `keyResultProgress`, `leastAdvancedKeyResult`, `keyResultStep`.

**Client**
- Browser, server e admin ora sono tipizzati su `Database`.

**Livello dati**
- `lib/hooks/query-keys.ts`: tutte le chiavi in un posto solo, perché le
  invalidazioni siano mirate e verificabili a colpo d'occhio.
- `lib/hooks/use-optimistic.ts`: il ciclo ottimistico scritto una volta sola —
  `cancelQueries`, snapshot, aggiornamento immediato, **rollback** e toast in
  caso di errore, invalidazione mirata alla fine. Gli hook non possono
  dimenticarsi il rollback perché non lo scrivono.
- `lib/db-errors.ts`: i vincoli e i codici Postgres tradotti in frasi che
  dicono cosa fare. I messaggi dei trigger sono già in italiano e passano così.
- `lib/sort-order.ts`: ordinamento manuale con chiavi frazionarie, così
  trascinare riscrive **una sola riga**. Include il riconoscimento del caso
  degenerato (`needsRebalance`) e la ridistribuzione.
- Hook per dominio: `useProjects`, `useIdeas`, `useTasks`, `useSettings`, con
  creazione, modifica, eliminazione, riordino, azioni in blocco,
  pianificazione, rinvio con conteggio e highlight.
- **71 test** in tutto (`time`, `sort-order`, `types`).

### Scelte da segnalare
- **`useTasks` carica una finestra, non tutto**: tutti i task ancora aperti più
  i chiusi degli ultimi 30 giorni. Senza questa finestra ogni avvio
  scaricherebbe anni di storia per mostrare una giornata; la calibrazione e i
  grafici useranno query aggregate proprie.
- **`useSetHighlight` prima toglie e poi assegna**: l'indice unico del database
  rifiuterebbe un secondo highlight, quindi la mutazione libera il giorno prima
  di scrivere. Anche l'aggiornamento ottimistico toglie la stella all'altro
  task, altrimenti per un istante se ne vedrebbero due.
- **`useScheduleTask` mette una stima di default** quando il task non ne ha:
  il database non accetta un blocco senza durata, e chiedere la stima proprio
  mentre si trascina spezzerebbe il gesto.
- **`useSettings` crea la riga se manca**, invece di lasciare l'app senza
  impostazioni: serve agli account nati prima del trigger.

### Resta da fare
- La shell `/app` che userà questi hook: passo 4.
