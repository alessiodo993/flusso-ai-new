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
| 7 | Google Calendar | ✅ fatto |
| 8 | Focus Mode | ✅ fatto |
| 9 | Calibrazione, rinvii, decay, Highlight | ✅ fatto |
| 10 | AI (cattura, planner, OKR) | ⏸ in attesa della chiave Anthropic |
| 11 | OKR e dashboard ritmo | ✅ fatto |
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

---

## Passo 7 — Google Calendar

### Fatto

**Token e sicurezza**
- `lib/google/crypto.ts`: AES-256-**GCM**, non CBC. GCM autentica il testo
  cifrato, quindi un token manomesso viene **rifiutato** invece di decifrarsi
  in spazzatura. Formato `iv|tag|ciphertext` in una sola colonna — tre colonne
  separate prima o poi finirebbero disallineate. **13 test**, compresi
  manomissione, chiave sbagliata e chiave assente.
- I token restano irraggiungibili dal browser: `google_accounts` non ha alcun
  `GRANT` per `authenticated`, e l'interfaccia legge stato ed email dalla vista
  `google_accounts_public`.
- Lo `state` di OAuth vive in un cookie `httpOnly` e viene confrontato al
  ritorno: è ciò che impedisce a un link esterno di far collegare a Flusso un
  account Google che non è quello dell'utente.

**Multi-account**
- `?aggiungi=1` riavvia il consenso con `select_account consent`, così si
  collegano più account (personale e lavoro).
- `access_type=offline` **e** `prompt=consent`: senza il primo Google non
  rilascia il refresh token, senza il secondo non lo rilascia *di nuovo* a chi
  ha già dato il consenso — e la sincronizzazione morirebbe dopo un'ora, senza
  spiegazioni.
- Rinnovo automatico un minuto prima della scadenza. Su `invalid_grant` si
  imposta `needs_reconnect` e compare il banner **«Riconnetti {email}»**:
  senza, l'utente scoprirebbe il problema solo accorgendosi che il calendario
  è fermo da giorni.
- Lo scope dipende dalle preferenze: chi tiene la scrittura spenta dà solo
  `calendar.readonly`.

**Sincronizzazione in entrata**
- Incrementale con `syncToken`; su **`410 Gone`** si azzera il token e si rifà
  una sincronizzazione completa, in automatico.
- `lib/google/events.ts` converte gli eventi nel modello di Flusso, ed è il
  punto in cui si perdono le cose: **19 test** su ora legale e solare, offset
  espliciti, eventi che attraversano la mezzanotte, trasferte di più giorni,
  *all day* con la data di fine esclusa, eventi annullati.
- I calendari si sincronizzano **in sequenza**: sei richieste in parallelo si
  prendono un 403 a testa invece di sincronizzarsi.
- Gli errori tornano **per calendario**: se un account va ricollegato, gli
  altri si aggiornano lo stesso.
- Polling ogni 5 minuti in primo piano, **fermo a scheda nascosta** e con un
  recupero immediato al ritorno.

**Notifiche push** (migrazione `0002`)
- `events.watch` verso `/api/public/google/webhook`, con token di canale
  firmato in HMAC e verificato **a tempo costante**: un `===` lascerebbe
  indovinare la firma misurando i tempi di risposta. **8 test**, incluso il
  caso che conta — prendere un token valido e cambiarci l'utente.
- Canali rinnovati con un giorno di anticipo e aperti solo su HTTPS: da
  localhost Google non potrebbe consegnare nulla, quindi non ci si prova
  nemmeno. Se il canale non si apre, il polling copre il caso.

**Sincronizzazione in uscita**
- **Idempotente**: si cerca prima l'evento per
  `extendedProperties.private.flussoTaskId`, e solo se non esiste lo si crea.
  Fidarsi del solo `google_event_id` non basterebbe: una scrittura andata a
  metà lascerebbe l'evento su Google senza riferimento qui, e la volta dopo si
  creerebbe un doppione — il tipo di danno che nessuno perdona a un'app di
  produttività.
- Parte da sé a ogni pianificazione, spostamento, ridimensionamento,
  completamento ed **eliminazione**, in modo silenzioso: è una conseguenza
  della pianificazione, non un'azione dell'utente.
- Interruttore `google_write_enabled` **spento di default**; senza calendario
  di destinazione la rotta non fa nulla.

**Rendering**
- Gli eventi Google hanno **sfondo tenue e bordo laterale saturo**, contro il
  colore pieno dei blocchi task: deve leggersi a colpo d'occhio che è qualcosa
  che subisci, non qualcosa che hai deciso.
- Task ed eventi si dispongono **insieme** nella stessa griglia di colonne: un
  blocco e una riunione alla stessa ora vanno affiancati, non uno sopra
  l'altro.
- Gli *all day* stanno in una striscia sopra la griglia e **non contano come
  ostacoli**: un compleanno non è un motivo per non pianificare nulla per un
  giorno intero.
- Spunta **locale** sugli eventi (`local_done`), mai scritta su Google.

**146 test** in tutto; migrazione `0002` verificata sul Postgres usa e getta.

### Scelte da segnalare
- **Niente `googleapis`**: quel pacchetto pesa decine di megabyte per quattro
  chiamate, e su una funzione serverless il peso è tempo di avvio. Le chiamate
  sono scritte a mano in `lib/google/api.ts`.
- **`GOOGLE_STATE_COOKIE` e `channelTokenFor` stanno in `lib/`, non nelle
  rotte**: i file di route possono esportare solo i nomi previsti da Next, e
  qualunque altra costante esportata da lì fa fallire il build. Trovato in
  build, non a occhio.
- **`api/public` è escluso dal middleware**: lo chiama Google, non il browser,
  e lì non c'è alcun cookie da rinnovare.

### Resta da fare
- La schermata di **Impostazioni** per scegliere quali calendari abilitare,
  assegnare i colori e attivare la scrittura: passo 12. Fino ad allora
  `enabled` arriva da ciò che l'utente ha già scelto su Google e
  `is_write_target` va impostato a mano.

---

## Nota — privilegi di `anon` sul progetto reale

Collegando il primo progetto Supabase vero è emerso un difetto che i test in
locale non potevano vedere.

**Cosa succedeva.** La migrazione `0001` non concede nulla ad `anon`, come
chiede la specifica. Ma ogni progetto Supabase nasce con

```sql
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
```

e quel default si applica a ogni tabella creata dopo. Interrogando il progetto
con la sola chiave pubblicata nel browser, `anon` risultava avere `SELECT`,
`INSERT`, `UPDATE` e `DELETE` su **tutte** le tabelle, `google_accounts`
compresa. La prova: una richiesta su una colonna inesistente rispondeva
«column does not exist» invece di «permission denied» — segno di essere
passata oltre il controllo dei privilegi.

**Quanto era grave.** I dati non erano esposti: le RLS, senza alcuna policy
per `anon`, negavano ogni riga, e un inserimento anonimo veniva respinto con
`42501`. Ma restava **una protezione sola** dove ne erano previste due.

**Come è stato risolto.**
- `supabase/migrations/0003_revoke_anon.sql` revoca i privilegi ad `anon` su
  tabelle, sequenze e funzioni, annulla il default per quelle future, e toglie
  ad `authenticated` i permessi su `google_accounts` che il default gli aveva
  dato.
- `supabase/tests/harness.sql` ora **riproduce i default privileges di
  Supabase**. Senza, i test giravano su uno schema più pulito di quello vero.
  Verificato per controprova: con sole `0001` e `0002` il test fallisce con
  «anon può leggere projects»; con la `0003` torna verde.

---

## Passo 8 — Focus Mode

### Fatto

**Il cronometro**
- `useFocusTimer` somma **intervalli davvero trascorsi in esecuzione**, invece
  di sottrarre due orologi: mettere in pausa e tornare mezz'ora dopo non brucia
  mezz'ora di sessione. Verificato in browser — 3 secondi di pausa e il
  countdown non si muove di un secondo, poi riparte alla ripresa.
- Legge l'orologio a ogni tick invece di contare i tick: un contatore
  incrementale perderebbe tempo quando la scheda passa in secondo piano, e la
  sessione finirebbe in ritardo.
- A tempo scaduto si ferma da sé e lo segnala, invece di andare in negativo.

**La schermata**
- Overlay a schermo intero sopra tutto, sfondo `--bg`. È l'unico posto
  dell'app che **toglie** invece di aggiungere.
- Anello SVG `r=84` con `strokeDasharray = 2πr`, countdown in font display.
- Sopra il titolo: pallino del progetto e, se esiste un OKR di quel progetto
  nel trimestre corrente, la riga **«Questo blocco avanza: {KR meno
  avanzato}»** — il solo punto in cui la strategia tocca l'esecuzione.
- Sottotask spuntabili inline, o le note se non ce ne sono.
- `Esc` chiude, barra spaziatrice mette in pausa.

**Le regole di fine**
- Dialog **Ho finito / +15 minuti / Continuo più tardi**, senza chiusura
  implicita: la scelta la fa la persona. «Continuo più tardi» è l'ultima e la
  meno vistosa di proposito, ed è l'unica che riporta il task in Lista senza
  giorno né orario.
- **Micro-avvio**: mostra **un solo** sottotask aperto — guardarne cinque è già
  una ragione per rimandare — e allo scadere chiede *«Ottimo, sei partito.
  Vuoi continuare?»* con il doppio dei minuti.
- **+15 minuti**: se lo slot successivo è occupato allunga **solo il timer** e
  lo dice con un toast. Allungare il blocco ci passerebbe sopra, e il
  calendario mentirebbe.
- A blocco completato, se un OKR è collegato, compare il prompt di
  aggiornamento del KR con `−`/`+` di passo `max(1, target/20)`.

**Sessioni e avvisi**
- La riga in `focus_sessions` si scrive **all'avvio**, non alla fine: se la
  scheda si chiude a metà, meglio una sessione senza esito che nessuna traccia
  di un'ora di lavoro. Alla chiusura si aggiornano durata reale, secondi di
  pausa, esito e — se sono stati aggiunti dei +15 — anche il piano, altrimenti
  la calibrazione confronterebbe numeri sbagliati.
- Notifiche all'inizio di ogni blocco, con un timer per blocco invece di un
  intervallo che controlla l'orologio: così l'avviso arriva al minuto esatto.
- Il permesso **non si chiede al primo caricamento**. Una richiesta che arriva
  prima di aver capito cosa fa l'app viene negata per riflesso, e negata resta
  — il browser non la ripropone. Compare invece una riga discreta nel
  calendario, e **solo dopo** che c'è almeno un blocco pianificato.

**Ingressi**: `▶ Adesso` nella BottomNav, `▶` sui blocchi, command palette.
`resolveFocusTarget` risolve blocco in corso → prossimo → primo rimasto, con
**10 test**: a giornata finita propone comunque il primo rimasto, perché la
risposta utile è ciò che è rimasto indietro, non «niente». **159 test** in
tutto.

### Scelte da segnalare
- **Le notifiche non hanno pulsanti «Inizia» / «Rimanda 15 min».** Le azioni
  nelle notifiche richiedono un service worker, che l'app non ha ancora. Il
  clic sulla notifica apre direttamente il focus su quel blocco, che copre il
  caso principale. I pulsanti arriveranno col service worker della PWA, al
  passo 13.

### Resta da fare
- Calibrazione, dialogo del terzo rinvio e decay: passo 9.

---

## Passo 9 — Calibrazione, rinvii, decadimento

### Fatto

**Realtà vs Piano — `lib/calibration.ts`, 28 test**
- **Coefficiente di ottimismo**: media di `reale / previsto` sulle ultime 30
  sessioni. Con tre difese contro i numeri inventati:
  - sotto **5 sessioni non dice niente**, perché un coefficiente costruito su
    tre casi verrebbe creduto pur non significando nulla;
  - ogni rapporto è **limitato fra 0,25× e 4×** prima della media: una sessione
    da cinque minuti previsti e cinque ore reali è quasi sempre un timer
    lasciato aperto, e senza il limite sposterebbe da sola il coefficiente di
    tutti;
  - le sessioni **abbandonate sono escluse**: dicono che è successo altro, non
    che la stima era sbagliata.
- Sotto il 10% di scarto la frase non compare: quello è rumore, e dargli un
  nome gli darebbe importanza.
- `correctedEstimate` è la stima che userà il pianificatore. Verificato nel
  browser: con ×1,35 la schermata dice che *«una stima di 60 minuti diventa 80
  minuti quando cerca lo slot»*.
- Tasso di completamento, grafico di 14 giorni **pianificato contro eseguito**
  e classifica dei task più rinviati. Il grafico usa la durata **reale** per
  l'eseguito: sostituirla con la stima mostrerebbe due volte lo stesso numero,
  facendo sembrare tutto perfettamente calibrato.

**Attrito sui rinvii**
- `isPostponement` distingue il rinvio dal riordino: spostare **in avanti** un
  blocco già pianificato conta, riordinare dentro la stessa giornata o
  anticipare no. Senza quella distinzione, sistemare la mattinata gonfierebbe
  il contatore e farebbe comparire il dialogo a chi sta solo mettendo a posto
  l'agenda. **6 test.**
- Ogni spostamento passa dall'evento `flusso:postpone`, mai dalla mutazione
  diretta: è lì che scatta l'attrito, e scavalcarlo lo renderebbe aggirabile.
- **Dal terzo rinvio** compare un dialogo che **non si chiude cliccando
  fuori**, con quattro strade: spezzalo in sottotask (con i campi lì dentro),
  riduci la stima, eliminalo, oppure rimandalo comunque — l'ultima e la meno
  vistosa. I primi due rinvii passano in silenzio: l'attrito serve quando
  diventa un'abitudine, non alla prima volta.
- Verificato nel browser: alla terza volta il dialogo compare, ha tutte e
  quattro le voci, e resta aperto al clic fuori.

**Decadimento**
- Un task **mai finito sul calendario** da 21 giorni diventa «da rivedere». Il
  criterio è `first_planned_at`, non la data di creazione: un task pianificato
  una volta e poi rimandato non è dimenticato — è un problema diverso, e lo
  racconta il conteggio dei rinvii.
- La passata gira nel browser una volta per sessione. Un cron sul server per
  una manciata di righe sarebbe infrastruttura che non ripaga: se l'utente non
  apre l'app, non c'è nessuno a cui mostrarli.
- Sezione **«Da rivedere»** in fondo alla Lista, **richiusa di default**, con
  rilancia e archivia per riga e «archivia tutti». Non è una lista di cose da
  fare: è un mucchio di decisioni rimandate, e va guardato quando si è pronti
  a prenderle.

**193 test** in tutto.

### Difetto trovato e corretto
I task «da rivedere» comparivano **sia** nella loro sezione **sia** nella lista
principale — cioè due volte, esattamente il rumore che la sezione doveva
togliere. `isListable` ora richiede `status_review === 'active'`, con il test
che lo blocca.

### Resta da fare
- La cattura magica e il pianificatore che useranno il coefficiente: passo 10.

---

## Passo 11 — Obiettivi, ponte con i task, dashboard ritmo

*Fatto prima del passo 10, su indicazione dell'utente: il pianificatore AI
aspetta la chiave Anthropic.*

### Fatto

**Aritmetica dei trimestri — `lib/quarter.ts`, 21 test**
- Confini, trimestre precedente e successivo, giorni rimasti, avanzamento.
  I confini si calcolano come «il giorno prima dell'inizio del trimestre
  dopo»: così non serve sapere quanti giorni ha febbraio, e gli anni bisestili
  funzionano da soli.
- **`rhythmOf`** confronta il tempo trascorso con l'avanzamento reale. È la
  sola informazione che rende utile un OKR a metà trimestre: senza il
  confronto, «al 30%» non dice se sei in ritardo o in anticipo, e sono due
  situazioni opposte. Sotto i 10 punti di scarto non commenta.
- Il messaggio è asciutto di proposito, e a trimestre chiuso **non promette
  giorni che non ci sono**.
- La media generale **ignora gli obiettivi senza risultati chiave**: contarli
  come zero farebbe sembrare di essere indietro per colpa di un obiettivo che
  non è ancora stato scritto.

**Sezione Obiettivi**
- Selettori **anno 2026–2030** e **trimestre Q1–Q4**, preselezionati sul
  periodo corrente, con ritorno rapido al trimestre in corso.
- Dashboard ritmo con due barre sovrapposte: il trimestre sotto, i risultati
  sopra. Lo scarto fra le due estremità è il ritardo, e si vede senza leggere.
- Ogni obiettivo ha il **bordo del colore del progetto**, un progress ring, i
  **risultati chiave collassabili** con `−` e `+` inline di passo
  `max(1, target/20)` che scrivono subito.
- **Ponte con l'esecuzione**: la chip `N attivi · M completati` apre la Lista
  già filtrata su quel progetto. Verificato nel browser: il filtro arriva
  impostato.
- Stato vuoto con **«Copia da 2026-Q2»**, che ricopia gli obiettivi
  **azzerando i valori correnti** — portarsi dietro anche i progressi sarebbe
  il modo più rapido per rendere gli OKR una finzione.
- Editor con `da` / `a` / unità per ogni risultato: chiede un **numero da
  raggiungere**, non una descrizione. È la differenza fra «migliorare la
  documentazione» e «dieci pagine riscritte».

**214 test** in tutto.

### Difetto trovato e corretto — stati vuoti che non c'erano
Passando a un trimestre senza obiettivi la sezione restava **completamente
bianca**. La causa era una forma scritta in tre punti diversi —
`{lista.length === 0 && !isLoading && <Vuoto/>}` — che copre due casi su tre e
lascia il terzo, l'**errore di caricamento**, come un pannello vuoto per
sempre: il modo peggiore di dire che qualcosa non va.

Ora c'è `SectionStatus`, che distingue i tre casi (sto caricando / il
caricamento è fallito / davvero non c'è nulla) e mostra un errore con
«Riprova». Applicato a **Obiettivi, Lista e Idee**.

### Nota sul metodo
Il difetto è emerso da uno screenshot, non dai test. Nella stessa sessione ho
inseguito per un po' una falsa regressione — nessuna scheda cambiava sezione —
che si è rivelata un server di sviluppo rimasto attivo su `.next` cancellata:
serviva HTML corretto ma nessun JavaScript, quindi la pagina non si idratava.
Il codice non c'entrava.

### Resta da fare
- Passo 10 (AI), in attesa della chiave Anthropic. L'**analisi AI dei
  risultati chiave** prevista in §6.8 fa parte di quel passo e non è ancora
  presente.

---

## Passo 10 — AI: cattura magica, planner multi-giorno, analisi OKR

### La decisione che regge tutto il passo

**L'AI non calcola gli orari.** Sceglie *quali* task e in *che ordine*; dove
finiscono lo decide `lib/planner.ts`. La specifica chiama quei vincoli
«rigidi, mai violabili», e un modello che fa aritmetica su finestre, buffer e
tetti giornalieri prima o poi sbaglia in modo *plausibile* — cioè nel modo
peggiore, perché il risultato sembra giusto. Il solver invece è aritmetica
verificabile, ed è coperto da **30 test**.

La seconda regola, per iscritto in tre punti del codice: **nessuna scrittura
senza conferma**. Le route AI leggono e propongono, non scrivono mai; le
scritture partono dal client dopo la revisione, dagli stessi hook ottimistici
di tutto il resto. Se scrivesse la route, la conferma sarebbe una cortesia
dell'interfaccia invece che un fatto dell'architettura.

### Fatto

**Il solver — `lib/planner.ts`, 30 test**
- `planDays` scorre i giorni in ordine tenendo uno stato mutabile per
  giornata, così i blocchi appena collocati diventano subito ostacoli per
  quelli dopo.
- Vincoli verificati uno per uno dai test: finestra di lavoro, buffer fra i
  blocchi, impegni fissi ed eventi Google, tetto giornaliero (**un massimo,
  non un obiettivo**: con mezz'ora di lavoro e sei ore di tetto il solver non
  inventa altro), stime corrette dal coefficiente di ottimismo, priorità
  highlight → scadenze → risultati chiave indietro → più rinviati.
- Le fasce di energia sono una **preferenza, non un vincolo**: meglio un
  blocco fuori fascia che un blocco mai pianificato. Anche questo è un test.
- I task che non entrano tornano indietro con il motivo, invece di sparire.

**Difetto trovato scrivendo i test.** `findStart` arrotondava allo slot *più
vicino*: un buco che comincia alle 10:40 — capita appena `buffer_minutes` non
è multiplo di 15, e il default è 10 — veniva scartato del tutto invece che
usato dalle 10:45. Corretto con `snapUp`, che ora sta anche in `lib/time.ts`.

**Il livello AI — `lib/ai/*`, 22 test**
- `client.ts`: un solo punto di contatto col modello, che rifiuta di partire
  nel browser. Gli errori sono **distinti per tipo** — 429, credito esaurito,
  output non valido, sovraccarico — perché aspettare, ricaricare e riprovare
  sono tre reazioni diverse, e un unico «qualcosa è andato storto» lascia
  l'utente a indovinare quale.
- `extractObject` pesca il primo oggetto JSON **bilanciato**: regge preamboli,
  code, graffe dentro le stringhe (`rivedi {bozza}`) e un secondo oggetto
  dopo il primo.
- Schemi Zod **piatti e senza vincoli**, come chiede §6.7: niente `.min()`,
  `.max()` o enum. I limiti stanno nel prompt e si fanno rispettare clampando
  — una stima di 9000 minuti diventa 480, non un errore che costringe a
  ridettare tutto.
- `normalizeCapture` è la barriera: progetti inventati azzerati, date
  impossibili (`2026-02-31`) scartate, `unisci`/`completa`/`elimina` **rifiutati
  se il taskId non esiste**, così una proposta non arriva mai riferita a
  righe che non ci sono.

**Le quattro route** — `capture`, `plan`, `okr`, `shutdown` — leggono il
contesto **dal server**, non dal client: se fosse il browser a mandare
l'elenco dei task, un id inventato basterebbe a far proporre un'operazione su
una riga altrui. Le RLS reggerebbero la scrittura, ma la proposta arriverebbe
all'utente già sporca.

**Cattura magica 🪄** — testo o voce (Web Speech API, `it-IT`, con
`supported` in chiaro perché Firefox non ce l'ha), poi **schermata di
revisione**: ogni proposta si accetta o si rifiuta singolarmente, il titolo si
può correggere lì dentro, e le proposte **distruttive arrivano spente**. Il
testo dettato resta nel campo se la chiamata fallisce.

**Pianifica** — `✨ Sceglie l'AI` / `✋ Scelgo io`, fino a 7 giorni. In
entrambe le modalità gli orari li calcola il solver: cambia solo chi sceglie i
task. La revisione raggruppa per giorno, mostra il motivo di ogni blocco,
permette di togliere e di cambiare orario, e dice quali task non ci stanno.

**Analisi dei risultati chiave** — dal pulsante ✨ sulla card dell'obiettivo.
Le riformulazioni **non si applicano da sole**: ognuna ha il suo pulsante,
perché riscrivere un obiettivo è una decisione, non una correzione di
battitura.

**266 test** in tutto.

### Difetto che solo una chiamata vera poteva trovare

`askJson` precompilava la risposta con `{` — il trucco standard per impedire
al modello di aprire con «Certo, ecco il piano:». Contro l'API vera:

```
400 invalid_request_error: This model does not support assistant message
prefill. The conversation must end with a user message.
```

`claude-sonnet-5` non accetta il prefill. Tutte e quattro le route sarebbero
fallite alla prima chiamata reale, con typecheck, lint, test e build verdi.
Tolto il prefill; ora regge tutto `extractObject`, che da difesa secondaria è
diventata l'unica — ed è il motivo per cui è coperto caso per caso.

La stessa chiamata ha confermato che il prompt della cattura funziona: dalla
frase «Devo finire il capitolo 3 della tesi entro venerdì, sono circa due ore,
e ricordami di chiamare l'idraulico. Il capitolo sui metodi l'ho già fatto.»
il modello ha restituito tre proposte corrette — un `completa` sul task
esistente e due `crea` con progetto, scadenza, stima ed energia. Quella
risposta è ora **un test**, copiata letteralmente: vale più di un finto,
perché è la forma che arriva davvero, campi facoltativi omessi compresi.

### Verificato nel browser

Con le route AI intercettate (per non spendere token guardando l'interfaccia):
cattura → revisione → il contatore passa da «Applica 2» a «Applica 3» quando
si accetta anche l'eliminazione; planner AI → «Metti 3 · 5h 15m»; planner
manuale → «Metti 2 · 2h 35m»; analisi OKR con riformulazione applicabile;
bottom-sheet su 390px. Nessun errore in console.

Due ritocchi nati dagli screenshot: le date nei motivi si leggono ora come si
direbbero a voce («scade dopodomani», non «scade il 2026-07-31»), e «1
blocchi» è diventato «1 blocco».

### Resta da fare
- Il rituale di **shutdown** userà `app/api/ai/shutdown` — la route c'è ed è
  già difensiva sugli orari fuori dagli spazi liberi, l'interfaccia arriva col
  passo 12.
- Il **kickoff** con confronto storico, sempre passo 12.

---

## Passo 12 — Kickoff, Shutdown, Impostazioni, vista Settimana

### Fatto

**I due riti — `lib/rituals.ts`, 16 test**

Il **kickoff** mostra la giornata, chiede l'Highlight se manca, e confronta
il piano con la realtà: *«Stai pianificando 5h, di solito ne esegui 3h 20m»*.
Il confronto **parla solo se lo scarto supera il 25%**: ripetere «sei in
linea» ogni mattina è rumore, e dopo tre giorni non lo legge più nessuno.
Serve anche uno storico di almeno tre shutdown, e i giorni senza niente in
programma sono esclusi dalla media — le domeniche vuote abbasserebbero la
media di chi lavora cinque giorni su sette, e il confronto direbbe una cosa
falsa.

Lo **shutdown** riepiloga la giornata e poi fa la domanda scomoda, **una per
ogni blocco rimasto indietro**: *Domani · In Lista · Fatto · Lascia perdere*.
Nessun rinvio automatico, e un **tetto di tre riporti**: raggiunto il terzo,
«Domani» si disattiva sugli altri. È la parte antipatica del rito ed è
voluta — senza, lo shutdown diventerebbe un pulsante «sposta tutto a domani»
e domani erediterebbe una giornata già persa. Chi sceglie «Domani» può
chiedere all'AI **dove** metterli, e i suggerimenti fuori dagli spazi liberi
li scarta la route prima ancora di mostrarli.

Nessuno dei due si apre da solo. Una riga in cima al calendario invita al
rito quando è il momento — mattina o sera — e si può togliere: un dialog che
compare addosso appena si carica la pagina viene chiuso per riflesso.

**Impostazioni**, cinque schede, tutte con salvataggio immediato: sono
preferenze, non un modulo, e un pulsante «Salva» qui produrrebbe solo
modifiche perse chiudendo la scheda.
- *Giornata*: orari, fasce di picco e di calo, respiro fra i blocchi, tetto
  giornaliero, micro-avvio, tema. Menu invece di campi liberi — un campo di
  testo per «08:00» significa accettare «8», «8.00», «otto» e poi doverli
  interpretare.
- *Progetti*: creazione, rinomina in linea, colore dalla palette, archivio.
  L'eliminazione dice **prima quanti task tocca** e cosa succede loro
  (restano in Lista senza progetto).
- *Ricorrenti*: quotidiane o su giorni scelti, con progetto, durata e orario.
  Restano **modelli**: generare trenta occorrenze in anticipo riempirebbe il
  futuro di blocchi e renderebbe ogni cambio d'orario una migrazione.
- *Google*: account, calendari con colore, e l'interruttore di scrittura —
  spento di default, con **conferma esplicita alla prima accensione**, perché
  da quel momento un blocco spostato qui cambia un evento là, sotto gli occhi
  di altre persone.
- *Dati*: export e import JSON.

**Export/import — `lib/backup.ts`, 11 test.** Il file non contiene `user_id`
né i timestamp: un export deve poter rientrare in un altro account. L'import
**aggiunge, non sostituisce** — sovrascrivere sarebbe l'operazione più
distruttiva dell'app e non c'è modo di annullarla con un toast da cinque
secondi — riusa gli id del file (così reimportarlo due volte non crea
doppioni) e mostra il conteggio di ciò che sta per entrare prima di
procedere. Un file scelto per sbaglio fallisce **in lettura**, con un
messaggio, non a metà importazione.

**Vista Settimana.** Non è la vista giorno moltiplicata per sette: niente
trascinamento, niente resize. Serve a vedere la *forma* della settimana —
dove si accumula, dove c'è aria — e per farlo deve stare in uno schermo. La
finestra si allarga da sé se un blocco esce dagli orari di lavoro; toccare un
giorno riporta alla vista giorno, che è dove si lavora.

**293 test** in tutto.

### Difetto trovato dallo screenshot
Nella prima versione della settimana i blocchi erano tutti a larghezza piena:
un task e una riunione Google sovrapposti si coprivano a vicenda, e in una
colonna larga un settimo di schermo «coperto» vuol dire «sparito». Ora la
settimana usa lo stesso `layoutOverlaps` della vista giorno, e i due si
dividono la colonna.

Corretta anche l'ennesima pluralizzazione italiana: «Rispondi a 1 blocchi» →
«Rispondi all'ultimo blocco».

### Verificato nel browser
Vista settimana (totale corretto, zoom che sparisce perché non c'è niente da
ingrandire, giorno cliccabile che riporta indietro), le cinque schede delle
impostazioni, il kickoff con il riepilogo della giornata, e lo shutdown fino
al tetto: al quarto blocco «Domani» risulta effettivamente disabilitato e il
contatore segna «0 riporti su 3». Nessun errore in console.

### Nota operativa
`npm run build` mentre gira `next dev` sulla stessa cartella lascia il server
di sviluppo con una `.next` che non è più la sua: le pagine cominciano a
rispondere 404. È lo stesso inciampo del passo 11, in una forma diversa. Non
è un difetto dell'app.

### Resta da fare
- Passo 13: stati vuoti rimanenti, undo dove manca, a11y, virtualizzazione
  del calendario oltre le 200 righe, service worker PWA (che abiliterebbe
  anche i pulsanti azione delle notifiche, rimandati dal passo 8).

---

## Passo 13 — Rifinitura: PWA, accessibilità, performance, deploy

### Accessibilità: nove violazioni trovate e corrette

Aggiunti due controlli eseguibili, perché «abbiamo messo gli aria-label» non
è una verifica:

- **`npm run a11y`** — axe su sette schermate, in tema chiaro **e scuro**.
- **`npm run keyboard`** — fuoco visibile, raggiungibilità col Tab, e
  dimensione dei bersagli tattili a 390px.

Cosa hanno trovato:

1. **`--ink-faint` a 2.6:1**, dove serve 4.5. Era il grigio di etichette,
   suggerimenti e segnaposto: leggibile per me, non per chi guarda lo schermo
   al sole. Rifatti i due grigi e l'ambra.
2. **I «fatto» si spegnevano con l'opacità**, portando sotto soglia anche il
   testo. Ora si smorza lo **sfondo**: un blocco completato resta leggibile,
   perché è ancora la prova di come è andata la giornata.
3. **Tre colori della palette non reggevano il bianco** — blu 4.39, cuoio
   4.19, oliva 3.75 — e nessuno dei colori regge l'inchiostro scuro. Corretti
   nella palette e, soprattutto, aggiunto **`blockSurface`**: scurisce
   qualunque colore a passi del 4% fino alla soglia. Serve perché i colori
   arrivano dal database e possono essere stati scelti prima di questa regola.
   Coperto da un test che gira su tutto lo spazio RGB a passi di 51.
4. **`nested-interactive`**: dnd-kit metteva `role="button"` e `tabIndex` sul
   blocco del calendario, che contiene altri tre controlli. Rimossi: il
   trascinamento col puntatore resta, e da tastiera un blocco si sposta
   aprendolo e usando «Sposta a…», che è anche più preciso.
5. **`aria-hidden-focus`**: i campi della CaptureBar collassata erano nascosti
   agli screen reader ma raggiungibili col Tab — il caso peggiore, il fuoco
   finisce in un campo alto zero pixel che non viene annunciato. Aggiunto
   `inert`.
6. **Bersagli tattili sotto i 44px** su telefono: chip cliccabili (25×23),
   segmentati (32px), pulsanti nei banner (40px), striscia dei giorni.
   Corretti con `min-height`/`min-width` che si stringono da 1080px in su,
   dove c'è un puntatore.

Sette giorni da 44px più due frecce da 44 fanno 396: su un telefono da 390 non
ci stanno, e stringere i giorni a 43 per far quadrare i conti sarebbe barare.
**La striscia scorre invece di comprimersi.**

I comandi dentro i blocchi (▶ e ✓, 24×24) restano un'**eccezione dichiarata**,
non una dimenticanza: portarli a 44px coprirebbe il blocco che devono
comandare, e la stessa azione esiste a dimensione piena nel pannello del task.
È il caso previsto da WCAG 2.2 §2.5.8; lo script lo elenca a parte e verifica
che il minimo di 24px sia rispettato.

### Un difetto scoperto guardando altrove

`toGoogleColorId` scendeva sul colore più vicino in **distanza euclidea RGB**.
Sembra la scelta ovvia e sbaglia in modo visibile: il verde bosco di Flusso ha
come vicino numerico il **grigio** di Google, perché è più spento dei verdi
saturi della tavolozza. Sul calendario condiviso i blocchi risultavano grigi,
cioè privi dell'unica informazione che il colore doveva dare. Ora la scelta è
per **tinta**, con la luminosità come spareggio fra verde chiaro e scuro, e i
colori senza tinta vanno nel grigio perché è dove appartengono. 19 test.

### PWA e notifiche complete

Il service worker esiste per **una** ragione: i pulsanti «Inizia» e «Rimanda
15 min» nelle notifiche di inizio blocco. Una `new Notification()` creata dal
documento non supporta le azioni; solo `registration.showNotification` sì. Era
il pezzo rimandato dal passo 8.

Strategia **rete prima, cache come rete di sicurezza**, mai il contrario: un
calendario è utile solo se dice la verità adesso. Più una pagina di cortesia
offline che lo dice a parole. In sviluppo il worker **non si registra**: un
worker che serve una cache mentre si ricompila è il modo più rapido per
inseguire un difetto che non esiste.

«Rimanda 15 min» **non conta come rinvio** e non incrementa il contatore:
rinviare è mandare una cosa a un altro giorno, questo è finire la telefonata
prima di cominciare. Confonderli farebbe scattare il dialogo del terzo rinvio
per tre pause caffè.

### Performance: misurata, non supposta

La specifica chiede il calendario virtualizzato oltre le 200 righe. Misurato:
**223–260 nodi DOM** a ogni livello di zoom, perché la finestra visibile si
adatta al contenuto e le righe sono al massimo 96 su una giornata intera.
Virtualizzarlo sarebbe stata macchineria per niente.

Quello che cresce senza limite è la **Lista**. Lì c'è un taglio a 150 card con
«Mostra altri N». Un taglio e non una finestra scorrevole: la virtualizzazione
rompe `Ctrl+F` del browser e la selezione del testo, e qui il caso d'uso non è
scorrere mille task ma trovarne uno — cosa che si fa coi filtri.

### Un difetto trovato provando la build di produzione

Con la rete che non raggiungeva Supabase, il pulsante «Accedi» girava **per
sempre**: nessun messaggio, nessun modo di sapere se era andata o no.
Aggiunto un limite di 20 secondi a tutte le chiamate di autenticazione, con un
messaggio che dice anche la cosa che serve sapere: *«quello che hai scritto è
ancora qui»*. 7 test.

### Undo completato
Aggiunto dove mancava: eliminazione di una ricorrenza, e «lascia perdere»
dentro lo shutdown — anche in un rito la scelta si fa in fretta, in fondo a
una giornata stanca.

### Verificato
- `npm run a11y`: **nessuna violazione** su sette schermate e due temi.
- `npm run keyboard`: fuoco visibile, tutto raggiungibile, bersagli a norma.
- Build di produzione servita con `next start`: `/app` senza sessione
  reindirizza a `/login`, il manifest e il service worker si servono, la
  pagina offline c'è, e il login riporta l'errore di rete invece di restare
  appeso.
- **319 test.**

### Nota operativa, la terza volta
`npm run build` mentre gira `next dev` sulla stessa cartella lascia il server
di sviluppo con una `.next` che non è più la sua, e le pagine cominciano a
rispondere 404. Ormai è un riflesso: dopo ogni build, riavviare il dev.

### Il link
`docs/deploy.md` è la guida click-by-click a Vercel, con la tabella delle
variabili e i due passi che si dimenticano sempre — le Redirect URLs di
Supabase e il redirect URI di Google. `scripts/deploy-vercel.sh` fa la stessa
cosa in un comando, se si ha un token Vercel: carica le variabili da
`.env.local`, pubblica, poi scrive `APP_URL` col dominio assegnato e
ripubblica, perché quel valore non si può sapere prima.

Verificato che la build **passa anche senza nessuna variabile d'ambiente**: su
Vercel il primo deploy non fallisce prima che si faccia in tempo a impostarle.
