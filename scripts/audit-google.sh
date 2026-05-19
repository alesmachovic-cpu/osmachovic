#!/usr/bin/env bash
# Audit: Google Integrácia
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Google Integrácia"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/lib/google.ts src/app/api/auth/google/callback/route.ts src/app/api/auth/google/disconnect/route.ts src/app/api/auth/google/status/route.ts src/lib/useGoogleConnected.ts; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "useGoogleConnected má module-level cache (fix 2026-05-18)"
if grep -q "cache.*Map\|cache: Map\|new Map" src/lib/useGoogleConnected.ts 2>/dev/null && grep -q "inflight\|inflight" src/lib/useGoogleConnected.ts 2>/dev/null; then
  ok "Cache + inflight dedup implementované"
else
  fail "REGRESSION: useGoogleConnected znova robí per-component fetch (Problem #3 sa vráti)"
fi

section "Token encryption v save flow"
if grep -q "encryptToken\|encrypt" src/lib/google.ts 2>/dev/null; then
  ok "Tokens encrypted pred save"
else
  fail "Tokens BEZ encryption — citlivé credentials v plain texte"
fi

section "OAuth state CSRF check"
if grep -q "state\|csrf" src/app/api/auth/google/callback/route.ts 2>/dev/null; then
  ok "OAuth callback overuje state parameter"
else
  warn "OAuth state check neoverený — CSRF risk"
fi

section "Live DB — Google connect status"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    NOW=$(date +%s)
    SUMMARY=$(curl -sS "${URL}/rest/v1/users?select=id,name,google_email,google_token_expires_at" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
now = $NOW
connected = sum(1 for u in d if u.get('google_email'))
expired = sum(1 for u in d if u.get('google_email') and u.get('google_token_expires_at') and u.get('google_token_expires_at') < now)
print(f'{len(d)}|{connected}|{expired}')
" 2>/dev/null || echo "?|?|?")
    TOTAL=$(echo "$SUMMARY" | cut -d'|' -f1)
    CONNECTED=$(echo "$SUMMARY" | cut -d'|' -f2)
    EXPIRED=$(echo "$SUMMARY" | cut -d'|' -f3)
    if [ "$TOTAL" != "?" ]; then
      ok "Users: $TOTAL total, $CONNECTED s Google connect"
      if [ "$EXPIRED" -gt 0 ]; then
        warn "$EXPIRED users s EXPIRED Google tokenom — UI by mal ukázať 'pripoj znova'"
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
