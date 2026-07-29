#!/usr/bin/env bash
#
# Verifica che `supabase/setup-completo.sql` sia davvero ripetibile.
#
#   npm run db:setup-check
#
# Lo esegue tre volte sullo stesso database — una da vuoto, una sopra se
# stesso, una con dei dati dentro — e poi ci lancia i test di schema. È la
# prova che si può reincollare senza paura, che è l'unica promessa che quel
# file fa all'utente.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
DIR="${TMPDIR:-/tmp}/flusso-setup-check"

if [[ ! -x "$PGBIN/initdb" ]]; then
  echo "Nessun PostgreSQL locale. Con Docker:" >&2
  echo "  docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16" >&2
  echo "  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run db:setup-check" >&2
  exit 1
fi

# Postgres rifiuta di girare come root: se lo siamo, si passa all'utente suo.
RUN=(bash -c)
if [[ "$(id -u)" == "0" ]] && id postgres >/dev/null 2>&1; then
  RUN=(su postgres -c)
fi

rm -rf "$DIR"; mkdir -p "$DIR"
[[ "$(id -u)" == "0" ]] && chown postgres:postgres "$DIR"

"${RUN[@]}" "$PGBIN/initdb -D $DIR/data -U postgres --auth=trust" >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl -D $DIR/data -o \"-k $DIR -p 5599 -c listen_addresses=''\" -l $DIR/log start" >/dev/null
trap '"${RUN[@]}" "$PGBIN/pg_ctl -D $DIR/data stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
sleep 3

PSQL=(psql -h "$DIR" -p 5599 -U postgres -v ON_ERROR_STOP=1 -q --no-psqlrc)
"${PSQL[@]}" -d postgres -c "create database prova" >/dev/null
"${PSQL[@]}" -d prova -f supabase/tests/harness.sql >/dev/null

for giro in 1 2; do
  echo "→ esecuzione $giro"
  "${PSQL[@]}" -t -A -d prova -f supabase/setup-completo.sql 2>/dev/null | sed 's/^/   /'
done

echo "→ esecuzione 3, con dei dati dentro"
"${PSQL[@]}" -d prova -c "insert into public.projects (id, user_id, name)
  values ('11111111-1111-1111-1111-111111111111',
          '00000000-0000-0000-0000-000000000001', 'Tesi')
  on conflict do nothing" >/dev/null
"${PSQL[@]}" -t -A -d prova -f supabase/setup-completo.sql >/dev/null 2>&1
righe="$("${PSQL[@]}" -t -A -d prova -c 'select count(*) from public.projects')"
if [[ "$righe" != "1" ]]; then
  echo "   ERRORE: i dati non sono sopravvissuti ($righe righe)" >&2
  exit 1
fi
echo "   dati intatti"

echo "→ e sul caso vero: un database con solo la 0001 applicata"
"${PSQL[@]}" -d postgres -c "create database parziale" >/dev/null
"${PSQL[@]}" -d parziale -f supabase/tests/harness.sql >/dev/null
"${PSQL[@]}" -d parziale -f supabase/migrations/0001_flusso.sql >/dev/null 2>&1
"${PSQL[@]}" -t -A -d parziale -f supabase/setup-completo.sql 2>/dev/null | sed 's/^/   /'
"${PSQL[@]}" -t -A -d parziale -f supabase/tests/schema.test.sql 2>/dev/null | tail -1
