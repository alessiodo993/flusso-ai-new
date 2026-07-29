-- ===========================================================================
-- Canali di notifica di Google Calendar.
--
-- Il polling ogni cinque minuti funziona, ma un evento spostato da un collega
-- resta invisibile fino al giro successivo. `events.watch` fa arrivare la
-- notifica subito; queste tre colonne servono a ricordare quale canale è
-- aperto su quale calendario e quando scade, perché Google li chiude da solo
-- dopo qualche giorno e vanno rinnovati prima.
--
-- Nessun GRANT e nessuna policy da aggiungere: le colonne ereditano quelle
-- già definite su `google_calendars` nella migrazione 0001.
-- ===========================================================================

alter table public.google_calendars
  add column if not exists channel_id text,
  add column if not exists channel_resource_id text,
  add column if not exists channel_expires_at timestamptz;

-- Serve a trovare in fretta i canali da rinnovare.
create index if not exists google_calendars_channel_expiry_idx
  on public.google_calendars (channel_expires_at)
  where channel_id is not null;
