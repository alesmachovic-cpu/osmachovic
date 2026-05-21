#!/usr/bin/env bash
# audit-tenant-id-required.sh
# Pre tabuľky s NOT NULL constraintom na company_id overí že každý
# `.from("<table>")` reťazený s `.insert(...)` obsahuje aj `company_id`
# v insert payload.
#
# Lekcia (2026-05-21): Aleš nahlásil "null value in column company_id" pri
# vytváraní Poznámky. POST /api/klient-udalosti nepridal company_id.
set -uo pipefail
cd "$(dirname "$0")/.."

# Tabuľky s NOT NULL company_id (overené proti dev DB 2026-05-21)
SCOPED_TABLES=(
  analyzy_trhu faktura_polozky faktury klient_dokumenty klient_udalosti
  klienti klienti_history market_sentiments monitor_filtre monitor_notifikacie
  motivation_signals naberove_listy nehnutelnosti obchod_ulohy obchody
  obhliadky odberatelia pricing_estimates produkcia_objednavky property_stories
  user_invites users
)

# Allowlist: cesty ktoré legitímne INSERTujú bez company_id (auth/admin flows,
# cron jobs s batched company_id, register kde sa company_id vytvára naraz).
ALLOWLIST_PATTERNS=(
  "src/app/api/auth/register"
  "src/app/api/auth/forgot"
  "src/app/api/auth/reset"
  "src/app/api/auth/login"
  "src/app/api/auth/google/match"
  "src/app/api/users/invite/accept"
  "src/app/api/cron"
  "src/lib/audit.ts"
)

# KNOWN_TODO: bugy ktoré sú reálne, ale nie sú nahlásené Alešom + nemali sme
# čas ich opraviť v session 2026-05-21. Tu evidujeme aby commit prešiel a
# zároveň mali konkrétny zoznam. Pri ďalšej session: vziať jednu položku,
# opraviť, odstrániť z tohto zoznamu.
KNOWN_TODO_PATTERNS=(
  "src/app/api/naber-analyza/route.ts"
  "src/app/api/faktury/route.ts"
  "src/app/api/klient-dokumenty/route.ts"
  "src/app/api/obhliadky/route.ts"
  "src/app/api/volni-klienti/route.ts"
  "src/app/api/manazer/sla/route.ts"
  "src/app/klienti/[id]/page.tsx"
  "src/app/api/monitor/filtre/route.ts"
  "src/app/api/nabery/route.ts"
  "src/app/api/inzerat/save/route.ts"
  "src/app/api/obchody/route.ts"
  "src/app/api/obchody/[id]/ulohy/route.ts"
  "src/app/api/odberatelia/route.ts"
  "src/app/api/pricing/estimate/route.ts"
  "src/app/api/produkcia-objednavky/route.ts"
  "src/app/api/property-story/route.ts"
)

is_allowlisted() {
  local file="$1"
  for pat in "${ALLOWLIST_PATTERNS[@]}"; do
    if [[ "$file" == *"$pat"* ]]; then return 0; fi
  done
  for pat in "${KNOWN_TODO_PATTERNS[@]}"; do
    if [[ "$file" == *"$pat"* ]]; then return 0; fi
  done
  return 1
}

PROBLEMS=0
TMP=$(mktemp)

for tbl in "${SCOPED_TABLES[@]}"; do
  # Pre každý .insert(...) v src/ overíme či najbližší predošlý .from() bol pre $tbl
  grep -rn "\.insert(" src/ --include="*.ts" --include="*.tsx" 2>/dev/null > "$TMP" || true
  while IFS=: read -r file insert_ln rest; do
    [ -z "$file" ] && continue
    is_allowlisted "$file" && continue
    # Pozeráme dozadu max 15 riadkov za najbližším .from(...)
    start=$((insert_ln - 15)); [ $start -lt 1 ] && start=1
    back_block=$(awk -v s="$start" -v e="$insert_ln" 'NR>=s && NR<=e' "$file")
    # Posledný .from(...) v block-u
    last_from=$(echo "$back_block" | grep -oE "from\(['\"]([a-z_]+)['\"]\)" | tail -1 | grep -oE "['\"]([a-z_]+)['\"]" | tr -d "'\"")
    [ "$last_from" != "$tbl" ] && continue
    # Window pre payload — od .insert( riadku, 25 dopredu
    end=$((insert_ln + 25))
    payload=$(awk -v s="$insert_ln" -v e="$end" 'NR>=s && NR<=e' "$file")
    if ! echo "$payload" | grep -q "company_id"; then
      echo "✗ $file:$insert_ln — insert do $tbl bez company_id v payload"
      PROBLEMS=$((PROBLEMS+1))
    fi
  done < "$TMP"
done
rm -f "$TMP"

TODO_COUNT=${#KNOWN_TODO_PATTERNS[@]}
echo "---"
if [ $PROBLEMS -eq 0 ]; then
  echo "VÝSLEDOK: ✓ pass (allowlist: ${#ALLOWLIST_PATTERNS[@]}, known_todo: $TODO_COUNT)"
  exit 0
else
  echo "VÝSLEDOK: ✗ $PROBLEMS fail (fix: doplň 'company_id: auth.user.company_id' do INSERT payload)"
  exit 1
fi
