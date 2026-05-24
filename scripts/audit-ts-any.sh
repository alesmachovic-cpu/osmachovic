#!/usr/bin/env bash
# audit-ts-any.sh
# CLAUDE.md zakazuje `any` v API routes a doménovej logike. Tento skript
# počíta výskyty `: any` alebo `as any` v src/ (mimo tests a knižníc).
set -uo pipefail
cd "$(dirname "$0")/.."

# Filter: exclude markers + 1 line before/after eslint-disable (Multi-line disable)
TMP=$(mktemp)
grep -rEn ": any\b|\bas any\b" src --include="*.ts" --include="*.tsx" 2>/dev/null > "$TMP" || true

VIOLATIONS=0
VIOLATION_LINES=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  # Skip node_modules / tests
  if [[ "$line" == *"node_modules"* ]] || [[ "$line" == *"tests/playwright"* ]]; then continue; fi
  # Per-line marker
  if [[ "$line" == *"ok-any"* ]] || [[ "$line" == *"eslint-disable"* ]]; then continue; fi
  # Check predošlý riadok v súbore či má eslint-disable-next-line
  file=$(echo "$line" | cut -d: -f1)
  linenum=$(echo "$line" | cut -d: -f2)
  if [ -f "$file" ] && [ "${linenum:-0}" -gt 1 ]; then
    PREV=$(sed -n "$((linenum - 1))p" "$file" 2>/dev/null)
    if [[ "$PREV" == *"eslint-disable-next-line"* ]] && [[ "$PREV" == *"no-explicit-any"* ]]; then
      continue
    fi
  fi
  VIOLATION_LINES+=("$line")
  VIOLATIONS=$((VIOLATIONS + 1))
done < "$TMP"
rm -f "$TMP"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Top 10 výskytov:"
  for ((i=0; i<${#VIOLATION_LINES[@]} && i<10; i++)); do
    echo "  ${VIOLATION_LINES[$i]}"
  done
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ 0 pass"
  exit 1
fi
echo "VÝSLEDOK: ✓ 1 pass"
exit 0
