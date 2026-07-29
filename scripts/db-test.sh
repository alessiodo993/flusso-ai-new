#!/usr/bin/env bash
#
# Applica la migrazione a un Postgres usa e getta e ci lancia contro le
# verifiche di schema. Serve solo un `psql` e un server raggiungibile.
#
#   npm run db:test
#
# Variabili opzionali:
#   PGHOST, PGPORT, PGUSER  — dove sta il server (default: socket locale)
#   FLUSSO_TEST_DB          — nome del database usa e getta
set -euo pipefail

cd "$(dirname "$0")/.."

DB="${FLUSSO_TEST_DB:-flusso_schema_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q --no-psqlrc)

if ! command -v psql >/dev/null 2>&1; then
  echo "psql non trovato: serve un client PostgreSQL per eseguire questi test." >&2
  exit 1
fi

if ! "${PSQL[@]}" -d postgres -c 'select 1' >/dev/null 2>&1; then
  echo "Nessun PostgreSQL raggiungibile. Avviane uno e riprova:" >&2
  echo "  docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16" >&2
  echo "  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run db:test" >&2
  exit 1
fi

echo "→ ricreo il database $DB"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null

echo "→ contorno Supabase (ruoli, schema auth, auth.uid)"
"${PSQL[@]}" -d "$DB" -f supabase/tests/harness.sql >/dev/null

echo "→ migrazioni"
# In ordine di nome: è l'ordine in cui le applica anche la CLI di Supabase.
for migration in supabase/migrations/*.sql; do
  echo "   · $(basename "$migration")"
  "${PSQL[@]}" -d "$DB" -f "$migration" >/dev/null
done

echo "→ verifiche"
# -t -A: gli helper restituiscono già la riga di esito, senza intestazioni.
"${PSQL[@]}" -t -A -d "$DB" -f supabase/tests/schema.test.sql

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null
