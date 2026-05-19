#!/usr/bin/env bash
# Audit: Operativa & Manažér
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Operativa & Manažér"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/app/manazer/page.tsx src/app/api/push/route.ts src/app/notifikacie/page.tsx src/app/log/page.tsx; do
  if [ -f "$f" ]; then ok "$f"; else warn "Chýba: $f (možno iná lokácia)"; fi
done

section "VAPID keys v env"
if grep -qE "VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY" .env.local 2>/dev/null; then
  ok "VAPID keys konfigurované"
else
  warn "VAPID keys CHÝBAJÚ v .env.local — push nefunguje"
fi

section "Cron api-status registered"
if grep -q '"/api/cron/api-status"' vercel.json 2>/dev/null; then
  ok "api-status cron registered"
else
  fail "api-status cron CHÝBA — žiaden healthcheck 3rd party"
fi

section "Cron health check tabuľka (cron_runs)"
if grep -rln "cron_runs\|cron_health" supabase/migrations/ 2>/dev/null | head -1 >/dev/null; then
  ok "cron_runs tabuľka existuje (cron tracking)"
else
  warn "cron_runs tabuľka CHÝBA — tichý fail môže byť (Monitor 8 dní mŕtve!)"
fi

section "Live DB — cron lag (vianema scrape) — KRITICKÁ KONTROLA"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    LAST=$(curl -sS "${URL}/rest/v1/monitor_inzeraty?select=created_at&order=created_at.desc&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);print(d[0]['created_at'] if d else '')" 2>/dev/null)
    if [ -n "$LAST" ]; then
      AGE_H=$(python3 -c "
import datetime
last = datetime.datetime.fromisoformat('$LAST'.replace('Z','+00:00'))
age = (datetime.datetime.now(datetime.timezone.utc) - last).total_seconds() / 3600
print(round(age))
" 2>/dev/null || echo "?")
      if [ "$AGE_H" != "?" ] && [ "$AGE_H" -lt 36 ]; then
        ok "Posledný scrape pred $AGE_H hodinami (healthy)"
      elif [ "$AGE_H" != "?" ]; then
        fail "Posledný scrape pred $AGE_H hodinami — CRON ZLYHAL, ALERT POTREBNÝ"
      fi
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
