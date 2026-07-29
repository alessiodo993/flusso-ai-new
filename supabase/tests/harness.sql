-- ===========================================================================
-- Ricostruisce quel poco di Supabase che la migrazione dà per scontato, così
-- che `0001_flusso.sql` possa essere verificata su un Postgres qualunque:
-- i tre ruoli, lo schema `auth`, la tabella `auth.users` e `auth.uid()`.
--
-- Non è un finto Supabase: è il contorno minimo per poter provare davvero le
-- RLS, i GRANT e i trigger. Nel progetto reale tutto questo esiste già.
-- ===========================================================================

-- I ruoli vivono nel cluster, non nel database: creiamoli solo se mancano,
-- altrimenti il secondo giro di test fallirebbe.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  created_at    timestamptz not null default now()
);

/*
 * In Supabase `auth.uid()` legge il claim `sub` del JWT della richiesta.
 * Qui usiamo lo stesso meccanismo: una GUC di sessione, così i test possono
 * impersonare utenti diversi con un semplice `set`.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
