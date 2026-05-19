#!/usr/bin/env bash
# Audit: Finančný systém
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Finančný systém"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/app/api/faktury/pdf/route.ts src/app/api/maklerske-provizie/route.ts src/app/api/cron/pravidelne-naklady/route.ts src/app/pravidelne-naklady/page.tsx src/app/uctovny-prehlad/page.tsx; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "Cron pravidelne-naklady registered"
if grep -q '"/api/cron/pravidelne-naklady"' vercel.json; then
  ok "Cron registered"
else
  fail "Cron CHÝBA — pravidelné náklady sa nebudú pridávať"
fi

section "Pravidelné náklady defensive array (fix 2026-05-18)"
if grep -q "Array.isArray" src/app/pravidelne-naklady/page.tsx 2>/dev/null; then
  ok "Frontend má defensive Array.isArray() coerce"
else
  fail "REGRESSION: pravidelné náklady frontend môže znova spadnúť (e.filter is not a function)"
fi

section "Daňová sadzba — hardcoded check"
if grep -rqE "0\\.15|0\\.21|15%|21%" src/app/uctovny-prehlad src/app/api/faktury 2>/dev/null; then
  warn "Daňové sadzby hardcoded — pri legislatívnej zmene treba update"
fi

section "Faktúra audit log"
if grep -q "logAudit\|audit_log" src/app/api/faktury/pdf/route.ts 2>/dev/null; then
  ok "Faktúra PDF má audit log"
else
  warn "Faktúra PDF nemá audit log — accountability gap"
fi

section "Live DB — faktúra duplicit check"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    # Faktúra count this year
    YEAR=$(date +%Y)
    COUNT=$(curl -sS "${URL}/rest/v1/faktury?select=cislo&cislo=like.${YEAR}*" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
nums = [r.get('cislo') for r in d if r.get('cislo')]
dups = [n for n in set(nums) if nums.count(n) > 1]
print(f'{len(nums)}|{len(dups)}')
" 2>/dev/null || echo "?|?")
    TOTAL=$(echo "$COUNT" | cut -d'|' -f1)
    DUPS=$(echo "$COUNT" | cut -d'|' -f2)
    if [ "$DUPS" = "0" ]; then
      ok "Faktúry: $TOTAL tento rok, 0 duplicit"
    elif [ "$DUPS" != "?" ]; then
      fail "$DUPS DUPLICITNÝCH faktúrových čísel v $YEAR — právny problém!"
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
