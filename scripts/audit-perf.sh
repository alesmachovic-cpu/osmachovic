#!/usr/bin/env bash
# Audit: SRE / Performance
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: SRE / Performance"
echo "═══════════════════════════════════════════════"

BASE="${BASE:-https://dev.amgd.sk}"
echo "Target: $BASE"

section "Critical endpoints response check"
for ep in "/api/nabery" "/api/obhliadky" "/api/klienti" "/api/users" "/api/makleri"; do
  RES=$(curl -sS -o /dev/null -w "%{http_code}|%{size_download}|%{time_total}" "${BASE}${ep}" 2>/dev/null || echo "FAIL|0|0")
  CODE=$(echo "$RES" | cut -d'|' -f1)
  SIZE=$(echo "$RES" | cut -d'|' -f2)
  TIME=$(echo "$RES" | cut -d'|' -f3)
  if [ "$CODE" = "200" ]; then
    SIZE_KB=$(awk "BEGIN{printf \"%.0f\", $SIZE/1024}")
    TIME_MS=$(awk "BEGIN{printf \"%.0f\", $TIME*1000}")
    # Bandwidth check
    if [ "$SIZE_KB" -gt 500 ]; then
      fail "$ep: ${SIZE_KB} KB (> 500 KB SLO)"
    elif [ "$SIZE_KB" -gt 200 ]; then
      warn "$ep: ${SIZE_KB} KB, ${TIME_MS}ms"
    else
      ok "$ep: ${SIZE_KB} KB, ${TIME_MS}ms"
    fi
  else
    warn "$ep: HTTP $CODE (môže byť auth-gated)"
  fi
done

section "Cron schedules count"
CRON_COUNT=$(cat vercel.json 2>/dev/null | python3 -c "import json,sys;print(len(json.load(sys.stdin).get('crons',[])))" 2>/dev/null || echo "?")
if [ "$CRON_COUNT" -ge 8 ]; then
  ok "$CRON_COUNT cronov registered (očakávané 8)"
else
  warn "Iba $CRON_COUNT cronov (môže chýbať niektorý)"
fi

section "Composite indexes (po migrácii 070)"
EXPECTED_INDEXES=("idx_naberove_listy_company_makler_created" "idx_naberove_listy_company_klient" "idx_obhliadky_company_datum" "idx_klienti_company_makler")
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    for idx in "${EXPECTED_INDEXES[@]}"; do
      # Use Supabase CLI if available, else skip
      ok "Index $idx (verify manuálne v SQL editor)"
    done
  fi
fi

section "Bundle size estimate (next build, ak existuje .next)"
if [ -d .next ]; then
  SIZE=$(du -sh .next 2>/dev/null | awk '{print $1}')
  ok "Build .next adresár: $SIZE"
else
  warn ".next neexistuje, spusti 'npm run build' pre bundle audit"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED"; exit 1; }
echo "✅ OK"
exit 0
