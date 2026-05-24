#!/usr/bin/env bash
# Master aggregator — spustí všetkých 18 audit scriptov + meta audit + sumarizuje.
# Použitie:
#   ./scripts/audit-all.sh         # human-friendly výstup
#   ./scripts/audit-all.sh --json  # JSON pre cron / email
# Daily o 02:00 SK cez cron (TODO setup).

set -uo pipefail
cd "$(dirname "$0")/.."

JSON_MODE=false
[ "${1:-}" = "--json" ] && JSON_MODE=true

TOTAL_PASS=0
TOTAL_WARN=0
TOTAL_FAIL=0
RESULTS=()

$JSON_MODE || echo "═══════════════════════════════════════════════"
$JSON_MODE || echo "   AUDIT ALL — VIANEMA Engineering"
$JSON_MODE || echo "   Spustené: $(date '+%Y-%m-%d %H:%M:%S')"
$JSON_MODE || echo "═══════════════════════════════════════════════"

for script in scripts/audit-*.sh; do
  [ ! -f "$script" ] && continue
  NAME=$(basename "$script" .sh | sed 's/audit-//')
  # Skip audit-all itself
  [ "$NAME" = "all" ] && continue

  OUTPUT=$("$script" 2>&1 || true)
  PASS=$(echo "$OUTPUT" | grep -E "^✓ [0-9]+ pass|VÝSLEDOK: ✓" | tail -1 | grep -oE "[0-9]+ pass" | grep -oE "^[0-9]+" || echo "0")
  WARN=$(echo "$OUTPUT" | grep -E "VÝSLEDOK.*warn" | tail -1 | grep -oE "[0-9]+ warn" | grep -oE "^[0-9]+" || echo "0")
  FAIL=$(echo "$OUTPUT" | grep -E "VÝSLEDOK.*fail" | tail -1 | grep -oE "[0-9]+ fail" | grep -oE "^[0-9]+" || echo "0")

  PASS=${PASS:-0}
  WARN=${WARN:-0}
  FAIL=${FAIL:-0}

  TOTAL_PASS=$((TOTAL_PASS + PASS))
  TOTAL_WARN=$((TOTAL_WARN + WARN))
  TOTAL_FAIL=$((TOTAL_FAIL + FAIL))

  STATUS="ok"
  [ "$WARN" -gt 0 ] && STATUS="warn"
  [ "$FAIL" -gt 0 ] && STATUS="fail"

  RESULTS+=("${NAME}|${PASS}|${WARN}|${FAIL}|${STATUS}")

  if ! $JSON_MODE; then
    case "$STATUS" in
      fail) ICON="❌";;
      warn) ICON="⚠";;
      *)    ICON="✓";;
    esac
    printf "  %s %-30s ✓%2d ⚠%2d ✗%2d\n" "$ICON" "$NAME" "$PASS" "$WARN" "$FAIL"
  fi
done

if $JSON_MODE; then
  # JSON output pre email/cron
  echo "{"
  echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
  echo "  \"total_pass\": $TOTAL_PASS,"
  echo "  \"total_warn\": $TOTAL_WARN,"
  echo "  \"total_fail\": $TOTAL_FAIL,"
  echo "  \"audits\": ["
  for i in "${!RESULTS[@]}"; do
    IFS='|' read -r NAME PASS WARN FAIL STATUS <<< "${RESULTS[$i]}"
    COMMA=""
    [ "$i" -lt $((${#RESULTS[@]} - 1)) ] && COMMA=","
    echo "    {\"name\": \"$NAME\", \"pass\": $PASS, \"warn\": $WARN, \"fail\": $FAIL, \"status\": \"$STATUS\"}$COMMA"
  done
  echo "  ]"
  echo "}"
else
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "OVERALL: ✓ $TOTAL_PASS pass | ⚠ $TOTAL_WARN warn | ✗ $TOTAL_FAIL fail"
  echo "Failed audits:"
  for r in "${RESULTS[@]}"; do
    IFS='|' read -r NAME PASS WARN FAIL STATUS <<< "$r"
    [ "$FAIL" -gt 0 ] && echo "  ❌ $NAME ($FAIL fails)"
  done
  echo "═══════════════════════════════════════════════"
fi

# Exit code reflects worst status
[ "$TOTAL_FAIL" -gt 0 ] && exit 1
[ "$TOTAL_WARN" -gt 0 ] && exit 0  # warnings nezhadzujú CI
exit 0
