#!/usr/bin/env bash
# Audit: Security DEEP (kvartálne / týždenne pondelok od Sec Auditora)
# Toto je širší ako audit-security.sh (denný)
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Security DEEP (Adam Vrabec, E016)"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "1) Anon SELECT na VŠETKY tabuľky (anti-leak)"
if [ -f .env.local ]; then
  URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  ANON=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local 2>/dev/null | cut -d= -f2 | tr -d '"')
  if [ -n "$URL" ] && [ -n "$ANON" ]; then
    # Test tables that SHOULD be private
    PRIVATE_TABLES=("users" "klienti" "naberove_listy" "obhliadky" "faktury" "audit_log" "company_settings")
    for t in "${PRIVATE_TABLES[@]}"; do
      RESP=$(curl -sS "${URL}/rest/v1/${t}?select=id&limit=1" \
        -H "apikey: ${ANON}" -H "Authorization: Bearer ${ANON}" 2>/dev/null)
      if [ "$RESP" = "[]" ]; then
        ok "Anon NEVIDÍ $t"
      elif echo "$RESP" | grep -q "permission denied\|JWT"; then
        ok "Anon BLOKNUTÝ na $t (RLS deny)"
      else
        fail "ANON LEAK na $t: vrátilo $(echo "$RESP" | head -c 100)..."
      fi
    done
  fi
fi

section "2) Sensitive env vars v client kóde"
LEAK_FILES=$(grep -rln "SUPABASE_SERVICE_ROLE_KEY\|SESSION_SECRET\|GOOGLE_CLIENT_SECRET\|RESEND_API_KEY\|ANTHROPIC_API_KEY\|GEMINI_API_KEY\|OPENAI_API_KEY\|VAPID_PRIVATE_KEY" src/components src/hooks --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$LEAK_FILES" = "0" ]; then
  ok "Žiadne sensitive env vars v client kóde"
else
  fail "$LEAK_FILES klient súborov má sensitive env vars"
fi

section "3) Audit log coverage (write endpointy)"
WRITE_API=$(find src/app/api -name "route.ts" | xargs grep -l "POST\|PATCH\|DELETE" 2>/dev/null | wc -l | tr -d ' ')
LOGGED=$(grep -rln "logAudit" src/app/api --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
PCT=$(python3 -c "print(round(100*$LOGGED/$WRITE_API) if $WRITE_API > 0 else 0)")
if [ "$PCT" -ge 80 ]; then
  ok "Audit log coverage: $LOGGED/$WRITE_API ($PCT%)"
elif [ "$PCT" -ge 50 ]; then
  warn "Audit log iba $PCT% — treba zvýšiť"
else
  fail "Audit log iba $PCT% coverage — accountability gap"
fi

section "4) Password validation enforcement"
WEAK=0
for f in src/app/api/auth/register/route.ts src/app/api/auth/reset/route.ts; do
  if [ -f "$f" ]; then
    if grep -q "validatePasswordStrength" "$f" 2>/dev/null; then
      ok "$f používa validatePasswordStrength"
    elif grep -q "length < 8\|length < 12" "$f" 2>/dev/null; then
      warn "$f používa len length check (slabšie ako validatePasswordStrength)"
      WEAK=$((WEAK+1))
    else
      fail "$f bez password validation"
    fi
  fi
done

section "5) RLS migrácie — anonRole policy scan"
ANON_USING_TRUE=$(grep -rln "TO anon" supabase/migrations 2>/dev/null | xargs grep -l "USING.*true\|USING (true)" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ANON_USING_TRUE" = "0" ]; then
  ok "Žiadny USING(true) pre anon role"
else
  fail "$ANON_USING_TRUE migrácií má anon USING(true) — public read access"
fi

section "6) HTTP security headers (middleware.ts)"
if grep -q "Strict-Transport-Security\|frame-ancestors" src/middleware.ts 2>/dev/null; then
  ok "Security headers konfigurované v middleware"
else
  warn "Security headers (HSTS, CSP frame-ancestors) možno chýbajú"
fi

section "7) File upload security (parse-doc, fotky)"
if grep -rqn "filesize\|fileSize\|content-length" src/app/api/parse-doc src/app/api/parse-pdf 2>/dev/null; then
  ok "Parse endpointy kontrolujú size"
else
  warn "Parse endpointy možno bez size limit — DoS risk"
fi

section "8) XSS risk (dangerouslySetInnerHTML)"
XSS_RISK=$(grep -rln "dangerouslySetInnerHTML" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$XSS_RISK" = "0" ]; then
  ok "Žiadny dangerouslySetInnerHTML"
else
  warn "$XSS_RISK súborov používa dangerouslySetInnerHTML — overiť bezpečnosť"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ DEEP AUDIT FAILED — pozri memory/role-security-auditor.md"; exit 1; }
[ "$WARN" -gt 0 ] && echo "⚠ Gaps existujú, pripraviť kvartálny report"
echo "✅ OK"
exit 0
