#!/usr/bin/env bash
# Audit: Klienti & Pipeline doména
set -uo pipefail
cd "$(dirname "$0")/.."

PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Klienti & Pipeline"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files existujú"
for f in src/lib/scope.ts src/lib/maklerMap.ts src/app/api/klienti/route.ts src/components/NewKlientModal.tsx src/app/api/gdpr/erasure/route.ts; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "Cron volni-klienti registered"
if grep -q '"/api/cron/volni-klienti"' vercel.json; then
  ok "Cron registered v vercel.json"
else
  fail "Volni-klienti cron CHÝBA — 24h dropoff nefunguje"
fi

section "GDPR endpointy"
for f in src/app/api/gdpr/export/route.ts src/app/api/gdpr/erasure/route.ts; do
  if [ -f "$f" ]; then
    if grep -q "logAudit\|audit_log" "$f" 2>/dev/null; then
      ok "$f má audit log"
    else
      fail "$f nemá audit log — GDPR akcia musí byť logged!"
    fi
  fi
done

section "maklerMap.ts používa server endpointy (NIE anon supabase)"
if grep -q "supabase.from" src/lib/maklerMap.ts 2>/dev/null && ! grep -q "/api/users" src/lib/maklerMap.ts 2>/dev/null; then
  fail "REGRESSION: maklerMap.ts znova používa anon supabase — Rastislav bug sa vráti!"
else
  ok "maklerMap.ts používa /api/users a /api/makleri (správny pattern po fix 25d02d2)"
fi

section "Klientská zóna — token security"
if [ -d src/app/klientska-zona ]; then
  if grep -rqE "uuid|signed.token|jwt" src/app/klientska-zona 2>/dev/null; then
    ok "Klientská zóna pravdepodobne používa secure tokens"
  else
    warn "Klientská zóna existuje, ale token security neoverené — manuálny audit"
  fi
fi

section "Live DB sanity"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$KEY" ]; then
    NULL_COMPANY=$(curl -sS "${URL}/rest/v1/klienti?company_id=is.null&limit=1" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    if [ "$NULL_COMPANY" = "0" ]; then
      ok "Žiadny klient bez company_id"
    elif [ "$NULL_COMPANY" = "?" ]; then
      warn "Neviem overiť"
    else
      fail "$NULL_COMPANY klientov bez company_id — multi-tenancy leak risk"
    fi
  else
    warn "Live check skipnutý (chýba env)"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ AUDIT FAILED"; exit 1; }
echo "✅ OK"
exit 0
