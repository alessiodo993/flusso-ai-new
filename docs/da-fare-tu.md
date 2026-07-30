# Tutto quello che devi fare tu

Questa è **l'unica lista che ti serve**. È scritta per chi non ha mai toccato
un database né un servizio di hosting: ogni punto dice *cosa* fare, *dove*
farlo e *perché* — perché sapere il perché è ciò che ti permette di capire da
solo se qualcosa è andato storto.

Non serve installare niente sul tuo computer. Non serve il terminale. Tutto si
fa dal browser, con dei click.

**Tempo totale: circa 40 minuti**, di cui metà di attesa (le email, le
pubblicazioni).

---

## Com'è la situazione adesso

Ho interrogato il tuo progetto Supabase dall'esterno poco prima di scrivere
questa guida. Questo è lo stato **vero**, non una supposizione:

| Cosa | Stato |
|---|---|
| Progetto Supabase creato (`bgwrmxkgguzsngzgwjyu`) | ✅ fatto |
| Migrazione **0001** — le 12 tabelle, le RLS, i trigger | ✅ applicata: tutte le tabelle rispondono |
| Migrazione **0002** — canali di notifica Google | ❌ **manca** (`column google_calendars.channel_id does not exist`) |
| Migrazione **0003** — revoca dei privilegi ad `anon` | ❌ **manca** (il ruolo anonimo può ancora leggere le tabelle) |
| Chiavi passate in chat | ⚠️ **da rigenerare** |
| App su un indirizzo pubblico | ❌ da fare |

Quindi: il grosso del database c'è già. Ti restano **due blocchi di SQL da
incollare**, **due chiavi da rigenerare** e **una pubblicazione**.

---

## Da quale link partire

Tienili aperti in cinque schede, li useremo tutti. I primi tre puntano già al
*tuo* progetto: non devi cercarlo.

| # | Link | A cosa serve |
|---|---|---|
| 1 | **https://supabase.com/dashboard/project/bgwrmxkgguzsngzgwjyu/sql/new** | l'editor SQL: qui incollerai i due blocchi |
| 2 | **https://supabase.com/dashboard/project/bgwrmxkgguzsngzgwjyu/settings/api-keys** | le chiavi: da copiare e da rigenerare |
| 3 | **https://supabase.com/dashboard/project/bgwrmxkgguzsngzgwjyu/auth/url-configuration** | dire a Supabase qual è l'indirizzo della tua app |
| 4 | **https://console.anthropic.com/settings/keys** | la chiave dell'AI |
| 5 | **https://vercel.com/signup** | dove l'app vivrà: è da qui che arriva il link |

Solo se vuoi anche Google Calendar serve una sesta scheda:
**https://console.cloud.google.com/apis/credentials**

---

# PARTE 1 — Completare il database (10 minuti)

## Perché

Il database è già in piedi, ma manca l'ultimo strato. Immagina una casa
finita: le porte ci sono e sono chiuse a chiave — quelle sono le **RLS**, le
regole che dicono «ogni riga appartiene a un utente e solo lui la vede». La
migrazione **0003** aggiunge il cancello del giardino: un secondo ostacolo,
prima delle porte.

Serve davvero, e non è teoria. Controllando il tuo progetto ho trovato che il
ruolo `anon` — quello che usa la chiave pubblica contenuta nel codice che
arriva al browser, visibile a chiunque apra il tuo sito — ha ancora il
permesso di *provare* a leggere ogni tabella. Le RLS lo respingono, quindi
oggi i tuoi dati sono al sicuro. Ma è una protezione sola: basterebbe una
tabella aggiunta in futuro con la RLS dimenticata perché quella chiave
pubblica diventi una chiave di lettura. Supabase concede quei privilegi **da
sé**, a ogni tabella nuova: per questo va detto esplicitamente di toglierli.

La migrazione **0002** è più semplice: aggiunge tre colonne che permettono a
Google di avvisarti *subito* quando un collega sposta una riunione. Senza,
l'app se ne accorge al controllo successivo, entro cinque minuti. Non è un
guasto, è solo più lento.

## Passo 1.1 — Apri l'editor SQL

Vai sul **link 1**: si apre un foglio bianco con un pulsante verde **Run** in
basso a destra. È una console — si incolla un comando, si preme Run, il
database risponde.

> Se chiede di accedere, entra con l'account con cui hai creato il progetto.
> Se mostra una lista di progetti, scegli quello il cui riferimento contiene
> `bgwrmxkgguzsngzgwjyu`.
>
> Se il foglio fa le bizze (testo che non si incolla, cursore impazzito),
> ricarica la pagina con `F5` e ricomincia: non hai rotto niente, i comandi
> vengono eseguiti solo quando premi Run.

## Passo 1.2 — Copia il file e incollalo, tutto insieme

C'è **un solo file** da incollare, che porta il database allo stato corretto
qualunque sia il punto in cui si trova adesso:

**https://github.com/alessiodo993/flusso-ai-new/blob/claude/flusso-rebuild-zero-fn19ua/supabase/setup-completo.sql**

1. Apri quel link.
2. In alto a destra del riquadro del codice c'è un'icona di **copia** (due
   fogli sovrapposti), con la scritta *Copy raw file* al passaggio del mouse.
   Premila: hai tutto negli appunti.
3. Torna sull'editor SQL, `Ctrl+A` per selezionare quello che c'è, `Ctrl+V`
   per sostituirlo.
4. **Run**.

Perché un file unico invece dei blocchi separati: **è ripetibile**. Ogni
istruzione è scritta per non lamentarsi se il pezzo esiste già — le tabelle
hanno `if not exists`, le policy e i trigger vengono buttati e rifatti, le
funzioni sostituite. Quindi puoi incollarlo su un database vuoto, su uno a
metà, o su uno già a posto, e il risultato è sempre lo stesso.

**Non cancella dati.** Non contiene un solo `drop table` né un `delete`: se hai
già dei task dentro, li ritrovi. L'ho verificato eseguendolo tre volte di fila
su un Postgres 16 con dei dati dentro, e i dati sono rimasti.

## Passo 1.3 — Leggi le quattro righe del riepilogo

Lo script finisce stampando una tabellina. È lì la verifica: non devi lanciare
altre query.

| Controllo | Valore giusto |
|---|---|
| Tabelle create | **12** |
| Tabelle leggibili da anonimi | **0** |
| Colonne dei canali Google | **3** |
| Trigger sulla registrazione | 1, oppure «assente — non grave» |

La riga che conta più di tutte è la seconda: `0` significa che il cancello del
giardino è chiuso.

Sull'ultima: quel trigger crea la riga delle impostazioni quando ti registri.
Su alcuni progetti Supabase non si riesce a installarlo, perché la tabella
degli utenti appartiene al servizio di autenticazione. Non è un problema:
l'app se ne accorge e crea la riga da sé al primo accesso.

Se una riga dice **ATTENZIONE**, scrivimi quale: significa che un pezzo non è
passato, e il messaggio rosso dell'editor dice quale.

---

# PARTE 2 — Rigenerare le chiavi (5 minuti)

## Perché

Mi hai incollato in chat la *secret key* di Supabase e la chiave Anthropic. Un
messaggio di chat non è un posto sicuro: resta nella cronologia della
conversazione. Quelle due vanno considerate **bruciate** e sostituite.

Non è un allarme — nessuno le sta usando. È igiene, come cambiare la serratura
dopo aver perso una copia della chiave.

Cosa potrebbe fare chi le avesse:

- la **secret key** di Supabase scavalca *tutte* le regole di sicurezza del
  database: leggerebbe e cancellerebbe qualunque cosa;
- la chiave **Anthropic** spenderebbe il tuo credito.

La chiave *publishable* (`sb_publishable_…`) invece **non** va cambiata: è
pubblica per definizione, sta dentro il codice che arriva al browser, ed è
protetta dalle RLS. È esattamente il motivo per cui la Parte 1 conta.

## Passo 2.1 — Supabase

1. Vai sul **link 2**.
2. Trova la sezione **Secret keys**, la riga della chiave che inizia con
   `sb_secret_`.
3. Tre puntini `⋯` a destra → **Revoke** (o *Delete*). Confermi: da quel
   momento la vecchia non funziona più.
4. **Create new secret key**, nome qualsiasi (es. `flusso`), e **copiala
   subito**: te la mostra una volta sola.
5. Incollala in un posto tuo e sicuro — note protette del telefono, o un
   gestore di password. La userai nella Parte 3.

## Passo 2.2 — Anthropic

1. Vai sul **link 4**.
2. Trova la chiave che stai usando → `⋯` → **Delete**.
3. **Create Key**, nome `flusso`, copia il valore (inizia con `sk-ant-`).
   Anche questa si vede una volta sola.
4. Salvala accanto all'altra.

## Passo 2.3 — Dimmelo, senza mandarmi le chiavi

Scrivimi soltanto: **«chiavi ruotate»**.

Non incollarmele. Non mi servono: le metti tu nella Parte 3, e se me le
mandassi finirebbero di nuovo in una chat.

---

# PARTE 3 — Mettere Flusso online (15 minuti)

## Perché serve un servizio esterno

Flusso non è un sito di pagine ferme, da appoggiare da qualsiasi parte. Ha
bisogno di **un server che gira**, per tre ragioni concrete:

1. parla con Anthropic usando la tua chiave, che non deve mai finire nel
   browser: la chiamata la fa il server;
2. gestisce il ritorno da Google dopo l'autorizzazione, che è un indirizzo
   vero a cui Google deve poter scrivere;
3. tiene i token di Google cifrati e li rinnova da sé quando scadono.

Vercel fa girare quel server gratis per un progetto personale, ed è fatto
dalla stessa azienda di Next.js — la tecnologia con cui Flusso è scritto —
quindi non c'è nulla da configurare a mano.

## Passo 3.1 — Crea l'account

1. **Link 5**: https://vercel.com/signup
2. **Continue with GitHub**: così Vercel vede il repository dove sta il
   codice, e non devi caricare niente a mano.
3. Autorizza.
4. Tipo di account: **Hobby**, gratuito. Il suo limite riguarda l'uso
   commerciale, non le funzioni.

## Passo 3.2 — Importa il progetto

Il modo più rapido: apri il repository su GitHub, guarda il `README.md`, e
premi il pulsante nero **Deploy with Vercel** in cima. Arrivi alla pagina già
compilata, col ramo giusto e i nomi delle variabili al posto loro.

A mano, se preferisci:

1. Dashboard Vercel → **Add New…** → **Project**.
2. Cerca **`flusso-ai-new`** → **Import**.
   - Non lo vedi? **Adjust GitHub App Permissions** → dai accesso a quel
     repository → torna indietro.
3. **Il punto che conta**: sotto *Git Branch* scegli
   **`claude/flusso-rebuild-zero-fn19ua`**.
   Il lavoro sta su quel ramo. Se lasci `main`, Vercel pubblica un ramo che
   non contiene l'app, e vedi una pagina di errore senza capire perché.
4. Non toccare *Build Command* né *Output Directory*: Vercel riconosce
   Next.js da sé, le impostazioni sono già giuste.

## Passo 3.3 — Le cinque variabili

Apri **Environment Variables**. Per ognuna: nome a sinistra, valore a destra,
**Add**. Lascia spuntati tutti gli ambienti.

| Nome (copialo esatto) | Valore | A cosa serve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bgwrmxkgguzsngzgwjyu.supabase.co` | dice all'app dov'è il database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la *publishable key*, dal link 2 | leggere e scrivere **come te**, dentro i limiti delle RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | la **nuova** secret key della Parte 2 | solo per i token Google cifrati; mai nel browser |
| `ANTHROPIC_API_KEY` | la **nuova** chiave Anthropic della Parte 2 | cattura magica, planner, analisi OKR |
| `APP_URL` | `https://flusso-ai-new.vercel.app` | costruire i link di conferma email e i ritorni da Google |

Su `APP_URL`: è l'indirizzo che Vercel sta per assegnarti, e non lo conosci
ancora. Metti quello scritto qui sopra — di solito è giusto, perché Vercel usa
il nome del repository — e al passo 3.5 controlli e correggi.

Attenzione al prefisso `NEXT_PUBLIC_`: non è decorativo. Significa «questa
finisce nel browser». Le due chiavi *senza* quel prefisso restano sul server,
ed è per questo che la secret key non lo ha.

## Passo 3.4 — Pubblica

Premi **Deploy**. Due o tre minuti: righe che scorrono, poi coriandoli.

Se compare un errore rosso, apri il pannello **Building** e leggi le **ultime**
righe. Quasi sempre è il nome di una variabile scritto male (`SUPBASE` invece
di `SUPABASE`). Correggi in *Settings → Environment Variables* e ripubblica.

## Passo 3.5 — Leggi l'indirizzo vero e correggi `APP_URL`

In cima alla pagina Vercel mostra il **Domain**, tipo
`flusso-ai-new-a1b2c3.vercel.app`. **Copialo: quello è il tuo link.**

1. **Settings** → **Environment Variables** → riga `APP_URL` → *Edit*.
2. Metti `https://` + il domain vero, **senza barra finale**.
3. Salva.
4. **Deployments** → il primo della lista → `⋯` → **Redeploy**.

Perché ripubblicare: quel valore viene letto quando l'app parte, non a ogni
richiesta. Cambiarlo senza ripubblicare non ha effetto.

---

# PARTE 4 — Dire a Supabase qual è il tuo indirizzo (2 minuti)

## Perché

Questo è il passo che si dimentica sempre, e il sintomo è confusissimo: ti
registri, ricevi l'email di conferma, premi il link… e finisci su una pagina
che non si apre, `localhost:3000`. Sembra un guasto dell'app, e non lo è.

Supabase è quello che *manda* l'email, quindi è lui che deve sapere su quale
indirizzo riportarti. Di default conosce solo `localhost`, cioè il tuo
computer.

## Passo 4.1

1. Vai sul **link 3**.
2. **Site URL**: incolla l'indirizzo del passo 3.5, es.
   `https://flusso-ai-new-a1b2c3.vercel.app`
3. **Redirect URLs** → **Add URL**, e aggiungi **due** righe, una per volta:
   ```
   https://flusso-ai-new-a1b2c3.vercel.app/**
   http://localhost:3000/**
   ```
   (col tuo indirizzo vero; la seconda serve per quando lavorerai in locale)
4. **Save**.

I due asterischi finali non sono un dettaglio. I nostri link di ritorno
portano dietro un pezzetto in più — `?next=/app`, che dice dove andare dopo
l'accesso. Supabase confronta gli indirizzi **carattere per carattere**: senza
il jolly, un link con quel pezzetto risulterebbe diverso da quello
autorizzato, e verrebbe rifiutato.

---

# PARTE 5 — Google Calendar (10 minuti, facoltativa)

**Puoi saltarla.** Senza, tutto il resto funziona: solo che il calendario
mostra i tuoi blocchi e non le riunioni prese altrove — e il pianificatore,
non conoscendole, potrebbe metterti un blocco di lavoro sopra un appuntamento
dal dentista.

Se l'attivi guadagni tre cose: gli eventi degli altri diventano **ostacoli
invalicabili** per il pianificatore; i tuoi blocchi possono comparire sul
calendario condiviso (con un interruttore che parte **spento**); gli
spostamenti arrivano subito invece che entro cinque minuti.

## Passo 5.1 — Crea le credenziali

1. Vai su **https://console.cloud.google.com/apis/credentials**
2. In alto, se non hai un progetto: **Select a project** → **New Project** →
   nome `Flusso` → **Create**.
3. Menù di sinistra → **OAuth consent screen**:
   - *User Type*: **External** → **Create**
   - *App name*: `Flusso`; *User support email* e *Developer contact*: la tua
     → **Save and Continue**
   - *Scopes*: **Add or Remove Scopes**, cerca `calendar`, spunta
     `.../auth/calendar` → **Update** → **Save and Continue**
   - *Test users*: **Add Users** → **metti la tua email** → **Save**

     Questo punto è obbligatorio: finché l'app non è verificata da Google,
     solo gli indirizzi elencati qui possono collegarsi. Se lo salti, al
     momento di collegare l'account vedrai «Accesso bloccato».
4. **Credentials** → **Create Credentials** → **OAuth client ID**:
   - *Application type*: **Web application**
   - *Name*: `Flusso web`
   - **Authorized redirect URIs** → **Add URI**:
     ```
     https://IL-TUO-INDIRIZZO.vercel.app/api/google/callback
     ```
     È **l'unico** indirizzo da registrare: tutto il collegamento passa da lì.
     Deve combaciare esattamente, `https` compreso.
   - **Create**
5. Copia **Client ID** e **Client secret**.

## Passo 5.2 — Genera la chiave di cifratura

Serve una stringa casuale lunga. Non deve significare niente: deve essere
imprevedibile. Prendi 40 caratteri da un generatore di password.

A cosa serve, in concreto: i token con cui Flusso entra nel tuo calendario
vengono salvati nel database **cifrati con questa chiave**. Chi leggesse il
database senza averla troverebbe solo rumore. La stessa chiave firma le
notifiche di Google, così una richiesta che *dice* di venire da Google ma non
porta la firma giusta viene scartata.

**Salvala.** Se la cambi, i token già salvati diventano illeggibili e gli
account Google vanno ricollegati.

## Passo 5.3 — Aggiungile su Vercel

*Settings → Environment Variables*, tre voci nuove:

| Nome | Valore |
|---|---|
| `GOOGLE_CLIENT_ID` | dal passo 5.1 |
| `GOOGLE_CLIENT_SECRET` | dal passo 5.1 |
| `GOOGLE_TOKEN_SECRET` | la stringa casuale del passo 5.2 |

Quando incolli, **incolla solo il valore**: niente virgolette, niente
`GOOGLE_CLIENT_ID=` davanti, e attenzione a non prendere una riga vuota in
fondo. Un solo a capo di troppo basta a far dire a Google che il client non
esiste — e nel pannello di Vercel il valore continua a *sembrare* giusto.
(Flusso ora questi tre casi li ripulisce e te li segnala lo stesso.)

Poi **Deployments → `⋯` → Redeploy**.

## Passo 5.4 — Verifica prima di collegare

Apri **Impostazioni → Google → Configurazione OAuth**. Vedi i valori che
Flusso sta usando davvero: Client ID per intero (non è un segreto: viaggia
in chiaro quando ti manda da Google), secret mascherato, e l'indirizzo di
ritorno da registrare.

Premi **«Verifica le credenziali con Google»**. Flusso chiede a Google se
quelle credenziali esistono, senza farti fare il giro dell'autorizzazione, e
risponde una di tre cose:

- **«Tutto a posto»** → credenziali e indirizzo di ritorno vanno bene. Se il
  collegamento fallisce lo stesso, manca la tua email fra i *Test users*.
- **«Google non conosce questo client ID»** → il valore su Vercel non è quello
  giusto, oppure il client OAuth non esiste più. Torna al passo 5.1 e
  confronta carattere per carattere.
- **«l'indirizzo di ritorno non è registrato»** → il messaggio contiene
  l'indirizzo esatto da incollare in *Authorized redirect URIs*. Accanto alla
  riga *Redirect URI* c'è un pulsante che lo copia: usalo invece di
  ritrascriverlo, perché uno slash finale di troppo è indistinguibile a
  occhio e basta a far fallire tutto.

È la stessa domanda che il collegamento fa a Google, fatta prima: se qui è
verde, il problema non è nelle credenziali.

---

# PARTE 6 — Il primo avvio (5 minuti)

## Passo 6.1 — Registrati

1. Apri il tuo indirizzo Vercel **dal telefono**.
2. **Registrati**, con la tua email e una password di almeno 8 caratteri.
3. Arriva un'email da Supabase: apri il link.
4. Devi ritrovarti **dentro l'app, sul tuo indirizzo**. Se finisci su
   `localhost`, torna alla Parte 4: manca il *Site URL*.

Alla registrazione il database crea da sé la tua riga di impostazioni: giornata
8–20, dieci minuti di respiro fra i blocchi, tetto di sei ore. Li cambi quando
vuoi da **Impostazioni → Giornata**.

## Passo 6.2 — Installala come app

- **iPhone**: *Condividi* → **Aggiungi a Home**.
- **Android**: menù `⋮` → **Installa app**.

Da lì Flusso si apre a tutto schermo, senza la barra del browser. Non è
estetica: è la condizione perché le **notifiche di inizio blocco** arrivino coi
pulsanti *Inizia* e *Rimanda 15 min*.

## Passo 6.3 — Attiva le notifiche, ma dopo

Non ti verranno chieste all'apertura, di proposito: una richiesta che arriva
prima che tu abbia capito cosa fa l'app viene negata per riflesso — e il
browser non la ripropone più.

Pianifica il primo blocco. Comparirà una riga sopra il calendario: *«Vuoi che
ti avvisi quando comincia un blocco?»* → **Attiva** → il telefono chiede il
permesso → **Consenti**.

## Passo 6.4 — Collega Google, se hai fatto la Parte 5

**Impostazioni** → scheda **Google** → **Collega Google** → scegli l'account →
accetta.

La scrittura verso Google resta **spenta**. Quando la accendi, l'app chiede una
conferma esplicita: da quel momento un blocco che sposti qui cambia un evento
là, e può essere sotto gli occhi di altre persone.

---

# PARTE 7 — Il collaudo: dieci prove

Fatele in fila. Se passano tutte, Flusso funziona.

| # | Prova | Cosa deve succedere |
|---|---|---|
| 1 | Scrivi un pensiero in **Idee** e premi Invio | compare nella lista, e il cursore **resta** nel campo per scriverne un altro |
| 2 | Trascina quell'idea in **Lista** | diventa un task |
| 3 | Aprilo, metti scadenza domani e stima 45 minuti | le pastiglie sulla card si aggiornano subito |
| 4 | Trascinalo sul **calendario** | diventa un blocco all'orario dove l'hai lasciato |
| 5 | Premi **▶** sul blocco | si apre Focus Mode col cerchio che scorre; metti in pausa e riprendi: il tempo in pausa **non** viene contato |
| 6 | Bacchetta **🪄**: *«domani devo chiamare l'idraulico e finire la relazione, tipo due ore»* | tornano **due** proposte, con stima e scadenza dedotte, da accettare una per una |
| 7 | **Pianifica con AI** → 3 giorni → *Trova gli slot* | esce un piano da correggere; il calendario **non** cambia finché non premi *Metti* |
| 8 | **Obiettivi** → crea un obiettivo con un risultato chiave → premi ✨ | l'AI dice se è misurabile e propone una riformulazione |
| 9 | Alla sera, **Chiudi la giornata** | chiede una scelta per **ogni** blocco non finito, e al quarto «Domani» il pulsante si spegne: il tetto è tre |
| 10 | **Impostazioni → Dati → Esporta** | scarica un `.json` leggibile, coi tuoi dati e senza chiavi |

Se la 6 o la 7 danno un errore che parla di credito o di chiave, il problema è
`ANTHROPIC_API_KEY` su Vercel. Se dice «troppe richieste», aspetta trenta
secondi: quello è normale.

---

## Se qualcosa non va

> **Da ora gli errori di Google si vedono.** Quando il collegamento non
> riesce, tornando sull'app compare un messaggio che dice *cosa* fare — quale
> variabile manca, quale indirizzo non combacia, dove aggiungere la tua email.
> Resta lì finché non lo chiudi. Se ne vedi uno, riportamelo com'è.

| Sintomo | Causa quasi certa | Rimedio |
|---|---|---|
| Il link della mail porta su `localhost` | manca il *Site URL* | Parte 4 |
| «Accesso bloccato» / «access_denied» collegando Google | la tua email non è fra i *Test users* | Parte 5.1, punto 3 |
| **«Errore 401: invalid_client — The OAuth client was not found»** | il `GOOGLE_CLIENT_ID` su Vercel non corrisponde a nessun client OAuth: valore sbagliato, incollato con virgolette o con un a capo, oppure client cancellato | Passo 5.4: premi *Verifica le credenziali*, poi confronta col Client ID in Google Cloud |
| Il secondo account sostituisce il primo | era un difetto nostro, corretto: «Aggiungi account» ora fa scegliere l'account | ripubblica e riprova |
| **«Errore 400: redirect_uri_mismatch»** | l'indirizzo di ritorno non è fra gli *Authorized redirect URIs* del client OAuth. Attenzione: va in *redirect URIs*, **non** in *JavaScript origins*, ed è un errore diverso dai *Test users* — pubblicare l'app non lo risolve | Google Cloud → *Credentials* → apri il tuo client → *Authorized redirect URIs* → *Add URI* → incolla quello che Flusso ti copia dal passo 5.4 → *Save* |
| L'app si apre ma è vuota e non salva niente | `NEXT_PUBLIC_SUPABASE_ANON_KEY` sbagliata o assente | Parte 3.3, poi Redeploy |
| La bacchetta 🪄 dà errore | `ANTHROPIC_API_KEY` assente, o credito finito | Parte 3.3 / console Anthropic |
| «Riconnetti *email*» in Impostazioni | l'autorizzazione Google è scaduta | premi *Riconnetti* |
| Gli eventi Google non si vedono | i calendari non sono spuntati | Impostazioni → Google |
| Deploy rosso su Vercel | nome di una variabile scritto male | *Building* → ultime righe |
| Girella infinita sull'accesso | non succede più: dopo 20 secondi compare un messaggio, e quello che hai scritto resta | — |

---

## Riassunto, una riga per punto

1. ✅ Progetto Supabase e migrazione 0001: **già fatti**.
2. Incolla due blocchi SQL nell'editor (link 1); la verifica deve dare **0**.
3. Rigenera la secret key Supabase e la chiave Anthropic; scrivimi «chiavi ruotate».
4. Importa su Vercel **scegliendo il ramo giusto**, cinque variabili, pubblica.
5. Correggi `APP_URL` con l'indirizzo vero e ripubblica.
6. Metti quell'indirizzo in *Site URL* e *Redirect URLs* di Supabase, con `/**`.
7. *(Facoltativo)* credenziali Google, tre variabili in più, redeploy.
8. Registrati dal telefono, aggiungi a Home, attiva le notifiche dopo il primo blocco.
9. Fai le dieci prove.

---

## Domande che potresti farti

**«Se sbaglio qualcosa rompo tutto?»**
No. I blocchi SQL sono ripetibili: eseguirli due volte non fa danni. E le
variabili su Vercel si correggono e si ripubblica.

**«Perché queste cose non le hai fatte tu?»**
Perché richiedono di essere *dentro* i tuoi account. Dal mio ambiente esce solo
traffico verso l'API pubblica del progetto Supabase: la porta del database, con
cui si applicano le migrazioni, non è raggiungibile. Per Vercel servirebbe un
token tuo. Se me ne dai uno faccio io la Parte 3 in un comando — poi va
revocato, perché passerebbe da una chat.

**«E il link, non potevi darmelo tu?»**
No, e ho provato: da questo ambiente esce solo la porta 443 attraverso un
proxy, e i programmi che creano tunnel pubblici hanno bisogno di altre porte
(cloudflared usa la 7844, bloccata in entrata e in uscita). Il proxy stesso
dichiara i client di tunneling non supportati. Un indirizzo pubblico può venire
solo da un host esterno, ed è la Parte 3.
