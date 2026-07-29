# Mettere Flusso online

Obiettivo: un indirizzo tipo `https://flusso-qualcosa.vercel.app` che apri dal
telefono e usi davvero. Ci vogliono **circa dieci minuti**, tutti di click.

Perché serve un servizio esterno: Flusso non è un sito di pagine ferme. Ha
bisogno di un server che gira — per parlare con Supabase, con Anthropic e con
Google Calendar senza mai far uscire le chiavi dal browser. Quel server va
messo da qualche parte, e Vercel lo fa gratis per un progetto personale.

---

## Prima di cominciare: cosa devi avere sotto mano

1. **L'account GitHub** con cui vedi il repository `flusso-ai-new`.
2. **Le chiavi Supabase**, dalla dashboard del progetto → *Project Settings* →
   *API* (le stesse di `docs/setup.md`, §1.5).
3. **La chiave Anthropic**, da console.anthropic.com.
4. Se vuoi anche Google Calendar: le credenziali OAuth di `docs/setup.md`, §3.
   Puoi rimandarlo: senza, tutto il resto funziona.

> Non serve installare niente sul tuo computer. Nessun comando da terminale.

---

## Passo 1 — Crea l'account Vercel

1. Vai su **https://vercel.com/signup**.
2. Scegli **Continue with GitHub** e autorizza.
3. Quando chiede il tipo di account scegli **Hobby** (gratuito) e metti il tuo
   nome. *Hobby* basta: il limite è sull'uso commerciale, non sulle funzioni.

## Passo 2 — Importa il repository

1. Nella dashboard premi **Add New…** → **Project**.
2. Nell'elenco cerca **`flusso-ai-new`** e premi **Import**.
   - Se non lo vedi: **Adjust GitHub App Permissions** → dai accesso a quel
     repository → torna indietro.
3. Vercel riconosce Next.js da sé. **Non toccare** *Build Command* né *Output
   Directory*: sono già giusti.
4. Apri **Environment Variables** e aggiungi le voci del passo 3.

   > Sotto *Branch* scegli **`claude/flusso-rebuild-zero-fn19ua`** se il lavoro
   > non è ancora stato unito a `main`: altrimenti Vercel pubblicherebbe un
   > `main` vuoto e vedresti una pagina di errore senza capire perché.

## Passo 3 — Le variabili d'ambiente

Per ognuna: scrivi il **nome** a sinistra, incolla il **valore** a destra,
premi **Add**. Lascia spuntati tutti e tre gli ambienti.

| Nome | Dove lo trovi | Serve a |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* | dire all'app dov'è il database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | stessa pagina → *Publishable key* (`sb_publishable_…`) | leggere e scrivere **come te**, protetto dalle RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | stessa pagina → *Secret key* (`sb_secret_…`) | solo i token Google cifrati; **mai** nel browser |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | cattura magica, planner, analisi OKR |
| `APP_URL` | l'indirizzo che Vercel ti darà, es. `https://flusso-ai-new.vercel.app` | costruire i link di conferma e i redirect OAuth |

Al primo giro l'indirizzo non lo conosci ancora: **metti `APP_URL` alla fine**,
dopo il passo 5, e ripubblica. Oppure inseriscila subito indovinando il nome
del progetto e correggila se sbagli.

Se vuoi Google Calendar, aggiungi anche:

| Nome | Valore |
|---|---|
| `GOOGLE_CLIENT_ID` | dal client OAuth "Web application" |
| `GOOGLE_CLIENT_SECRET` | idem |
| `GOOGLE_TOKEN_SECRET` | una stringa casuale lunga, la generi tu |
| `GOOGLE_WEBHOOK_SECRET` | un'altra stringa casuale |

Per le due stringhe casuali va bene qualunque cosa lunga e senza senso: aprile
da un generatore di password, 40 caratteri. Servono a **cifrare i token
Google** e a firmare i canali di notifica: se cambiano, gli account Google
vanno ricollegati, quindi salvale in un posto sicuro.

## Passo 4 — Pubblica

Premi **Deploy** e aspetta. Due o tre minuti.

Se compare un errore rosso: apri **Building** e leggi le ultime righe. Nove
volte su dieci è il nome di una variabile scritto male — `NEXT_PUBLIC_SUPBASE_URL`
invece di `NEXT_PUBLIC_SUPABASE_URL` e simili.

## Passo 5 — Di' a Supabase qual è il tuo indirizzo

Questo passo si dimentica sempre, e senza di lui **i link di conferma
dell'email non tornano indietro**: clicchi, e finisci su `localhost`.

1. Dashboard Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: il tuo indirizzo Vercel, es. `https://flusso-ai-new.vercel.app`.
3. **Redirect URLs**, aggiungi tutte queste righe:
   ```
   http://localhost:3000/**
   https://flusso-ai-new.vercel.app/**
   ```
   Gli asterischi servono: i nostri redirect portano dietro un `?next=…`, e
   senza il jolly Supabase li rifiuta perché non combaciano carattere per
   carattere.
4. **Save**.

## Passo 6 — Aggiorna `APP_URL` e ripubblica

1. Vercel → il progetto → **Settings** → **Environment Variables**.
2. Correggi `APP_URL` con l'indirizzo vero.
3. **Deployments** → il primo della lista → menù `⋯` → **Redeploy**.

## Passo 7 — Se vuoi Google Calendar

Google Cloud Console → **Credentials** → il tuo client OAuth → in
**Authorized redirect URIs** aggiungi:

```
https://flusso-ai-new.vercel.app/api/google/callback
```

È l'unico URI da registrare: tutto il resto passa da lì.

---

## Come capisci che ha funzionato

Apri l'indirizzo dal telefono:

1. La pagina di benvenuto si carica.
2. **Registrati** con la tua email → arriva la mail di conferma → il link ti
   riporta **sul tuo indirizzo**, non su localhost.
3. Dentro, scrivi qualcosa nella barra di cattura: se compare in Lista, il
   database risponde.
4. Premi la bacchetta 🪄 e detta una frase: se torna una proposta, anche
   l'AI funziona.
5. **Aggiungi alla schermata Home**: da lì Flusso si apre a tutto schermo,
   come un'app, e le notifiche di inizio blocco arrivano con i pulsanti
   *Inizia* e *Rimanda 15 min*.

## Ancora da fare, sul database

Se non l'hai già fatto, applica le migrazioni `0002` e `0003` seguendo
`docs/da-fare-tu.md`. La `0003` in particolare **toglie ogni privilegio al
ruolo anonimo**: senza di lei i tuoi dati restano protetti dalle RLS, ma da
un solo strato invece di due.

## Una nota sulle chiavi

Le chiavi che mi hai incollato in chat sono passate in un messaggio, quindi
vanno considerate compromesse: **ruotale** (Supabase → API → *Rotate*;
Anthropic → *Revoke* e crea una nuova) e metti le nuove **solo** nelle
Environment Variables di Vercel e nel tuo `.env.local`. Non serve che me le
ridica: scrivimi «chiavi ruotate» e proseguo.
