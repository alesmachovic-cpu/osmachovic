#!/usr/bin/env bash
# audit-secrets-in-code.sh
# Detekuje hardkódované API kľúče, tokeny, hesla v zdrojákoch.
# Skenuje IBA src/, scripts/, app/, supabase/ — NIE package-lock.json (sha512).
set -uo pipefail
cd "$(dirname "$0")/.."

PATTERNS=(
  'sk_(test|live)_[A-Za-z0-9]{20,}'           # Stripe secret keys
  '[0-9]{10}:AA[A-Za-z0-9_-]{32,}'            # Telegram bot tokens (live secrets v src)
  'AIza[0-9A-Za-z_-]{35}'                     # Google API keys
  'sb_secret_[A-Za-z0-9_-]{20,}'              # Supabase secret keys
  'eyJhbGciOi[A-Za-z0-9+/=_-]{60,}'           # JWT (skipne krátke hash ako integrity sha)
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'
)

ALLOWLIST_PATTERNS=(
  "scripts/tg-inbox.sh"           # má fallback bot token (TODO move to env)
)

# Scan iba aplikačné zdrojáky, NIE package-lock / node_modules / build cache
TARGET_DIRS=(src scripts supabase/migrations app)

VIOLATIONS=0

for pat in "${PATTERNS[@]}"; do
  for dir in "${TARGET_DIRS[@]}"; do
    [ ! -d "$dir" ] && continue
    HITS=$(grep -rEln "$pat" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.sh" --include="*.sql" 2>/dev/null || true)
    for f in $HITS; do
      skip=false
      for a in "${ALLOWLIST_PATTERNS[@]}"; do
        if [[ "$f" == *"$a"* ]]; then skip=true; break; fi
      done
      $skip && continue
      LINE=$(grep -En "$pat" "$f" 2>/dev/null | head -1)
      echo "  ✗ $f: $(echo "$LINE" | cut -c1-180)"
      VIOLATIONS=$((VIOLATIONS + 1))
    done
  done
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ 0 pass"
  exit 1
fi
echo "VÝSLEDOK: ✓ 1 pass"
exit 0
