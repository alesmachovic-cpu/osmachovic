#!/usr/bin/env bash
# Audit: Náberáky, Zmluvy & Dokumenty doména
set -uo pipefail
cd "$(dirname "$0")/.."

PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Náberáky, Zmluvy & Dokumenty"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/app/api/nabery/route.ts src/app/api/naber-pdf/route.ts src/app/api/parse-doc/route.ts src/components/NaberyForm.tsx; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "Migrácia 070 (makler_id v naberove_listy)"
if ls supabase/migrations/070_naberove_makler_id*.sql >/dev/null 2>&1; then
  ok "Migrácia 070 existuje (lokálne)"
else
  fail "Migrácia 070 CHÝBA — Rastislav/Petra et al. nevidia svoje náberáky"
fi

section "naber-pdf používa service role (po fix 7afe9f3)"
if grep -q "getSupabaseAdmin\|SUPABASE_SERVICE_ROLE_KEY" src/app/api/naber-pdf/route.ts 2>/dev/null; then
  ok "naber-pdf používa service role (správne po fix)"
else
  fail "REGRESSION: naber-pdf používa anon kľúč → 404 pre všetkých"
fi
if grep -q "assertCanReadNaber\|company_id.*scope" src/app/api/naber-pdf/route.ts 2>/dev/null; then
  ok "naber-pdf má scope check (no cross-company leak)"
else
  fail "naber-pdf NEMÁ scope check — leak risk"
fi

section "Náber POST handler píše makler_id"
if grep -q "makler_id.*ownerMakler\|makler_id:" src/app/api/nabery/route.ts 2>/dev/null; then
  ok "POST handler nastavuje makler_id (správne po fix)"
else
  fail "POST handler NEpíše makler_id — nové náberáky nemajú vlastníka v UUID stĺpci"
fi

section "Podpis = immutable check v PATCH"
if grep -q "podpis_data\|isSigning" src/app/api/nabery/route.ts 2>/dev/null; then
  ok "PATCH handler kontroluje podpis_data state"
else
  fail "PATCH umožňuje editovať aj podpísané náberáky — právny problém"
fi

section "parse-doc Vercel timeout 300s"
if grep -q "maxDuration.*300\|export const maxDuration = 300" src/app/api/parse-doc/route.ts 2>/dev/null; then
  ok "parse-doc má 300s timeout konfigurovaný"
else
  warn "parse-doc maxDuration nie je explicitne 300s — môže timeout-nuť na veľkých PDF"
fi

section "Live DB — náberáky integrity"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    # Náberáky bez klient_id
    ORPHAN=$(curl -sS "${URL}/rest/v1/naberove_listy?select=id&klient_id=is.null" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    if [ "$ORPHAN" = "0" ]; then
      ok "Žiaden náberák bez klient_id"
    elif [ "$ORPHAN" != "?" ]; then
      warn "$ORPHAN náberákov bez klient_id (orphan)"
    fi
    # makler_id populated coverage
    TOTAL=$(curl -sS "${URL}/rest/v1/naberove_listy?select=id&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" -H "Prefer: count=exact" -I 2>/dev/null | grep -i "content-range" | sed 's|.*/||' | tr -d '\r\n')
    WITHM=$(curl -sS "${URL}/rest/v1/naberove_listy?select=id&makler_id=not.is.null&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" -H "Prefer: count=exact" -I 2>/dev/null | grep -i "content-range" | sed 's|.*/||' | tr -d '\r\n')
    if [ -n "$TOTAL" ] && [ -n "$WITHM" ]; then
      PCT=$(python3 -c "print(round(100*$WITHM/$TOTAL) if $TOTAL > 0 else 0)")
      if [ "$PCT" -ge 70 ]; then
        ok "$WITHM/$TOTAL náberákov ($PCT%) má makler_id (backfill OK)"
      else
        warn "Iba $WITHM/$TOTAL náberákov ($PCT%) má makler_id — backfill neúplný"
      fi
    fi
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ AUDIT FAILED"; exit 1; }
echo "✅ OK"
exit 0
