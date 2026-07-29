# Cose che devo fare io (non Claude)

Ci sono operazioni che vanno fatte a mano, perché richiedono di essere dentro
il tuo account. Qui sono spiegate **passo per passo**, senza dare niente per
scontato: dove cliccare, cosa vedrai, come capire se è andata bene.

Tempo totale: circa **10 minuti**.

| # | Cosa | Quando | Quanto ci vuole |
|---|---|---|---|
| 1 | Aggiornare il database | **Adesso** | 3 minuti |
| 2 | Controllare che sia andata | Subito dopo | 2 minuti |
| 3 | Cambiare la chiave segreta | Dopo il punto 2 | 2 minuti |
| 4 | Chiave Anthropic | Quando arriva il passo 10 | 3 minuti |
| 5 | Google Calendar | Quando ti serve | 10 minuti |

---

## 1. Aggiornare il database

### Perché

Il database del tuo progetto Supabase è già stato creato (le tabelle ci sono,
l'ho verificato). Mancano due aggiornamenti:

- uno aggiunge tre colonne che servono alle notifiche di Google Calendar;
- l'altro **chiude un buco di sicurezza**. Te lo spiego in due righe: ogni
  progetto Supabase è configurato in modo che ogni nuova tabella sia
  automaticamente accessibile anche ai visitatori non registrati. I tuoi dati
  sono comunque protetti da un secondo lucchetto, che funziona — l'ho provato.
  Ma un lucchetto solo non basta, e questo aggiornamento rimette il primo.

### Come si fa

**Passo 1.1** — Apri il browser e vai su questo indirizzo:

```
https://supabase.com/dashboard/project/bgwrmxkgguzsngzgwjyu/sql/new
```

È il tuo progetto, già aperto sulla pagina giusta. Se ti chiede di accedere,
accedi e poi riapri il link.

**Passo 1.2** — Vedrai una pagina con un grande riquadro bianco vuoto al
centro (è un editor di testo) e un pulsante verde **`Run`** in basso a destra.

**Passo 1.3** — Copia **tutto** il blocco di testo qui sotto. Tutto: dalla
prima riga che comincia con `alter table` fino all'ultima. Non serve capirlo.

```sql
-- ---- Parte 1: colonne per le notifiche di Google Calendar ----------------

alter table public.google_calendars
  add column if not exists channel_id text,
  add column if not exists channel_resource_id text,
  add column if not exists channel_expires_at timestamptz;

create index if not exists google_calendars_channel_expiry_idx
  on public.google_calendars (channel_expires_at)
  where channel_id is not null;


-- ---- Parte 2: togliere i permessi ai visitatori non registrati -----------

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all routines in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on routines from anon;

revoke all privileges on public.google_accounts from authenticated;

grant select, insert, update, delete on
  public.projects,
  public.recurring,
  public.ideas,
  public.tasks,
  public.focus_sessions,
  public.daily_reviews,
  public.okrs,
  public.blocks,
  public.google_calendars,
  public.google_events,
  public.user_settings
to authenticated;

grant select on public.google_accounts_public to authenticated;
```

**Passo 1.4** — Incolla nel riquadro bianco (clicca dentro, poi `Ctrl+V` su
Windows o `Cmd+V` su Mac).

**Passo 1.5** — Clicca il pulsante verde **`Run`** in basso a destra.
(Scorciatoia: `Ctrl+Invio` o `Cmd+Invio`.)

**Passo 1.6** — Aspetta due o tre secondi. In basso comparirà una striscia con
scritto:

> **Success. No rows returned**

Vuol dire che è andata. «No rows returned» non è un errore: significa solo che
il comando non doveva restituire dati, e infatti non ne ha restituiti.

### Se invece esce un errore in rosso

Copiami il testo dell'errore e lo guardiamo insieme. Non rilanciare a caso: i
comandi qui sopra sono scritti per poter essere eseguiti anche **due volte di
seguito** senza danni (`if not exists`), quindi in caso di dubbio puoi
rilanciarli senza rischio.

---

## 2. Controllare che sia andata bene

### Perché

Il messaggio verde dice che i comandi sono stati eseguiti, non che il
risultato è quello giusto. Questi due controlli lo dimostrano.

### Controllo A — le colonne nuove esistono

**Passo 2.1** — Sempre nella stessa pagina, cancella tutto quello che c'è nel
riquadro (`Ctrl+A` poi `Canc`) e incolla questo:

```sql
select column_name
from information_schema.columns
where table_name = 'google_calendars'
  and column_name like 'channel%'
order by column_name;
```

**Passo 2.2** — Clicca **`Run`**.

**Passo 2.3** — In basso deve comparire una tabellina con **esattamente queste
tre righe**:

```
channel_expires_at
channel_id
channel_resource_id
```

Se le vedi, la parte 1 è a posto.

### Controllo B — il buco di sicurezza è chiuso

Questo è il controllo importante. Verifica che un visitatore non registrato
**non** possa più toccare le tabelle.

**Passo 2.4** — Cancella di nuovo il riquadro e incolla questo:

```sql
select
  count(*) filter (
    where has_table_privilege('anon', 'public.' || tablename, 'select')
  ) as tabelle_ancora_leggibili_da_anon,
  count(*) as tabelle_totali
from pg_tables
where schemaname = 'public';
```

**Passo 2.5** — Clicca **`Run`**.

**Passo 2.6** — Deve uscire una riga con:

| tabelle_ancora_leggibili_da_anon | tabelle_totali |
|---|---|
| **0** | 12 |

**Il numero che conta è il primo, e deve essere `0`.** Se è zero, il buco è
chiuso. Se è diverso da zero, dimmelo e lo sistemiamo.

*(Il secondo numero è 12 e serve solo a confermare che sta guardando tutte le
tabelle, non una sola.)*

---

## 3. Cambiare la chiave segreta

### Perché

Mi hai incollato in chat la chiave `sb_secret_…`. Quella chiave scavalca ogni
protezione: chi ce l'ha può leggere e modificare qualunque dato di qualunque
utente. Ora è scritta in una conversazione, quindi va sostituita. È
un'operazione di due minuti e non rompe niente.

**Falla dopo il punto 2**, non prima: mi serve la chiave attuale se dovessimo
verificare qualcosa.

### Come si fa

**Passo 3.1** — Vai su:

```
https://supabase.com/dashboard/project/bgwrmxkgguzsngzgwjyu/settings/api-keys
```

**Passo 3.2** — Cerca la sezione delle chiavi segrete (`Secret keys`). Accanto
alla chiave che comincia per `sb_secret_` c'è un menu con tre puntini `⋯`
oppure un pulsante **`Rotate`** / **`Revoke`**.

**Passo 3.3** — Clicca e conferma la rigenerazione. Ti verrà mostrata una
chiave **nuova**, sempre che comincia per `sb_secret_`.

**Passo 3.4** — Copiala. Comparirà una volta sola.

**Passo 3.5** — Aprimi una riga in chat e scrivi soltanto:

> «chiave ruotata»

**Non incollarmi la nuova chiave.** Ti dirò io dove metterla — andrà in un
file locale sul tuo computer e nelle impostazioni di Vercel, non in chat.

---

## 4. Chiave Anthropic *(non ancora, ti avviso io)*

Serve per la cattura magica e il pianificatore automatico. Te la chiederò
quando arriveremo al passo 10.

Quando sarà il momento: [console.anthropic.com](https://console.anthropic.com)
→ **API keys** → **Create key**. La chiave comincia per `sk-ant-`.

---

## 5. Google Calendar *(quando ti serve)*

Serve solo se vuoi vedere i tuoi impegni Google dentro Flusso. L'app funziona
benissimo anche senza. Quando lo vorrai, dimmelo e ti scrivo la procedura
passo per passo come questa: sono una decina di clic su Google Cloud.

---

## Domande che potresti farti

**«Se sbaglio qualcosa rompo tutto?»**
No. I comandi del punto 1 sono scritti per essere ripetibili: eseguirli due
volte non fa danni. E in questo momento nel database non ci sono ancora tuoi
dati da perdere.

**«Devo fare qualcosa per far ripartire l'app?»**
No. Le modifiche del punto 1 valgono da subito, senza riavviare niente.

**«Perché non le hai fatte tu?»**
Perché richiedono di essere collegati al tuo account Supabase con un permesso
di amministratore. Dal mio ambiente esce solo traffico web verso l'API
pubblica del progetto: la porta del database non è raggiungibile. Se preferisci
non farle a mano, l'alternativa è darmi la password del database — ma è
un'altra credenziale che finirebbe in chat, quindi i due copia-incolla sono la
strada migliore.
