#!/usr/bin/env bash
# Audit script pre Monitor & Analýza doménu.
# Overuje invariants z memory/domain-monitor.md.
# Použitie: ./scripts/audit-monitor.sh

set -uo pipefail
cd "$(dirname "$0")/.."

PASS=0
WARN=0
FAIL=0

ok()    { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn()  { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Monitor & Analýza doména"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Cron registered v vercel.json"
if [ -f vercel.json ]; then
  if grep -q '"/api/cron/scrape"' vercel.json; then
    ok "Daily scrape cron registered"
  else
    fail "/api/cron/scrape NIE JE v vercel.json — scraping je MŔTVY"
  fi
  if grep -q '"/api/cron/monitor-daily"' vercel.json; then
    ok "monitor-daily cron registered (signal detection)"
  else
    fail "/api/cron/monitor-daily NIE JE registered — žiadne nové signály"
  fi
else
  fail "vercel.json chýba"
fi

section "Parsery existujú"
for p in bazos-sk reality-sk nehnutelnosti-sk; do
  if [ -f "src/lib/monitor/parsers/${p}.ts" ]; then
    ok "Parser $p existuje"
  else
    fail "Parser $p CHÝBA — portál nebude scrape-nutý"
  fi
done

section "Klasifikátor v2"
if [ -f src/lib/monitor/classifier.ts ]; then
  ok "Klasifikátor existuje"
else
  fail "Klasifikátor súbor CHÝBA"
fi
if [ -f src/lib/monitor/classifier.test.ts ]; then
  ok "Klasifikátor má testy"
  # Skús ich spustiť (rýchle, ~1-2s)
  if command -v npx >/dev/null 2>&1; then
    if [ -d node_modules ] || [ -L node_modules ]; then
      RESULT=$(npx vitest run src/lib/monitor/classifier.test.ts 2>&1 | tail -3)
      if echo "$RESULT" | grep -q "passed\|✓"; then
        ok "Klasifikátor testy prešli"
      else
        warn "Klasifikátor testy nemajú PASSED výstup (možno fail, pozri manuálne)"
      fi
    else
      warn "node_modules neexistuje — neviem spustiť testy"
    fi
  fi
else
  warn "Klasifikátor NEMÁ testy (riziko regression)"
fi

section "Monitor API endpointy"
EXPECTED=("route" "analyza" "inzeraty" "status" "classify-override" "reclassify-all" "filtre")
MISSING=0
for ep in "${EXPECTED[@]}"; do
  if [ -f "src/app/api/monitor/${ep}/route.ts" ] || [ -f "src/app/api/monitor/${ep}.ts" ] || ([ "$ep" = "route" ] && [ -f "src/app/api/monitor/route.ts" ]); then
    ok "Endpoint /api/monitor/${ep}"
  else
    warn "Endpoint /api/monitor/${ep} chýba"
    MISSING=$((MISSING+1))
  fi
done

section "Tabuľky cez migrácie"
EXPECTED_MIGS=("008_monitor_tables" "035_monitor_snapshots" "039_motivation_signals" "041_classifier_v2")
for mig in "${EXPECTED_MIGS[@]}"; do
  if ls supabase/migrations/${mig}*.sql >/dev/null 2>&1; then
    ok "Migrácia ${mig}*"
  else
    fail "Migrácia ${mig}* chýba — schema je nekompatibilná"
  fi
done

section "Live data check (vyžaduje .env.local)"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    # 1) Počet inzerátov v DB
    COUNT=$(curl -sS "${URL}/rest/v1/monitor_inzeraty?select=id&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" \
      -H "Prefer: count=exact" -I 2>/dev/null | grep -i "content-range" | sed 's|.*/||' | tr -d '\r\n')
    if [ -n "$COUNT" ] && [ "$COUNT" -ge 10 ]; then
      ok "DB obsahuje $COUNT monitor_inzeraty (sanity OK)"
    elif [ -n "$COUNT" ]; then
      warn "DB má iba $COUNT inzerátov — scrape možno nebehol alebo je nový projekt"
    else
      warn "Neviem zistiť počet inzerátov"
    fi

    # 2) Posledný scrape kedy bol (cez created_at MAX)
    LAST=$(curl -sS "${URL}/rest/v1/monitor_inzeraty?select=created_at&order=created_at.desc&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['created_at'] if d else '')" 2>/dev/null)
    if [ -n "$LAST" ]; then
      AGE_DAYS=$(python3 -c "
import datetime
try:
    last = datetime.datetime.fromisoformat('$LAST'.replace('Z','+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - last).total_seconds() / 86400
    print(f'{age:.1f}')
except: print('?')
")
      if [ "$AGE_DAYS" = "?" ]; then
        warn "Nevedel som spočítať vek posledného scrape"
      elif python3 -c "import sys; sys.exit(0 if float('$AGE_DAYS') < 2.0 else 1)" 2>/dev/null; then
        ok "Posledný scrape pred $AGE_DAYS dňami (zdravé, daily cron OK)"
      else
        fail "Posledný scrape pred $AGE_DAYS dňami — cron je pravdepodobne ROZBITÝ"
      fi
    fi

    # 3) Klasifikátor coverage
    UNKNOWN=$(curl -sS "${URL}/rest/v1/monitor_inzeraty?select=id&predajca_typ=eq.nejisty&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" \
      -H "Prefer: count=exact" -I 2>/dev/null | grep -i "content-range" | sed 's|.*/||' | tr -d '\r\n')
    if [ -n "$UNKNOWN" ] && [ -n "$COUNT" ] && [ "$COUNT" -gt 0 ]; then
      PCT=$(python3 -c "print(round(100*$UNKNOWN/$COUNT))" 2>/dev/null)
      if [ "$PCT" -lt 30 ]; then
        ok "Klasifikátor: $PCT% nejistých (zdravé, <30%)"
      else
        warn "Klasifikátor: $PCT% nejistých inzerátov (vysoké, treba tuning)"
      fi
    fi
  else
    warn "Nemôžem urobiť live checks (chýba SUPABASE_URL/SERVICE_KEY v .env.local)"
  fi
else
  warn "Preskakujem live checks (chýba .env.local)"
fi

section "TypeScript check (monitor súbory)"
if command -v npx >/dev/null 2>&1 && ([ -d node_modules ] || [ -L node_modules ]); then
  TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -E "src/lib/monitor|src/app/api/monitor|src/app/monitor" | wc -l | tr -d ' ')
  if [ "$TS_ERRORS" -eq 0 ]; then
    ok "Žiadne TS errors v monitor súboroch"
  else
    fail "TS errors v monitor: $TS_ERRORS"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "❌ AUDIT FAILED — pozri memory/domain-monitor.md."
  exit 1
fi
[ "$WARN" -gt 0 ] && echo "⚠ Niektoré gaps existujú (sledované v memory)."
echo "✅ Doména v poriadku."
exit 0
