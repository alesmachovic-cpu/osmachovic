#!/usr/bin/env bash
# audit-pii-logs.sh
# Detekuje console.log s pravdepodobnou citlivou hodnotou (heslo, token, OP, IBAN).
# Greppe sa CELÝMI riadkami, nie po slovách.
set -uo pipefail
cd "$(dirname "$0")/.."

# Patterns ktoré v jednom riadku indikujú leak.
# Každý vzor = JEDEN match na celý riadok.
PATTERN='console\.(log|warn|error|info)[^;]*\b(password|api[_-]?key|secret|token[^_a-zA-Z]|totp_secret|iban|rodne_cislo|bcrypt\.hash|hashed)'

ALLOWLIST_PATTERNS=(
  "src/lib/cryptoDocs"
  "node_modules"
)

# Per-line marker: ak má riadok komentár "// safe-log" → preskoč
# (manuálne overené že sa nelogguje hodnota, len opis).
PER_LINE_ALLOW='// safe-log'

VIOLATIONS=0
TMP=$(mktemp)
grep -rEn "$PATTERN" src --include="*.ts" --include="*.tsx" 2>/dev/null > "$TMP" || true

while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)
  skip=false
  for a in "${ALLOWLIST_PATTERNS[@]}"; do
    if [[ "$file" == *"$a"* ]]; then skip=true; break; fi
  done
  $skip && continue
  # Per-line allow
  if [[ "$line" == *"$PER_LINE_ALLOW"* ]]; then continue; fi
  echo "  ✗ $line" | head -c 200
  echo ""
  VIOLATIONS=$((VIOLATIONS + 1))
done < "$TMP"
rm -f "$TMP"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ 0 pass"
  exit 1
fi
echo "VÝSLEDOK: ✓ 1 pass"
exit 0
