#!/usr/bin/env bash
# Audit: Obhliadky & Kalendár
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Obhliadky & Kalendár"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/app/api/obhliadky/route.ts src/app/api/obhliadky/[id]/route.ts src/hooks/useKoliziaCheck.ts src/app/kalendar/page.tsx; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "Detail endpoint /api/obhliadky/[id] existuje (fix 2026-05-18)"
if [ -f "src/app/api/obhliadky/[id]/route.ts" ]; then
  if grep -q "select.*\\*\\|select(\"\\*\")" "src/app/api/obhliadky/[id]/route.ts" 2>/dev/null; then
    ok "Detail endpoint vracia plné dáta (vrátane podpis_data)"
  else
    warn "Detail endpoint NEpoužíva select('*') — over že vracia podpis_data"
  fi
else
  fail "Detail endpoint CHÝBA — detail page sa rozbije"
fi

section "List endpoint NEVRACIA podpis_data (perf invariant)"
if grep -q "LIST_COLUMNS\|podpis_data" src/app/api/obhliadky/route.ts 2>/dev/null; then
  if grep -q "podpis_data" src/app/api/obhliadky/route.ts 2>/dev/null && grep -q "LIST_COLUMNS" src/app/api/obhliadky/route.ts 2>/dev/null; then
    # Check that LIST_COLUMNS doesn't contain podpis_data
    if grep "LIST_COLUMNS" src/app/api/obhliadky/route.ts | grep -q "podpis_data"; then
      fail "REGRESSION: LIST_COLUMNS obsahuje podpis_data — bandwidth crisis"
    else
      ok "LIST_COLUMNS explicitne bez podpis_data (správne)"
    fi
  else
    ok "List endpoint má explicit columns"
  fi
else
  warn "Nemôžem overiť — manuálna kontrola"
fi

section "Detail page používa detail endpoint"
if grep -q "/api/obhliadky/\${" "src/app/obhliadky/[id]/page.tsx" 2>/dev/null || grep -q "/api/obhliadky/\`\${id}\`" "src/app/obhliadky/[id]/page.tsx" 2>/dev/null; then
  ok "Detail page volá /api/obhliadky/[id] (single fetch)"
elif grep -q "/api/obhliadky?klient_id=" "src/app/obhliadky/[id]/page.tsx" 2>/dev/null; then
  fail "REGRESSION: detail page znova fetuje list (O(N) namiesto O(1))"
fi

section "Google gating v dashboard + kalendar"
if grep -q "useGoogleConnected\|googleConnected" src/app/page.tsx 2>/dev/null; then
  ok "Dashboard skipne Google calls keď nepripojený"
else
  fail "REGRESSION: dashboard spamuje 401 na auto-detect"
fi
if grep -q "useGoogleConnected\|googleConnected" src/app/kalendar/page.tsx 2>/dev/null; then
  ok "Kalendar gated"
else
  fail "REGRESSION: kalendar spamuje 401"
fi

section "Live DB — obhliadky integrity"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    NULL_C=$(curl -sS "${URL}/rest/v1/obhliadky?company_id=is.null&select=id" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "import json,sys;print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    if [ "$NULL_C" = "0" ]; then
      ok "Žiadna obhliadka bez company_id"
    elif [ "$NULL_C" != "?" ]; then
      fail "$NULL_C obhliadok bez company_id"
    fi
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED"; exit 1; }
echo "✅ OK"
exit 0
