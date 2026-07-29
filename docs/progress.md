# Avanzamento

Stato della ricostruzione, passo per passo. La specifica di riferimento è
[`docs/rebuild-prompt.md`](./rebuild-prompt.md).

| # | Passo | Stato |
|---|---|---|
| 1 | Scaffold, token CSS, Supabase Auth, middleware, login | ✅ fatto |
| 2 | Migrazione DB completa (RLS, GRANT, trigger) | ⏳ |
| 3 | Tipi, client Supabase, hook CRUD base | ⏳ |
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
