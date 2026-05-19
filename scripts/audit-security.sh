#!/usr/bin/env bash
# Audit script pre Security & Auth doménu.
# Overuje invariants z memory/domain-security.md.
# Použitie: ./scripts/audit-security.sh
# Exit code: 0 = healthy, 1 = problémy detegované

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
echo "   AUDIT: Security & Auth doména"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Rate limit na login"
if grep -q "login_attempts" src/app/api/auth/login/route.ts 2>/dev/null && \
   grep -q "checkRateLimit\|rate.*limit" src/app/api/auth/login/route.ts 2>/dev/null; then
  ok "Login route má rate limit logiku (login_attempts tabuľka)"
else
  fail "Login route NEMÁ rate limit — útočník môže brute-forcovať"
fi

section "Middleware — host allowlist + billing guard"
if grep -q "ALLOWED_HOSTS\|isAllowedHost" src/middleware.ts 2>/dev/null; then
  ok "Middleware má host allowlist"
else
  fail "Middleware NEMÁ host whitelist — Vercel preview URL prístupné cez backdoor"
fi
if grep -q "crm_billing" src/middleware.ts 2>/dev/null; then
  ok "Billing guard aktívny (suspended účty redirect na /nastavenia)"
else
  warn "Billing guard chýba — suspended firmy môžu používať appku"
fi

section "Session HMAC + secret"
if grep -q "SESSION_SECRET" src/lib/auth/session.ts 2>/dev/null; then
  ok "Session používa SESSION_SECRET env"
else
  fail "session.ts NEpoužíva SESSION_SECRET — HMAC podpis je nestabilný/predvídateľný"
fi

section "30-day device verification"
if grep -rqE "device_fingerprint|user_devices|verify.*device.*30" src/lib src/middleware.ts src/app/api 2>/dev/null; then
  ok "Device verify infrastructure existuje"
else
  warn "Device 30-day verify NIE JE IMPLEMENTOVANÉ (známy gap, ticket P1 v memory)"
fi

section "2FA / TOTP"
if grep -rqE "totp|otplib|two.factor|2fa" src/lib src/app/api --include="*.ts" 2>/dev/null; then
  ok "2FA infrastructure existuje"
else
  warn "2FA NIE JE IMPLEMENTOVANÉ (známy gap, ticket P2 v memory)"
fi

section "Audit log coverage"
AUDIT_USERS=$(grep -rln "logAudit\|audit_log" src/app/api --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
WRITE_ROUTES=$(find src/app/api -name "route.ts" 2>/dev/null | xargs grep -l "POST\|PATCH\|DELETE" 2>/dev/null | wc -l | tr -d ' ')
echo "  Audit users: $AUDIT_USERS routes | Write routes: $WRITE_ROUTES"
if [ "$AUDIT_USERS" -ge 8 ]; then
  ok "Audit log používaný v ≥8 routes"
else
  warn "Audit log iba v $AUDIT_USERS routes (mali by všetky write operácie)"
fi

section "RLS — anonné policy check"
echo "  RLS migrácie:"
grep -l "ENABLE ROW LEVEL\|CREATE POLICY" supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ' | sed 's/^/    /'
ANON_POLICIES=$(grep -rn "TO anon\|FOR.*USING.*anon" supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
if [ "$ANON_POLICIES" -gt 0 ]; then
  warn "$ANON_POLICIES anon RLS policy nájdených — over že žiadny USING(true)"
else
  ok "Žiadne explicitné anon RLS policies (anon je default-deny)"
fi

section "Sensitive env vars (nesmie byť v klientovi)"
LEAK_COUNT=$(grep -rn "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY\|RESEND_API_KEY\|SESSION_SECRET\|GEMINI_API_KEY\|OPENAI_API_KEY" src/components src/hooks --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "process.env" | wc -l | tr -d ' ')
if [ "$LEAK_COUNT" -eq 0 ]; then
  ok "Žiadne sensitive env vars priamo v komponentoch/hookoch"
else
  fail "$LEAK_COUNT podozrivých výskytov sensitive env vars v client kóde"
fi

section "Heslá — strength validation"
if grep -q "validatePasswordStrength" src/app/api/auth/register/route.ts 2>/dev/null && \
   grep -q "validatePasswordStrength" src/app/api/auth/reset/route.ts 2>/dev/null; then
  ok "Register a reset endpoints validujú silu hesla"
else
  fail "Niektoré auth endpointy NEvalidujú silu hesla"
fi

section "Anon RLS — sample table check"
# Vyžaduje .env.local s prod creds. Skip ak nie sú.
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  ANON=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$ANON" ]; then
    # Skús anon SELECT na users (musí vrátiť [])
    USERS_LEAK=$(curl -sS "${URL}/rest/v1/users?select=id&limit=1" -H "apikey: ${ANON}" -H "Authorization: Bearer ${ANON}" 2>/dev/null)
    if [ "$USERS_LEAK" = "[]" ]; then
      ok "Anon kľúč nečíta users tabuľku (správne RLS)"
    else
      fail "ANON KEY CHYBA RLS NA USERS: vrátilo $USERS_LEAK (treba block!)"
    fi
  else
    warn "Nemôžem testovať anon RLS (chýba SUPABASE_URL/ANON_KEY v .env.local)"
  fi
else
  warn "Preskakujem live anon RLS test (chýba .env.local)"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "❌ AUDIT FAILED — sú KRITICKÉ problémy. Pozri memory/domain-security.md."
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  echo "⚠ Niektoré gaps existujú (sledované v memory/domain-security.md). Žiadne nové problémy."
  exit 0
fi
echo "✅ All green. Doména v poriadku."
exit 0
