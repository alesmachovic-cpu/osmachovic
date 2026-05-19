#!/usr/bin/env bash
# Audit: Nehnuteľnosti & Portfólio
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Nehnuteľnosti & Portfólio"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/app/api/nehnutelnosti/route.ts src/app/api/inzerat/save/route.ts src/components/InzeratForm.tsx src/app/portfolio/page.tsx; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "Inzerát save má company_id derivation (fix 2026-05-18)"
if grep -q "insertPayload.company_id\|company_id.*scope" src/app/api/inzerat/save/route.ts 2>/dev/null; then
  ok "company_id sa derivuje zo scope"
else
  fail "REGRESSION: inzerát save znova bez company_id derivation — NULL constraint fail"
fi

section "Matching adresár"
if [ -d src/lib/matching ]; then
  ok "src/lib/matching/ existuje"
  if ls src/lib/matching/*.test.* 2>/dev/null | head -1 >/dev/null; then
    ok "Matching má testy"
  else
    warn "Matching nemá testy"
  fi
fi

section "Live DB — nehnuteľnosti integrity"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    NULL_C=$(curl -sS "${URL}/rest/v1/nehnutelnosti?company_id=is.null&select=id" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "import json,sys;print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    if [ "$NULL_C" = "0" ]; then
      ok "Žiadna nehnuteľnosť bez company_id"
    elif [ "$NULL_C" != "?" ]; then
      fail "$NULL_C nehnuteľnosti bez company_id"
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
