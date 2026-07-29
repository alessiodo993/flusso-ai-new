# Messa in funzione

Da repository vuoto ad app funzionante. Il passo 1 è l'unico indispensabile
per far partire qualcosa: AI e Google Calendar si possono aggiungere dopo.

---

## 1. Supabase — progetto e migrazione

### 1.1 Crea il progetto

Su [supabase.com](https://supabase.com) → **New project**. Scegli una region
europea (`eu-central-1` o `eu-west-1`): la latenza di ogni singola query passa
di lì. Segnati la password del database, serve solo se userai la CLI.

### 1.2 Applica la migrazione

Il file è **`supabase/migrations/0001_flusso.sql`**. Due strade.

**Strada A — SQL editor (più semplice, consigliata la prima volta)**

1. Dashboard → **SQL Editor** → **New query**.
2. Incolla **tutto** il contenuto di `supabase/migrations/0001_flusso.sql`.
3. **Run**.
4. Ripeti per **ogni** file in `supabase/migrations/`, in ordine di numero:
   `0002_google_channels.sql`, `0003_revoke_anon.sql`, e così via.
   La `0003` non è facoltativa — vedi il riquadro qui sotto.

Deve finire con `Success. No rows returned`. Se ti fermi a metà per un errore,
non rilanciare il file da capo: le tabelle già create farebbero fallire i
`CREATE TABLE`. Riparti da un database pulito con
`drop schema public cascade; create schema public;` (**cancella tutti i
dati**) e poi rilancia.

**Strada B — CLI (da usare per le migrazioni successive)**

```bash
npm i -g supabase
supabase login
supabase link --project-ref <il-tuo-project-ref>   # sta nell'URL del progetto
supabase db push
```

La CLI tiene traccia di cosa ha già applicato, quindi è la strada giusta
quando le migrazioni diventeranno più di una.

### 1.3 Verifica che sia andata

Nel SQL editor:

```sql
-- Devono uscire 12 tabelle, tutte con rowsecurity = true.
select tablename, rowsecurity
from pg_tables where schemaname = 'public'
order by tablename;

-- Ogni tabella deve avere la sua policy (google_accounts ha quella di servizio).
select tablename, policyname from pg_policies where schemaname = 'public';

-- Il trigger sulla registrazione deve esistere.
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;
```

Un controllo più severo lo puoi fare in locale, senza toccare il progetto
vero: con un PostgreSQL raggiungibile,

```bash
npm run db:test
```

applica la migrazione a un database usa e getta e ci lancia contro trenta
verifiche su RLS, permessi, trigger e vincoli.

> ### Perché la migrazione `0003` è necessaria
>
> Ogni progetto Supabase nasce con questa impostazione:
>
> ```sql
> alter default privileges in schema public
>   grant all on tables to postgres, anon, authenticated, service_role;
> ```
>
> Vale per **ogni tabella creata dopo**, comprese le nostre. Il risultato è che
> `anon` — il ruolo della chiave pubblicata nel bundle del browser — ottiene
> `SELECT`, `INSERT`, `UPDATE` e `DELETE` su tutto, `google_accounts` inclusa,
> anche se la migrazione `0001` non gli concede nulla.
>
> I dati restano protetti dalle RLS, che senza policy per `anon` negano ogni
> riga. Ma è **una protezione sola**: basterebbe una tabella futura con la RLS
> dimenticata perché quella chiave diventi una chiave di lettura. La `0003`
> revoca quei privilegi e annulla il default per le tabelle future.
>
> Il difetto è emerso interrogando un progetto vero, non in locale: il
> PostgreSQL usa e getta dei test non aveva quei default. Ora
> `supabase/tests/harness.sql` li riproduce, e `npm run db:test` fallisce se
> la `0003` manca.

> **Il linter di Supabase segnalerà `google_accounts_public` come
> "security definer view".** È voluto: quella vista serve a mostrare
> all'interfaccia *quali* account Google sono collegati senza dare a
> `authenticated` alcun permesso sulla tabella che contiene i token. Filtra da
> sé per `auth.uid()` e non espone nessuna colonna cifrata.

### 1.4 Configura l'autenticazione

**Dove**: barra laterale → **Authentication** → **URL Configuration**.
(In alcune versioni della dashboard la stessa pagina sta sotto
*Project Settings → Authentication*.)

Ci sono due campi, e fanno due cose diverse.

#### Site URL — un valore solo

È l'indirizzo **di riferimento** del progetto. Supabase lo usa in due modi:

1. come `{{ .SiteURL }}` nei **template delle email** (conferma registrazione,
   recupero password, inviti);
2. come destinazione di ripiego quando il codice non passa alcun `redirectTo`,
   o quando quello passato non è nell'elenco del punto successivo.

Metti l'indirizzo dell'ambiente **che userai davvero**:

| Ambiente | Site URL |
|---|---|
| Sviluppo | `http://localhost:3000` |
| Produzione | `https://<tuo-dominio>` |

> **Il tranello più comune.** Se in produzione lasci `http://localhost:3000`,
> le email di conferma arrivano con un link a localhost: sul telefono di chi
> le riceve non aprono niente. È lo stesso campo, quindi vale la pena
> cambiarlo appena il dominio esiste.

#### Redirect URLs — un elenco di indirizzi ammessi

Non è una destinazione: è una **lista di permessi**. Quando il codice chiede a
Supabase di rimandare l'utente da qualche parte, Supabase confronta quella
richiesta con questo elenco. Se non c'è, **non fallisce con un errore**:
rimanda silenziosamente al Site URL — ed è per questo che il sintomo tipico è
«accedo e mi ritrovo al punto di partenza», senza nessun messaggio.

Flusso chiede tre redirect, tutti verso `/auth/callback` e tutti **con una
query string** (`?next=…`, che serve a riportare l'utente dov'era):

| Da dove | Cosa passa il codice |
|---|---|
| `components/auth/login-form.tsx` (registrazione) | `…/auth/callback?next=/app` |
| `components/auth/login-form.tsx` (accesso Google) | `…/auth/callback?next=/app` |
| `components/auth/reset-password-form.tsx` | `…/auth/callback?next=/reset-password` |

Poiché c'è sempre una query string, **la voce esatta senza parametri non
basta**. Usa la forma con carattere jolly, che copre tutti i casi presenti e
futuri:

```
http://localhost:3000/**
https://<tuo-dominio>/**
```

Il jolly vale solo dentro **domini che possiedi tu**, quindi non allarga la
superficie: quello che questa lista deve impedire è che qualcuno faccia
rimbalzare il token verso un dominio *altrui*.

> **Preview di Vercel.** Ogni deploy di anteprima ha un sottodominio diverso,
> quindi non sarà nell'elenco e l'accesso lì non funzionerà. Puoi aggiungere un
> pattern tipo `https://*-<tuo-team>.vercel.app/**`, ma è più semplice provare
> l'autenticazione in locale o in produzione.

#### Providers → Google (facoltativo)

Serve solo se vuoi il pulsante «Continua con Google» nella schermata di
accesso. Incolla client ID e secret di un client OAuth Google e registra **in
Google Cloud** il redirect che Supabase ti mostra in quella schermata:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Attenzione: è un client **diverso** e per uno scopo diverso da quello del
calendario (punto 3). Quello serve a *far entrare* l'utente in Flusso, questo a
*leggere e scrivere* i suoi eventi. Possono stare nello stesso progetto Google
Cloud, ma i redirect non si mescolano.

---

### 1.5 Prendi le chiavi

**Dove**: icona dell'ingranaggio (**Project Settings**) → **API**. Nelle
dashboard più recenti le chiavi hanno una loro pagina, **API Keys**.

Servono tre valori:

| Nella dashboard | Che aspetto ha | Variabile |
|---|---|---|
| **Project URL** | `https://abcdwxyz.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** | stringa lunghissima che inizia per `eyJ…` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role / secret** | uguale a vedersi, ma marcata *secret* | `SUPABASE_SERVICE_ROLE_KEY` |

> Se il tuo progetto mostra invece chiavi che iniziano per `sb_publishable_…` e
> `sb_secret_…`, è il formato nuovo: vanno negli stessi due posti, la
> publishable al posto della anon e la secret al posto della service_role.

**Perché due chiavi, e perché una è pubblica.** La `anon` finisce nel bundle
del browser: chiunque apra gli strumenti da sviluppatore la vede, ed è
previsto. Non è un lasciapassare, è solo il modo di dire «sono un utente
qualunque di questo progetto»; a decidere cosa può leggere e scrivere sono le
**RLS** applicate al punto 1.2. È esattamente per questo che quel passaggio
non era facoltativo.

La `service_role` invece **scavalca le RLS**: chi ce l'ha legge e scrive i dati
di chiunque. In Flusso la usa un solo file — `lib/supabase/admin.ts`, per i
token Google cifrati, che non hanno alcun permesso per `authenticated` — e
`lib/env.ts` solleva un errore se qualcuno prova a leggerla dal browser.

#### Dove metterle

Crea `.env.local` nella radice del progetto (`cp .env.example .env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdwxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi…
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi…
APP_URL=http://localhost:3000
```

Tre cose da sapere:

- **Il prefisso `NEXT_PUBLIC_` non è decorativo.** Dice a Next di sostituire
  quel valore dentro il codice del browser durante il build. Tutto ciò che
  porta quel prefisso è pubblico per definizione: non metterci mai un segreto.
- **`.env.local` non finisce in git.** Il `.gitignore` blocca ogni `.env*`,
  con la sola eccezione di `.env.example`, che è la mappa dei nomi senza i
  valori.
- **Dopo averlo modificato, riavvia `npm run dev`.** Le variabili si leggono
  all'avvio, non a ogni richiesta.

#### Verifica che funzioni

```bash
npm run dev
```

Apri `http://localhost:3000/login`, registrati con un'email vera, e controlla
nella dashboard:

- **Authentication → Users**: deve esserci il nuovo utente.
- **Table Editor → user_settings**: deve esserci **una riga** con il suo
  `user_id`. Se c'è, vuol dire che il trigger `handle_new_user` della
  migrazione ha funzionato e l'intera catena è a posto.

---

## 2. Anthropic

[console.anthropic.com](https://console.anthropic.com) → **API keys** →
crea una chiave → `ANTHROPIC_API_KEY`.

Viene usata solo dentro `app/api/ai/*`, mai dal browser. Il modello è
`claude-sonnet-5` per tutte le chiamate.

---

## 3. Google Calendar

Serve solo per la sincronizzazione del calendario. È **separato** dall'accesso
con Google del punto 1.4, anche se puoi usare lo stesso progetto Google Cloud.

1. [console.cloud.google.com](https://console.cloud.google.com) → crea o scegli
   un progetto.
2. **APIs & Services → Library** → abilita **Google Calendar API**.
3. **OAuth consent screen** → tipo *External* → aggiungi il tuo indirizzo fra i
   *Test users* (finché l'app non è verificata, solo loro possono collegarsi).
4. **Credentials → Create credentials → OAuth client ID** → tipo
   **Web application**.
5. **Authorized redirect URIs** — è l'unico da registrare:
   ```
   http://localhost:3000/api/google/callback
   https://<tuo-dominio>/api/google/callback
   ```
6. Copia client ID e secret in `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
7. Genera la chiave con cui l'app cifra i token prima di salvarli:
   ```bash
   openssl rand -base64 32
   ```
   → `GOOGLE_TOKEN_SECRET`.

---

## 4. Ambiente locale

```bash
cp .env.example .env.local   # poi riempi i valori
npm install
npm run dev
```

`.env.local` non finisce mai in git (`.gitignore` blocca tutti i `.env*`,
tranne `.env.example`).

Controlli utili prima di aprire una pull request:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

---

## 5. Vercel

1. **Add New → Project** → importa il repository. Next.js viene riconosciuto da
   solo, non serve toccare i comandi di build.
2. **Settings → Environment Variables**: aggiungi **tutte** le variabili di
   `.env.example`, per gli ambienti *Production*, *Preview* e *Development*.
   `APP_URL` deve valere l'URL vero dell'ambiente.
3. Deploy.
4. Torna indietro e aggiungi il dominio Vercel dove serve:
   - Supabase → *Redirect URLs* (punto 1.4);
   - Google Cloud → *Authorized redirect URIs* (punto 3.5).

> Le **preview** hanno un dominio diverso a ogni deploy, quindi i redirect
> OAuth non funzioneranno lì a meno di registrare quel dominio a mano. Per
> provare l'accesso con Google e il calendario, usa locale o produzione.

---

## Cosa fare se

**«Variabile d'ambiente mancante: …»** — manca in `.env.local` o su Vercel.
Dopo averla aggiunta su Vercel serve un nuovo deploy: le variabili si leggono
al build.

**Il login va a buon fine ma torno alla pagina di accesso** — il dominio non è
fra i *Redirect URLs* di Supabase, oppure `APP_URL` non corrisponde a quello da
cui stai navigando.

**`permission denied for table …`** — la migrazione non è stata applicata, o si
è fermata a metà. Rilancia la verifica del punto 1.3.

**Le impostazioni non esistono per un account** — il trigger
`on_auth_user_created` è stato installato dopo la registrazione di
quell'utente. L'app se ne accorge e crea la riga da sé al primo accesso; in
alternativa:
```sql
insert into public.user_settings (user_id)
select id from auth.users on conflict do nothing;
```
