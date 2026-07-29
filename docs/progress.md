# Avanzamento

Stato della ricostruzione, passo per passo. La specifica di riferimento è
[`docs/rebuild-prompt.md`](./rebuild-prompt.md).

| # | Passo | Stato |
|---|---|---|
| 1 | Scaffold, token CSS, Supabase Auth, middleware, login | ✅ fatto |
| 2 | Migrazione DB completa (RLS, GRANT, trigger) | ✅ fatto |
| 3 | Tipi, client Supabase, hook CRUD base | ✅ fatto |
| 4 | Shell `/app` | ✅ fatto |
| 5 | Idee, Lista, TaskCard, TaskSheet | ✅ fatto |
| 6 | Calendario giorno | ✅ fatto |
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

---

## Passo 4 — Shell `/app`

### Fatto

- **Layout deciso dal CSS, non da JavaScript.** Su telefono si vede una
  sezione per volta; da **1080px** (breakpoint `app:`, definito apposta perché
  sotto quella soglia la colonna del calendario diventa illeggibile) compaiono
  le due colonne **5fr / 7fr**, entrambe con `min-w-0`, `sticky top-16`,
  `max-h-[calc(100vh-5rem)]` e **scorrimenti indipendenti**. Nessun ramo di
  rendering dipende dalla larghezza misurata a runtime, quindi non c'è nulla
  da riconciliare all'idratazione e non si vede alcun salto al primo render.
- **Collapse** della colonna sinistra → il calendario si centra a 880px e
  compare un pulsante flottante per riaprirla. Su **Obiettivi** il calendario
  si ritira e la griglia passa a una colonna sola.
- **Header**: cerchio verde, data compatta (`mer 29 lug`), badge **«N in
  scadenza»** che apre la Lista già filtrata, aggiornamento calendari,
  tema, impostazioni.
- **BottomNav** a cinque slot con **▶ Adesso rialzato al centro**, più il FAB
  di cattura rapida sopra la barra, a destra, dove arriva il pollice.
- **Command palette ⌘K**: navigazione, Adesso, nuovo task, nuova idea, cattura
  a voce, pianifica con AI, shutdown, tema, impostazioni. Frecce e Invio,
  focus che va al campo e non al primo elemento navigabile.
- **`lib/events.ts`**: gli eventi cross-sezione tipizzati (`flusso:goto`,
  `flusso:focus-now`, `flusso:focus-project`, più cattura, planner, shutdown,
  impostazioni, palette) con l'hook `useFlussoEvent`. Le sezioni non si
  conoscono fra loro.
- **`ResponsiveSheet`**: bottom-sheet su telefono, dialog centrato da desktop,
  con titolo e descrizione sempre presenti per gli screen reader.
- `EmptyState` riusabile: ogni schermata vuota dice cosa succede e offre
  l'azione successiva.
- Le quattro sezioni sono in piedi come contenitori con il loro stato vuoto;
  il contenuto arriva ai passi 5, 6 e 11.

**Verifica**: `npm run shots` fa uno screenshot di app desktop, app mobile,
landing e login e fallisce se la console riporta errori veri. Il layout a due
colonne, la BottomNav e il FAB sono stati controllati così. La pagina
`/anteprima` monta la shell senza sessione ed è disattivata in produzione.

### Scelte da segnalare
- **Si apre sul calendario**, non sulla Lista: se non è lì, non succede.
- Il selettore `Idee | Lista | Obiettivi` esiste **solo da desktop**: sul
  telefono lo stesso compito ce l'ha la BottomNav, e due controlli per la
  stessa cosa sarebbero rumore.
- La sezione attiva **non è ancora persistita** fra un accesso e l'altro.

### Resta da fare
- Contenuti di Idee e Lista: passo 5.

---

## Passo 5 — Idee, Lista, TaskCard, TaskSheet

### Fatto

**Pezzi condivisi, estratti da subito come chiede la specifica**
- `TaskMetaChips` — scadenza col semaforo (rossa se scaduta o in giornata,
  ambra entro due giorni, neutra oltre), stima, energia, contatore sottotask
  `2/3`, badge `↺N` dal secondo rinvio. Le stesse chip serviranno ai blocchi
  del calendario: tre copie divergerebbero al primo ritocco.
- `useTaskQuickActions` — fatto, focus, pianifica, riporta in Lista, highlight,
  elimina con annullamento. Un solo posto in cui «Fatto» è definito.
- `ItemMenu` — **tasto destro su desktop, pressione prolungata su touch**, con
  il menu contestuale nativo soppresso di proposito: comparire *insieme*
  all'action sheet è il modo più rapido per rendere una card inutilizzabile
  con il pollice.
- `CaptureBar` in due forme, `SelectionBar`, `SelectField`, `EmptyState`.

**Idee**
- Cattura pura: `Invio` salva e **rimette il cursore nel campo**; il progetto
  resta selezionato, perché chi cattura a raffica di solito non lo cambia.
- Riordino trascinabile con **maniglia dedicata** e `sort_order` frazionario:
  spostare riscrive una sola riga.
- Promuovi a Lista, elimina, selezione multipla e azioni in blocco — tutte con
  **«Annulla»** che disfa entrambi i lati (il task creato sparisce, l'idea
  torna con lo stesso id).

**Lista**
- Ordinamenti **Progetto** (default, gruppi collassabili ordinati per
  scadenza), **Scadenza**, **Manuale**; filtri per progetto, energia e
  «in scadenza», che è anche ciò che apre il badge dell'header.
- `TaskCard` mostra tutto senza aprire nulla: barra del colore del progetto,
  titolo, chip, stella dell'highlight, pulsante di pianificazione, checkbox,
  cestino.
- **Clic singolo apre la scheda, doppio clic rinomina.** La distinzione vive in
  `useClickOrDouble`: senza quell'attesa il primo dei due clic aprirebbe
  sempre la scheda e la rinomina sarebbe irraggiungibile.
- Azioni in blocco: progetto, energia, pianifica, elimina.

**TaskSheet e ScheduleSheet**
- Scheda con stella accanto al titolo, note, progetto, energia, stima,
  scadenza, **sottotask riordinabili e con scadenza propria**, storico di
  esecuzione (stimato contro reale, rinvii, prima pianificazione) e le CTA
  Fatto · In Lista · Sposta a… · Avvia focus · Elimina. Ogni campo salva da
  sé: non c'è un momento in cui una modifica smette di valere.
- `ScheduleSheet` con giorno rapido, durata e griglia di orari: gli slot già
  occupati restano cliccabili ma marcati, perché sovrapporre a volte è quello
  che si vuole e nasconderli renderebbe solo più difficile capire perché un
  orario è sparito.

**Verifica**
- `lib/list-view.ts` — filtri, ordinamenti e raggruppamento sono una **funzione
  pura**, non un calcolo dentro al componente: è dove si annidano gli errori
  silenziosi di ordinamento. **14 test** dedicati, 85 in tutto.
- `/anteprima` monta la shell con dati finti (`components/dev/demo-data.tsx`),
  così le sezioni piene si possono guardare davvero. Screenshot verificati su
  Lista desktop, Lista mobile, Idee e TaskSheet.

### Scelte da segnalare
- **I completati scendono in fondo al gruppo invece di sparire**: la spunta
  deve poter essere annullata guardandola.
- **I task senza scadenza vanno in fondo, non in cima**: una scadenza assente
  non è urgentissima, è assente.
- I dettagli della cattura in Lista **compaiono solo dopo aver scritto
  qualcosa**: prima sarebbero cinque campi vuoti a guardia di un pensiero di
  tre parole.

### Resta da fare
- Il trascinamento **da Idee o Lista verso uno slot del calendario** arriva col
  passo 6, insieme alla griglia che fa da bersaglio.
- La bacchetta AI emette già il suo evento ma la cattura magica vera è al
  passo 10.

---

## Passo 6 — Calendario giorno

### Fatto

**Griglia**
- `DayStrip` sticky con i sette giorni, navigazione di settimana, puntino sui
  giorni che hanno qualcosa e ritorno rapido a oggi.
- **Zoom 15 / 30 / 60**, default 30 su desktop e 60 su telefono, con
  l'etichetta `min` sempre leggibile: i tre numeri da soli non direbbero cosa
  stanno regolando.
- Rendering nelle convenzioni di Google Calendar — ore piene continue,
  suddivisioni tratteggiate, **riga rossa dell'ora corrente** — ma disegnato
  con i token di Flusso: blocchi a colore pieno del progetto e testo scelto
  per contrasto (`readableInk`), non fisso.
- Fuori dall'orario di lavoro lo sfondo si incupisce; la finestra visibile si
  **allarga da sé** per far entrare un blocco pianificato prima o dopo, così
  niente sparisce solo perché la giornata è impostata più stretta.
- Chip del tempo pianificato, che passa in ambra oltre il tetto giornaliero.

**Blocchi**
- Titolo, orario, stella dell'highlight, **checkbox Fatto** e **▶ Avvia focus**
  direttamente sul blocco.
- **Ridimensionamento** dal bordo inferiore con passo di 15 minuti, maniglia
  alta abbastanza da prendersi col pollice, anteprima dal vivo mentre si tira,
  e frecce su/giù da tastiera (`role="slider"` con i valori dichiarati).
- I blocchi sovrapposti si dividono la larghezza come su Google Calendar.
- **Buffer** reso come spazio dedicato e marcato, non come vuoto anonimo.

**Trascinamento**
- **Un solo `DndContext`, nella shell.** È l'unico modo perché un'idea presa
  nella colonna di sinistra possa essere lasciata sul calendario a destra: due
  contesti separati non si vedono fra loro.
- Da Idee → slot (l'idea diventa un blocco pianificato), da Lista → slot,
  da slot → slot. Riordino di Idee nello stesso contesto.
- `activationConstraint` con **delay 220ms su touch**, altrimenti ogni
  scorrimento diventerebbe un trascinamento.
- `DragOverlay` con **chip dell'orario di destinazione aggiornata dal vivo** e
  vibrazione su presa e rilascio.
- Gli id dei trascinabili sono quelli delle righe, **mai l'indice di un array
  filtrato**: ordinamenti e filtri attivi non rompono il gesto.

**Verifica**
- `lib/calendar-layout.ts` — disposizione delle colonne, strisce di buffer e
  finestra visibile sono funzioni pure con **21 test**: un blocco sovrapposto
  che scompare sotto un altro non produce nessun errore, solo un'ora di lavoro
  che sparisce dalla vista. In tutto **106 test**.
- Trascinamento provato davvero con un browser: presa dalla Lista, chip che
  mostra `11:45` durante il movimento, blocco che compare all'istante al
  rilascio, e — non essendoci un Supabase vero — rollback con toast d'errore.
  Il ciclo ottimistico completo, verificato dall'esterno.

### Scelte da segnalare
- **Gli slot di rilascio sono sempre da 15 minuti**, qualunque sia lo zoom: la
  precisione del gesto non deve cambiare a seconda di come si sta guardando.
- **`id="flusso"` sul `DndContext`**: senza, dnd-kit numera gli
  `aria-describedby` con un contatore di modulo che sul server e nel browser
  parte da valori diversi, e l'idratazione fallisce su *ogni* elemento
  trascinabile. Errore trovato con lo screenshot, non a occhio.
- Il ridimensionamento **disabilita il trascinamento** finché è in corso:
  tirare il bordo non deve staccare il blocco dalla griglia.

### Resta da fare
- Gli eventi Google come ostacoli e il loro rendering distinto: passo 7.
- La vista Settimana: passo 12.
