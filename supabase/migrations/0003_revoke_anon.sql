-- ===========================================================================
-- Toglie ad `anon` i privilegi che Supabase gli concede da sé.
--
-- La migrazione 0001 non concede **nulla** ad `anon`, ma non basta: ogni
-- progetto Supabase nasce con
--
--   alter default privileges in schema public
--     grant all on tables to postgres, anon, authenticated, service_role;
--
-- e quel default si applica a ogni tabella creata dopo, comprese le nostre.
-- Il risultato, verificato sul progetto vero, è che `anon` ottiene SELECT,
-- INSERT, UPDATE e DELETE su tutto — persino su `google_accounts`, che
-- contiene i token cifrati.
--
-- I dati restavano protetti dalle RLS, che senza policy per `anon` negano
-- ogni riga. Ma è una protezione sola: basterebbe una tabella futura con la
-- RLS dimenticata, o una policy scritta larga, perché una chiave pubblicata
-- nel bundle del browser diventi una chiave di lettura. I due strati —
-- privilegi *e* RLS — devono esserci entrambi.
-- ===========================================================================

-- 1. Le tabelle che già esistono.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all routines in schema public from anon;

-- 2. Quelle che verranno. Va eseguito con lo stesso ruolo che ha impostato i
--    default originali (`postgres`), altrimenti non li annulla.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on routines from anon;

-- 3. `google_accounts` custodisce i token: nemmeno il proprietario deve
--    poterli leggere. L'interfaccia usa la vista `google_accounts_public`.
revoke all privileges on public.google_accounts from authenticated;

-- 4. Le concessioni volute vengono riaffermate, così questo file è sufficiente
--    a portare uno schema esistente nello stato corretto.
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
