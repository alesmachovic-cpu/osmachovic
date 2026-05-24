#!/usr/bin/env bash
# Audit: QA & Testing
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: QA & Testing"
echo "═══════════════════════════════════════════════"

section "ESLint config validity"
if [ -f eslint.config.js ] || [ -f eslint.config.mjs ]; then
  ok "ESLint v9+ config existuje"
elif ls .eslintrc* 2>/dev/null | head -1 >/dev/null; then
  fail "ESLint v9 vyžaduje eslint.config.js, projekt má .eslintrc legacy = lint nefunguje"
else
  fail "Žiadny ESLint config"
fi

section "TypeScript check globálne"
if [ -d node_modules ] || [ -L node_modules ]; then
  TS_ERR=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
  if [ "$TS_ERR" -eq 0 ]; then
    ok "TS check: 0 errors"
  else
    fail "TS check: $TS_ERR errors"
  fi
else
  warn "node_modules chýba — skipnem TS check"
fi

section "Test súbory existujú"
TEST_COUNT=$(find src -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TEST_COUNT" -gt 0 ]; then
  ok "Test súborov: $TEST_COUNT"
else
  warn "Žiadne test súbory v src/ — kritické flow nie sú coverované"
fi

section "Console.log v API routes (nemali by byť v prod)"
CL_COUNT=$(grep -rln "console.log" src/app/api 2>/dev/null | wc -l | tr -d ' ')
if [ "$CL_COUNT" -lt 5 ]; then
  ok "Iba $CL_COUNT API súborov má console.log"
else
  warn "$CL_COUNT API súborov má console.log — pre prod radšej console.error/warn alebo zmazať"
fi

section "Critical flow checklist (manuálne tracking)"
echo "  Sleduj v memory/role-qa.md či má každý flow test"

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED"; exit 1; }
echo "✅ OK"
exit 0
