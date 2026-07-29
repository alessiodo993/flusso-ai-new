-- ===========================================================================
-- Flusso — schema completo.
--
-- Convenzioni valide per tutto il file:
--   * ogni tabella sta in `public` e porta un `user_id uuid not null`;
--   * nessuna foreign key verso `auth.users`: l'appartenenza è garantita dalle
--     RLS, e legarsi al catalogo di auth complica ogni ripristino;
--   * per ogni tabella, in quest'ordine: CREATE TABLE, GRANT, ENABLE RLS,
--     POLICY `<tabella>_owner_all`;
--   * il ruolo `anon` non riceve mai alcun permesso;
--   * gli orari sono minuti dalla mezzanotte (0–1440), i giorni sono `date`.
--
-- Nota sulle policy: si usa `(select auth.uid())` invece di `auth.uid()`.
-- È semanticamente identico, ma Postgres lo valuta una volta sola come
-- InitPlan invece che riga per riga — su liste lunghe la differenza è grossa.
-- ===========================================================================

-- `gen_random_uuid()` è nel core da PostgreSQL 13: nessuna estensione da
-- installare, e soprattutto niente pgcrypto sparso nello schema public.

grant usage on schema public to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- projects
-- ===========================================================================

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  name        text not null,
  color       text not null default '#3f6b4f',
  deadline    date,
  archived    boolean not null default false,
  sort_order  double precision not null default extract(epoch from now()),
  created_at  timestamptz not null default now(),
  constraint projects_name_not_blank check (length(btrim(name)) > 0),
  constraint projects_color_hex check (color ~* '^#[0-9a-f]{6}$')
);

grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy projects_owner_all on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index projects_user_sort_idx
  on public.projects (user_id, archived, sort_order);

-- ===========================================================================
-- recurring — modelli da cui si generano i task ripetuti
-- ===========================================================================

create table public.recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  title        text not null,
  project_id   uuid references public.projects (id) on delete set null,
  est_minutes  integer,
  energy       text,
  subtasks     jsonb not null default '[]'::jsonb,
  freq         text not null,
  dow          integer[] not null default '{}',
  start_minute integer,
  skip         date[] not null default '{}',
  created_at   timestamptz not null default now(),
  constraint recurring_freq_valid check (freq in ('daily', 'weekly')),
  constraint recurring_energy_valid
    check (energy is null or energy in ('alta', 'media', 'bassa')),
  constraint recurring_est_range
    check (est_minutes is null or est_minutes between 5 and 240),
  constraint recurring_start_range
    check (start_minute is null or start_minute between 0 and 1439),
  constraint recurring_subtasks_array check (jsonb_typeof(subtasks) = 'array'),
  -- Una ricorrenza settimanale senza giorni non produrrebbe mai nulla.
  constraint recurring_weekly_needs_dow
    check (freq <> 'weekly' or array_length(dow, 1) is not null)
);

grant select, insert, update, delete on public.recurring to authenticated;
grant all on public.recurring to service_role;
alter table public.recurring enable row level security;
create policy recurring_owner_all on public.recurring
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index recurring_user_idx on public.recurring (user_id);

-- ===========================================================================
-- ideas — cattura pura, zero campi obbligatori
-- ===========================================================================

create table public.ideas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  title      text not null,
  project_id uuid references public.projects (id) on delete set null,
  sort_order double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  constraint ideas_title_not_blank check (length(btrim(title)) > 0)
);

grant select, insert, update, delete on public.ideas to authenticated;
grant all on public.ideas to service_role;
alter table public.ideas enable row level security;
create policy ideas_owner_all on public.ideas
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index ideas_user_sort_idx on public.ideas (user_id, sort_order);

-- ===========================================================================
-- tasks
-- ===========================================================================

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  title      text not null,
  notes      text not null default '',
  status     text not null default 'inbox',
  day        date,
  start_minute integer,
  est_minutes  integer,
  energy       text,
  project_id uuid references public.projects (id) on delete set null,
  deadline   date,
  subtasks   jsonb not null default '[]'::jsonb,
  recur_id   uuid references public.recurring (id) on delete set null,
  sort_order double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),

  -- Esecuzione e calibrazione
  postpone_count           integer not null default 0,
  last_postponed_at        timestamptz,
  actual_duration_minutes  integer,
  is_daily_highlight       boolean not null default false,
  highlight_date           date,
  first_planned_at         timestamptz,
  status_review            text not null default 'active',
  google_event_id          text,

  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_subtasks_array check (jsonb_typeof(subtasks) = 'array')
);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy tasks_owner_all on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Un solo highlight al giorno, garantito dal database e non dall'interfaccia.
create unique index tasks_one_highlight_per_day
  on public.tasks (user_id, highlight_date)
  where is_daily_highlight;

create index tasks_user_day_idx on public.tasks (user_id, day);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_deadline_idx on public.tasks (user_id, deadline);
-- La Lista mostra per default i task non pianificati, raggruppati per progetto.
create index tasks_user_inbox_idx
  on public.tasks (user_id, project_id, sort_order)
  where status = 'inbox' and day is null;
create index tasks_google_event_idx
  on public.tasks (user_id, google_event_id)
  where google_event_id is not null;

/*
 * La specifica chiede di validare i task con un trigger e non con dei CHECK.
 * Il motivo è che qui non c'è solo validazione: il trigger deduce anche dei
 * dati (`first_planned_at`, la coerenza dell'highlight) e può restituire
 * messaggi in italiano, cosa che un CHECK non sa fare.
 */
create or replace function public.tasks_validate()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('inbox', 'done') then
    raise exception 'Stato del task non valido: %. Ammessi: inbox, done.',
      new.status;
  end if;

  if new.status_review not in ('active', 'stale', 'archived') then
    raise exception 'Stato di revisione non valido: %. Ammessi: active, stale, archived.',
      new.status_review;
  end if;

  if new.energy is not null and new.energy not in ('alta', 'media', 'bassa') then
    raise exception 'Energia non valida: %. Ammesse: alta, media, bassa.',
      new.energy;
  end if;

  if new.est_minutes is not null and new.est_minutes not between 5 and 240 then
    raise exception 'La stima deve stare fra 5 e 240 minuti, ricevuto %.',
      new.est_minutes;
  end if;

  if new.start_minute is not null then
    if new.start_minute not between 0 and 1439 then
      raise exception 'L''orario di inizio deve stare fra 0 e 1439 minuti, ricevuto %.',
        new.start_minute;
    end if;

    if new.day is null then
      raise exception 'Un blocco con un orario deve avere anche un giorno.';
    end if;

    if new.est_minutes is null then
      raise exception 'Un blocco pianificato deve avere una stima di durata.';
    end if;

    -- Nessun blocco può sconfinare nel giorno successivo.
    if new.start_minute + new.est_minutes > 1440 then
      raise exception
        'Il blocco finirebbe alle % minuti, oltre la mezzanotte. Riduci la stima o anticipa l''inizio.',
        new.start_minute + new.est_minutes;
    end if;
  end if;

  if new.postpone_count < 0 then
    new.postpone_count := 0;
  end if;

  -- L'highlight e la sua data vivono insieme: o ci sono entrambi, o nessuno.
  if new.is_daily_highlight and new.highlight_date is null then
    new.highlight_date := coalesce(new.day, current_date);
  elsif not new.is_daily_highlight then
    new.highlight_date := null;
  end if;

  -- Dedotto, mai chiesto: la prima volta che il task finisce sul calendario.
  if new.day is not null and new.first_planned_at is null then
    new.first_planned_at := now();
  end if;

  return new;
end;
$$;

create trigger tasks_validate_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_validate();

-- ===========================================================================
-- focus_sessions — la materia prima della calibrazione
-- ===========================================================================

create table public.focus_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  -- On delete set null e non cascade: cancellare un task non deve cancellare
  -- la storia di esecuzione su cui si calcola il coefficiente di ottimismo.
  task_id         uuid references public.tasks (id) on delete set null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  planned_minutes integer not null,
  actual_minutes  integer,
  outcome         text,
  was_micro_start boolean not null default false,
  paused_seconds  integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint focus_outcome_valid
    check (outcome is null
           or outcome in ('completed', 'partial', 'abandoned', 'extended')),
  constraint focus_planned_positive check (planned_minutes > 0),
  constraint focus_actual_positive
    check (actual_minutes is null or actual_minutes >= 0),
  constraint focus_paused_positive check (paused_seconds >= 0)
);

grant select, insert, update, delete on public.focus_sessions to authenticated;
grant all on public.focus_sessions to service_role;
alter table public.focus_sessions enable row level security;
create policy focus_sessions_owner_all on public.focus_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- La calibrazione legge sempre le ultime N sessioni concluse.
create index focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);
create index focus_sessions_task_idx on public.focus_sessions (task_id);

-- ===========================================================================
-- daily_reviews — kickoff e shutdown
-- ===========================================================================

create table public.daily_reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  date              date not null,
  type              text not null,
  planned_minutes   integer not null default 0,
  completed_minutes integer not null default 0,
  tasks_planned     integer not null default 0,
  tasks_completed   integer not null default 0,
  notes             text,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now(),
  constraint daily_reviews_type_valid check (type in ('kickoff', 'shutdown')),
  constraint daily_reviews_unique_per_day unique (user_id, date, type)
);

grant select, insert, update, delete on public.daily_reviews to authenticated;
grant all on public.daily_reviews to service_role;
alter table public.daily_reviews enable row level security;
create policy daily_reviews_owner_all on public.daily_reviews
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index daily_reviews_user_date_idx
  on public.daily_reviews (user_id, date desc);

-- ===========================================================================
-- okrs
-- ===========================================================================

create table public.okrs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  project_id  uuid references public.projects (id) on delete set null,
  quarter     text not null,
  objective   text not null,
  key_results jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  constraint okrs_quarter_format check (quarter ~ '^\d{4}-Q[1-4]$'),
  constraint okrs_objective_not_blank check (length(btrim(objective)) > 0),
  constraint okrs_key_results_array check (jsonb_typeof(key_results) = 'array')
);

grant select, insert, update, delete on public.okrs to authenticated;
grant all on public.okrs to service_role;
alter table public.okrs enable row level security;
create policy okrs_owner_all on public.okrs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index okrs_user_quarter_idx on public.okrs (user_id, quarter);

-- ===========================================================================
-- blocks — impegni fissi che non sono task
-- ===========================================================================

create table public.blocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  type         text not null,
  label        text,
  day          date,
  recur        boolean not null default false,
  dow          integer[] not null default '{}',
  start_minute integer not null,
  end_minute   integer not null,
  created_at   timestamptz not null default now(),
  constraint blocks_range_valid
    check (start_minute >= 0 and end_minute <= 1440
           and start_minute < end_minute),
  -- O si ripete su dei giorni della settimana, o cade in una data precisa.
  constraint blocks_anchored
    check ((recur and array_length(dow, 1) is not null)
           or (not recur and day is not null))
);

grant select, insert, update, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy blocks_owner_all on public.blocks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index blocks_user_day_idx on public.blocks (user_id, day);
create index blocks_user_recur_idx on public.blocks (user_id) where recur;

-- ===========================================================================
-- google_accounts — contiene i token: nessun permesso per `authenticated`
-- ===========================================================================

create table public.google_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null,
  email                    text not null,
  access_token_ciphertext  text not null,
  refresh_token_ciphertext text,
  token_expires_at         timestamptz,
  scopes                   text[] not null default '{}',
  needs_reconnect          boolean not null default false,
  created_at               timestamptz not null default now(),
  constraint google_accounts_unique_per_user unique (user_id, email)
);

-- Deliberatamente nessun GRANT a `authenticated`: i token non devono poter
-- essere letti nemmeno dal proprietario. Ci arriva solo il codice server-side
-- attraverso `service_role`, e l'interfaccia legge lo stato dalla vista qui
-- sotto, che espone email e stato di riconnessione ma non i segreti.
grant all on public.google_accounts to service_role;
alter table public.google_accounts enable row level security;
create policy google_accounts_service_all on public.google_accounts
  for all to service_role using (true) with check (true);

create index google_accounts_user_idx on public.google_accounts (user_id);

/*
 * Vista sicura per l'interfaccia: `security_invoker = off` la fa girare con i
 * privilegi di chi la possiede, mentre il WHERE la restringe all'utente
 * corrente. Così il browser vede quali account sono collegati e quali vanno
 * riconnessi, senza mai avvicinarsi ai token cifrati.
 */
create view public.google_accounts_public
with (security_invoker = off) as
  select id, user_id, email, scopes, needs_reconnect, token_expires_at, created_at
  from public.google_accounts
  where user_id = (select auth.uid());

grant select on public.google_accounts_public to authenticated;

-- ===========================================================================
-- google_calendars
-- ===========================================================================

create table public.google_calendars (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid(),
  account_id         uuid not null
                     references public.google_accounts (id) on delete cascade,
  google_calendar_id text not null,
  name               text not null,
  color              text not null default '#3f6b4f',
  enabled            boolean not null default true,
  is_write_target    boolean not null default false,
  sync_token         text,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  constraint google_calendars_unique
    unique (user_id, account_id, google_calendar_id),
  constraint google_calendars_color_hex check (color ~* '^#[0-9a-f]{6}$')
);

grant select, insert, update, delete on public.google_calendars to authenticated;
grant all on public.google_calendars to service_role;
alter table public.google_calendars enable row level security;
create policy google_calendars_owner_all on public.google_calendars
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Un solo calendario di destinazione per la scrittura in uscita.
create unique index google_calendars_one_write_target
  on public.google_calendars (user_id)
  where is_write_target;

create index google_calendars_user_idx on public.google_calendars (user_id);

-- ===========================================================================
-- google_events — cache locale degli eventi
-- ===========================================================================

create table public.google_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  calendar_id     uuid not null
                  references public.google_calendars (id) on delete cascade,
  google_event_id text not null,
  title           text not null default '',
  day             date not null,
  start_minute    integer not null default 0,
  end_minute      integer not null default 1440,
  all_day         boolean not null default false,
  local_done      boolean not null default false,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  /*
   * Il giorno fa parte della chiave: un evento che attraversa la mezzanotte
   * viene salvato come una riga per giorno coperto. Senza il giorno nella
   * unique, un evento di due giorni potrebbe comparire soltanto sul primo,
   * e il planner lo tratterebbe come ostacolo solo lì.
   */
  constraint google_events_unique
    unique (user_id, calendar_id, google_event_id, day),
  constraint google_events_range_valid
    check (start_minute >= 0 and end_minute <= 1440
           and start_minute < end_minute)
);

grant select, insert, update, delete on public.google_events to authenticated;
grant all on public.google_events to service_role;
alter table public.google_events enable row level security;
create policy google_events_owner_all on public.google_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index google_events_user_day_idx on public.google_events (user_id, day);
create index google_events_calendar_idx on public.google_events (calendar_id);

create trigger google_events_touch_updated_at
  before update on public.google_events
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- user_settings
-- ===========================================================================

create table public.user_settings (
  user_id              uuid primary key default auth.uid(),
  work_start           integer not null default 480,
  work_end             integer not null default 1200,
  theme                text not null default 'auto',
  peak_hours_start     time not null default '09:00',
  peak_hours_end       time not null default '12:00',
  low_hours_start      time,
  low_hours_end        time,
  buffer_minutes       integer not null default 10,
  micro_start_minutes  integer not null default 10,
  daily_cap_minutes    integer not null default 360,
  google_write_enabled boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint user_settings_theme_valid
    check (theme in ('auto', 'light', 'dark')),
  constraint user_settings_work_window
    check (work_start >= 0 and work_end <= 1440 and work_start < work_end),
  constraint user_settings_buffer_range check (buffer_minutes between 0 and 60),
  constraint user_settings_micro_range
    check (micro_start_minutes between 2 and 60),
  constraint user_settings_cap_range
    check (daily_cap_minutes between 30 and 960)
);

grant select, insert, update, delete on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
alter table public.user_settings enable row level security;
create policy user_settings_owner_all on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Alla registrazione, l'utente ha già le sue impostazioni.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
