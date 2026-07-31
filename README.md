# Flusso

Sistema personale di deep work, in italiano. Il modello mentale è uno e non si
viola: **cattura → triage → pianifica → esegui → calibra**. Il calendario è la
fonte di verità — *se non è sul calendario, non succede.*

- **Cattura** senza attrito: un titolo, nient'altro di obbligatorio.
- **Triage** in Lista: progetto, scadenza, stima, energia.
- **Pianifica** con l'AI, che scegli *cosa* fare; gli orari li calcola un
  solver deterministico, perché finestre, buffer e tetti giornalieri sono
  aritmetica e non vanno affidati a un modello linguistico.
- **Esegui** in Focus Mode, con il tempo reale che viene registrato.
- **Calibra**: dalle ultime 30 sessioni esce un coefficiente di ottimismo, e
  le stime future vengono corrette da lì. «Sottostimi del 35%» è un numero
  verificabile, non un'impressione.

---

## Mettilo online in un click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Falessiodo993%2Fflusso-ai-new%2Ftree%2Fclaude%2Fflusso-rebuild-zero-fn19ua&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,APP_URL&envDescription=Chiavi%20Supabase%20e%20Anthropic&envLink=https%3A%2F%2Fgithub.com%2Falessiodo993%2Fflusso-ai-new%2Fblob%2Fclaude%2Fflusso-rebuild-zero-fn19ua%2Fdocs%2Fdeploy.md)

Il pulsante apre Vercel già puntato su questo repository e ti chiede solo i
cinque valori che servono. `APP_URL` è l'unico che non puoi sapere in
anticipo — lo assegna Vercel: mettici un segnaposto, e correggilo dopo il
primo deploy.

Poi restano **due passi su servizi altrui**, quelli che si dimenticano sempre:
le *Redirect URLs* di Supabase (senza le quali i link di conferma dell'email
tornano su `localhost`) e, solo se vuoi Google Calendar, il redirect URI del
client OAuth. Sono spiegati click per click in **[`docs/deploy.md`](docs/deploy.md)**.

> Se preferisci non passare dal pulsante: `npm run deploy` fa tutto da riga di
> comando con un token Vercel, `APP_URL` compresa.

---

## In locale

```bash
npm install
cp .env.example .env.local     # e riempilo: vedi docs/setup.md
npm run dev
```

Poi `http://localhost:3000`. Senza un progetto Supabase configurato l'app si
carica ma non ha dati: la creazione del progetto e le migrazioni sono in
[`docs/setup.md`](docs/setup.md), e le operazioni che restano da fare a mano
in [`docs/da-fare-tu.md`](docs/da-fare-tu.md).

`/anteprima` mostra la shell riempita di dati finti, senza toccare la rete.
Esiste solo in sviluppo.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | build di produzione |
| `npm test` | 399 test su tutta la logica pura |
| `npm run typecheck` | TypeScript in modalità strict |
| `npm run lint` | ESLint |
| `npm run db:test` | applica le migrazioni su un Postgres locale e verifica RLS e privilegi |
| `npm run a11y` | axe su sette schermate, tema chiaro e scuro |
| `npm run keyboard` | fuoco visibile, navigazione col Tab, bersagli tattili |
| `npm run allineamento` | i controlli di riga allineati alla prima riga del titolo |
| `npm run cattura` | cattura magica e planner nel browser, con le route AI finte |
| `npm run ai:vero` | i prompt contro il modello vero (serve `ANTHROPIC_API_KEY`, e costa) |
| `npm run shots` | screenshot delle schermate principali |
| `npm run deploy` | pubblica su Vercel (serve `VERCEL_TOKEN`) |

I controlli col browser — `a11y`, `keyboard`, `allineamento`, `cattura` —
vogliono `npm run dev` già avviato in un altro terminale.

`npm run ai:vero` è l'unico che chiama davvero il modello: gli altri test
dimostrano che il codice regge qualunque risposta, quello guarda se le
risposte sono **buone**. Sta fuori da `npm test` apposta: costa e vuole rete.

## Com'è fatto

| Pezzo | Scelta |
|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript strict |
| Stile | Tailwind v4 con `@theme inline`; nessun componente scrive un colore a mano, tranne i colori dei progetti che arrivano dal database |
| Dati | Supabase Postgres con RLS su ogni tabella, nessun ORM |
| Stato | TanStack Query, mutation ottimistiche con rollback; **zero fetch dentro `useEffect`** |
| AI | Anthropic `claude-sonnet-5`, solo dentro `app/api/ai/*` |
| Fuso | sempre `Europe/Rome`; i giorni sono stringhe `YYYY-MM-DD`, gli orari minuti dalla mezzanotte |

Dove sta la logica che conta, e perché è lì:

- **`lib/planner.ts`** — il solver che colloca i blocchi. L'AI sceglie *quali*
  task e in che ordine; dove finiscono lo decide questo codice, perché un
  modello che fa aritmetica su vincoli «mai violabili» prima o poi sbaglia in
  modo plausibile, cioè nel modo peggiore.
- **`lib/calibration.ts`** — il coefficiente di ottimismo, con i rapporti
  limitati fra 0.25 e 4: un timer dimenticato aperto non deve spostare il
  numero di tutti.
- **`lib/time.ts`** — l'unico posto che sa che ore sono. Aritmetica dei giorni
  in UTC, così il cambio dell'ora non sposta niente.
- **`lib/ai/`** — schemi Zod volutamente **piatti e senza vincoli**: i limiti
  stanno nel prompt e si fanno rispettare clampando. Una stima di 9000 minuti
  diventa 480, non un errore che costringe a ridettare tutto.

## Il percorso, passo per passo

[`docs/progress.md`](docs/progress.md) racconta i tredici passi: cosa è entrato,
cosa ho scelto e perché, e ogni difetto trovato — compresi i tre che i test non
avrebbero mai preso (il modello che rifiuta il prefill dell'assistente, il verde
bosco che finiva nel grigio di Google, il pulsante «Accedi» che girava per
sempre senza un messaggio).
