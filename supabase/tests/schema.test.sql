-- ===========================================================================
-- Verifiche sullo schema: RLS, GRANT, trigger e vincoli.
-- Si esegue con `npm run db:test` su un Postgres usa e getta, dopo
-- `harness.sql` e `0001_flusso.sql`.
-- Ogni controllo fallito interrompe lo script con un messaggio esplicito.
-- ===========================================================================

\set ON_ERROR_STOP on

create schema tests;
-- Anche `authenticated` deve poter chiamare gli helper: metà dei controlli
-- gira proprio impersonando quel ruolo.
grant usage on schema tests to public;

/** Esegue dello SQL aspettandosi che fallisca. Se passa, è un bug. */
create or replace function tests.must_fail(statement text, what text)
returns text
language plpgsql
as $$
begin
  execute statement;
  raise exception 'ATTESO UN ERRORE ma è passato: %', what;
exception
  when others then
    if sqlerrm like 'ATTESO UN ERRORE%' then
      raise;
    end if;
    return '  ok — respinto: ' || what;
end;
$$;

/** Impersona un utente autenticato. */
create or replace function tests.act_as(uid uuid)
returns text
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  return '  · ora agisce ' || uid;
end;
$$;

-- Due utenti reali: l'inserimento in auth.users deve far scattare il trigger.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com');

\echo '— trigger di registrazione'
do $$
begin
  if (select count(*) from public.user_settings) <> 2 then
    raise exception 'handle_new_user non ha creato le impostazioni per entrambi gli utenti';
  end if;
  if (select work_start from public.user_settings
      where user_id = '11111111-1111-1111-1111-111111111111') <> 480 then
    raise exception 'le impostazioni non hanno i valori di default attesi';
  end if;
  raise notice '  ok — ogni nuovo utente nasce con le sue impostazioni';
end;
$$;

-- ---------------------------------------------------------------------------
\echo '— isolamento fra utenti (RLS)'
-- ---------------------------------------------------------------------------

select tests.act_as('11111111-1111-1111-1111-111111111111');
set role authenticated;

insert into public.projects (name, color) values ('Tesi', '#3f6b4f');
insert into public.ideas (title) values ('Rileggere il capitolo 2');

do $$
begin
  -- user_id non è stato passato: deve averlo messo il default auth.uid().
  if (select user_id from public.projects limit 1)
     <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'il default auth.uid() su user_id non ha funzionato';
  end if;
  raise notice '  ok — user_id dedotto da auth.uid()';
end;
$$;

select tests.must_fail(
  $sql$insert into public.projects (user_id, name)
       values ('22222222-2222-2222-2222-222222222222', 'Progetto altrui')$sql$,
  'inserire una riga intestata a un altro utente'
);

-- Passiamo a Bruno: non deve vedere né toccare nulla di Ada.
select tests.act_as('22222222-2222-2222-2222-222222222222');

do $$
begin
  if (select count(*) from public.projects) <> 0 then
    raise exception 'un utente vede i progetti di un altro';
  end if;
  if (select count(*) from public.ideas) <> 0 then
    raise exception 'un utente vede le idee di un altro';
  end if;
  raise notice '  ok — i dati di un utente sono invisibili agli altri';
end;
$$;

do $$
declare
  touched integer;
begin
  update public.projects set name = 'Rubato';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'un utente ha modificato % righe di un altro', touched;
  end if;

  delete from public.projects;
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'un utente ha cancellato % righe di un altro', touched;
  end if;
  raise notice '  ok — update e delete altrui non toccano nulla';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
\echo '— il ruolo anon non ha alcun accesso'
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'ideas', 'tasks', 'focus_sessions', 'daily_reviews',
    'okrs', 'recurring', 'blocks', 'google_accounts', 'google_calendars',
    'google_events', 'user_settings'
  ]
  loop
    if has_table_privilege('anon', 'public.' || t, 'select') then
      raise exception 'anon può leggere %', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'insert') then
      raise exception 'anon può scrivere su %', t;
    end if;
  end loop;
  raise notice '  ok — nessun permesso per anon su nessuna tabella';
end;
$$;

-- ---------------------------------------------------------------------------
\echo '— i token Google non sono raggiungibili da authenticated'
-- ---------------------------------------------------------------------------

do $$
begin
  if has_table_privilege('authenticated', 'public.google_accounts', 'select') then
    raise exception 'authenticated può leggere i token Google';
  end if;
  if not has_table_privilege('service_role', 'public.google_accounts', 'select') then
    raise exception 'service_role non può leggere google_accounts';
  end if;
  raise notice '  ok — google_accounts è riservata a service_role';
end;
$$;

insert into public.google_accounts
  (user_id, email, access_token_ciphertext, refresh_token_ciphertext)
values
  ('11111111-1111-1111-1111-111111111111', 'ada@gmail.com', 'CIFRATO-A', 'CIFRATO-R'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@gmail.com', 'CIFRATO-B', 'CIFRATO-R');

select tests.act_as('11111111-1111-1111-1111-111111111111');
set role authenticated;

select tests.must_fail(
  'select access_token_ciphertext from public.google_accounts',
  'leggere i token dalla tabella con il ruolo authenticated'
);

do $$
begin
  -- La vista mostra solo i propri account, e senza i segreti.
  if (select count(*) from public.google_accounts_public) <> 1 then
    raise exception 'la vista degli account Google non filtra per utente';
  end if;
  if (select email from public.google_accounts_public) <> 'ada@gmail.com' then
    raise exception 'la vista mostra l''account sbagliato';
  end if;
  raise notice '  ok — la vista espone lo stato ma non i token';
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'google_accounts_public'
      and column_name like '%ciphertext%'
  ) then
    raise exception 'la vista pubblica espone una colonna con i token';
  end if;
  raise notice '  ok — nessuna colonna cifrata nella vista';
end;
$$;

-- ---------------------------------------------------------------------------
\echo '— validazione dei task (trigger)'
-- ---------------------------------------------------------------------------

select tests.must_fail(
  $sql$insert into public.tasks (title, est_minutes) values ('Troppo corto', 3)$sql$,
  'una stima sotto i 5 minuti'
);

select tests.must_fail(
  $sql$insert into public.tasks (title, est_minutes) values ('Troppo lungo', 300)$sql$,
  'una stima sopra i 240 minuti'
);

select tests.must_fail(
  $sql$insert into public.tasks (title, day, start_minute, est_minutes)
       values ('Sconfina', current_date, 1400, 120)$sql$,
  'un blocco che finirebbe dopo la mezzanotte'
);

select tests.must_fail(
  $sql$insert into public.tasks (title, start_minute, est_minutes)
       values ('Orario senza giorno', 540, 60)$sql$,
  'un orario senza un giorno'
);

select tests.must_fail(
  $sql$insert into public.tasks (title, day, start_minute)
       values ('Blocco senza stima', current_date, 540)$sql$,
  'un blocco pianificato senza stima'
);

select tests.must_fail(
  $sql$insert into public.tasks (title, status) values ('Stato ignoto', 'forse')$sql$,
  'uno stato fuori da inbox/done'
);

select tests.must_fail(
  $sql$insert into public.tasks (title, energy) values ('Energia ignota', 'altissima')$sql$,
  'un livello di energia inventato'
);

do $$
begin
  -- Il limite superiore è esattamente la mezzanotte, e deve essere ammesso.
  insert into public.tasks (title, day, start_minute, est_minutes)
  values ('Fino a mezzanotte', current_date, 1380, 60);
  raise notice '  ok — un blocco che finisce alle 24:00 è valido';
end;
$$;

\echo '— dati dedotti dal trigger'
do $$
declare
  planned timestamptz;
  again   timestamptz;
begin
  insert into public.tasks (title) values ('Prima non pianificato');

  if (select first_planned_at from public.tasks
      where title = 'Prima non pianificato') is not null then
    raise exception 'first_planned_at valorizzato su un task mai pianificato';
  end if;

  update public.tasks set day = current_date where title = 'Prima non pianificato';
  select first_planned_at into planned from public.tasks
    where title = 'Prima non pianificato';

  if planned is null then
    raise exception 'first_planned_at non è stato dedotto alla pianificazione';
  end if;

  -- Ripianificare non deve riscrivere la prima volta: è un dato storico.
  update public.tasks set day = current_date + 1
    where title = 'Prima non pianificato';
  select first_planned_at into again from public.tasks
    where title = 'Prima non pianificato';

  if again <> planned then
    raise exception 'first_planned_at è stato sovrascritto a una ripianificazione';
  end if;
  raise notice '  ok — first_planned_at si scrive una volta sola';
end;
$$;

do $$
begin
  insert into public.tasks (title, day, is_daily_highlight)
  values ('Highlight di oggi', current_date, true);

  if (select highlight_date from public.tasks where title = 'Highlight di oggi')
     is null then
    raise exception 'highlight_date non dedotta da is_daily_highlight';
  end if;

  update public.tasks set is_daily_highlight = false
    where title = 'Highlight di oggi';

  if (select highlight_date from public.tasks where title = 'Highlight di oggi')
     is not null then
    raise exception 'highlight_date rimasta dopo aver tolto l''highlight';
  end if;
  raise notice '  ok — highlight e highlight_date restano coerenti';
end;
$$;

\echo '— un solo highlight al giorno'
do $$
begin
  update public.tasks set is_daily_highlight = true, highlight_date = current_date
    where title = 'Highlight di oggi';
end;
$$;

select tests.must_fail(
  $sql$insert into public.tasks (title, day, is_daily_highlight, highlight_date)
       values ('Secondo highlight', current_date, true, current_date)$sql$,
  'un secondo highlight nello stesso giorno'
);

do $$
begin
  insert into public.tasks (title, day, is_daily_highlight, highlight_date)
  values ('Highlight di domani', current_date + 1, true, current_date + 1);
  raise notice '  ok — l''highlight del giorno dopo resta possibile';
end;
$$;

-- ---------------------------------------------------------------------------
\echo '— calendari Google'
-- ---------------------------------------------------------------------------

reset role;
do $$
declare
  account uuid;
begin
  select id into account from public.google_accounts where email = 'ada@gmail.com';
  insert into public.google_calendars
    (user_id, account_id, google_calendar_id, name, is_write_target)
  values
    ('11111111-1111-1111-1111-111111111111', account, 'primary', 'Personale', true),
    ('11111111-1111-1111-1111-111111111111', account, 'lavoro@x', 'Lavoro', false);
end;
$$;

select tests.act_as('11111111-1111-1111-1111-111111111111');
set role authenticated;

select tests.must_fail(
  $sql$update public.google_calendars set is_write_target = true
       where google_calendar_id = 'lavoro@x'$sql$,
  'un secondo calendario di destinazione per la scrittura'
);

do $$
declare
  cal uuid;
begin
  select id into cal from public.google_calendars where google_calendar_id = 'primary';

  -- Lo stesso evento su due giorni: la unique include il giorno proprio per
  -- permettere agli eventi lunghi di comparire su ciascuno.
  insert into public.google_events
    (calendar_id, google_event_id, title, day, start_minute, end_minute)
  values
    (cal, 'evt-lungo', 'Trasferta', current_date, 600, 1440),
    (cal, 'evt-lungo', 'Trasferta', current_date + 1, 0, 720);
  raise notice '  ok — un evento su più giorni occupa una riga per giorno';
end;
$$;

select tests.must_fail(
  $sql$insert into public.google_events
       (calendar_id, google_event_id, title, day, start_minute, end_minute)
       select id, 'evt-lungo', 'Doppione', current_date, 600, 1440
       from public.google_calendars where google_calendar_id = 'primary'$sql$,
  'lo stesso evento due volte nello stesso giorno'
);

-- ---------------------------------------------------------------------------
\echo '— impegni fissi e ricorrenti'
-- ---------------------------------------------------------------------------

select tests.must_fail(
  $sql$insert into public.blocks (type, start_minute, end_minute)
       values ('palestra', 1080, 1140)$sql$,
  'un impegno né ricorrente né ancorato a una data'
);

select tests.must_fail(
  $sql$insert into public.blocks (type, day, start_minute, end_minute)
       values ('pranzo', current_date, 780, 720)$sql$,
  'un impegno che finisce prima di iniziare'
);

do $$
begin
  insert into public.blocks (type, label, recur, dow, start_minute, end_minute)
  values ('pranzo', 'Pranzo', true, '{1,2,3,4,5}', 780, 840);
  insert into public.blocks (type, label, day, start_minute, end_minute)
  values ('viaggio', 'Treno per Milano', current_date, 420, 540);
  raise notice '  ok — impegni ricorrenti e una tantum accettati';
end;
$$;

select tests.must_fail(
  $sql$insert into public.recurring (title, freq) values ('Settimanale vuoto', 'weekly')$sql$,
  'una ricorrenza settimanale senza giorni'
);

-- ---------------------------------------------------------------------------
\echo '— OKR e impostazioni'
-- ---------------------------------------------------------------------------

select tests.must_fail(
  $sql$insert into public.okrs (quarter, objective) values ('2026-T3', 'Sbagliato')$sql$,
  'un trimestre in un formato diverso da 2026-Q3'
);

select tests.must_fail(
  $sql$update public.user_settings set work_end = 400 where work_start = 480$sql$,
  'una giornata di lavoro che finisce prima di cominciare'
);

select tests.must_fail(
  $sql$update public.user_settings set daily_cap_minutes = 5$sql$,
  'un tetto giornaliero irrealistico'
);

do $$
declare
  before_at timestamptz;
  after_at  timestamptz;
begin
  select updated_at into before_at from public.user_settings;
  perform pg_sleep(0.01);
  update public.user_settings set buffer_minutes = 15;
  select updated_at into after_at from public.user_settings;
  if after_at <= before_at then
    raise exception 'il trigger updated_at non ha aggiornato la data';
  end if;
  raise notice '  ok — updated_at si aggiorna da solo';
end;
$$;

-- ---------------------------------------------------------------------------
\echo '— la storia di esecuzione sopravvive alla cancellazione del task'
-- ---------------------------------------------------------------------------

do $$
declare
  t uuid;
begin
  insert into public.tasks (title, est_minutes) values ('Task effimero', 60)
    returning id into t;
  insert into public.focus_sessions (task_id, planned_minutes, actual_minutes, outcome)
    values (t, 60, 84, 'completed');

  delete from public.tasks where id = t;

  if (select count(*) from public.focus_sessions where actual_minutes = 84) <> 1 then
    raise exception 'la sessione è sparita insieme al task: la calibrazione perderebbe i dati';
  end if;
  if (select task_id from public.focus_sessions where actual_minutes = 84)
     is not null then
    raise exception 'task_id non è stato azzerato alla cancellazione';
  end if;
  raise notice '  ok — le sessioni restano, con task_id azzerato';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
\echo '— ogni tabella ha RLS attiva e la sua policy'
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    if not (select relrowsecurity from pg_class
            where oid = ('public.' || t.tablename)::regclass) then
      raise exception 'RLS non attiva su %', t.tablename;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t.tablename
    ) then
      raise exception 'nessuna policy su %', t.tablename;
    end if;
  end loop;
  raise notice '  ok — RLS e policy presenti su tutte le tabelle';
end;
$$;

\echo ''
\echo 'TUTTI I TEST DELLO SCHEMA SONO PASSATI'
