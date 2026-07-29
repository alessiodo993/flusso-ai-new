#!/usr/bin/env bash
#
# Pubblica Flusso su Vercel da riga di comando.
#
#   VERCEL_TOKEN=... bash scripts/deploy-vercel.sh
#
# Le variabili d'ambiente le prende da `.env.local`, che non è nel repository:
# è il motivo per cui questo script può essere versionato senza portarsi
# dietro nessun segreto. `APP_URL` è l'unica che non si può sapere in anticipo
# — la assegna Vercel — quindi viene scritta al secondo giro e si ripubblica.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Serve VERCEL_TOKEN. Crealo su vercel.com/account/tokens (scope: Full Account)." >&2
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo "Manca .env.local: senza non so quali chiavi caricare." >&2
  exit 1
fi

VERCEL=(npx --yes vercel@latest --token "$VERCEL_TOKEN" --yes)

echo "→ Collego la cartella a un progetto Vercel"
"${VERCEL[@]}" link --project flusso >/dev/null

# Le variabili che il server deve avere. `APP_URL` la trattiamo a parte.
KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_TOKEN_SECRET
)

set_env() {
  local name="$1" value="$2"
  [[ -z "$value" ]] && return 0

  # Rimuovere prima di aggiungere: `vercel env add` non sovrascrive, e senza
  # questo un secondo giro fallirebbe con "già esistente".
  "${VERCEL[@]}" env rm "$name" production >/dev/null 2>&1 || true
  printf '%s' "$value" | "${VERCEL[@]}" env add "$name" production >/dev/null
  echo "   $name impostata"
}

echo "→ Carico le variabili d'ambiente"
for key in "${KEYS[@]}"; do
  value="$(grep -E "^${key}=" .env.local | head -1 | cut -d= -f2- || true)"
  set_env "$key" "$value"
done

echo "→ Prima pubblicazione"
url="$("${VERCEL[@]}" deploy --prod 2>/dev/null | tail -1)"
echo "   $url"

echo "→ Registro APP_URL e ripubblico, così i link tornano al posto giusto"
set_env APP_URL "$url"
final="$("${VERCEL[@]}" deploy --prod 2>/dev/null | tail -1)"

cat <<FINE

Fatto: $final

Restano due cose da fare a mano, perché stanno su servizi altrui:

1. Supabase → Authentication → URL Configuration
   Site URL:      $final
   Redirect URLs: $final/**   e   http://localhost:3000/**

2. Solo se vuoi Google Calendar — Google Cloud Console → Credentials →
   il tuo client OAuth → Authorized redirect URIs:
   $final/api/google/callback

Il perché di entrambe, passo per passo, sta in docs/deploy.md.
FINE
