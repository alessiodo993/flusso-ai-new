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

> **Il linter di Supabase segnalerà `google_accounts_public` come
> "security definer view".** È voluto: quella vista serve a mostrare
> all'interfaccia *quali* account Google sono collegati senza dare a
> `authenticated` alcun permesso sulla tabella che contiene i token. Filtra da
> sé per `auth.uid()` e non espone nessuna colonna cifrata.

### 1.4 Configura l'autenticazione

Dashboard → **Authentication**:

- **URL Configuration** → *Site URL*: `http://localhost:3000` in sviluppo, il
  dominio Vercel in produzione.
- **Redirect URLs**: aggiungi entrambi
  `http://localhost:3000/auth/callback` e
  `https://<tuo-dominio>/auth/callback`.
  Senza questi, i link di conferma e di recupero password non tornano indietro.
- **Providers → Google** (solo se vuoi l'accesso con Google): incolla client ID
  e secret di un client OAuth Google, e registra in Google Cloud il redirect
  che Supabase ti mostra in quella schermata —
  `https://<ref>.supabase.co/auth/v1/callback`.
  È un client **diverso** da quello del calendario (punto 3).

### 1.5 Prendi le chiavi

Dashboard → **Project Settings → API**:

| Dove sta | Variabile |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

La `service_role` scavalca le RLS: non deve mai finire in una variabile
`NEXT_PUBLIC_`, né in un commit.

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
