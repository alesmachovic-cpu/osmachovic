#!/usr/bin/env bash
# Audit: Compliance Officer (GDPR/AML/dane)
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Compliance (GDPR/AML/dane)"
echo "═══════════════════════════════════════════════"

section "GDPR endpointy"
for f in src/app/api/gdpr/export/route.ts src/app/api/gdpr/erasure/route.ts; do
  if [ -f "$f" ]; then
    if grep -q "logAudit\|audit_log" "$f"; then
      ok "$f má audit log"
    else
      fail "$f BEZ audit log — GDPR akcia nelogovaná"
    fi
  else
    fail "Chýba: $f — GDPR žiadosť nemá endpoint"
  fi
done

section "GDPR consent stĺpce v tabuľkách (migrácie)"
GDPR_TABLES=$(grep -lE "gdpr_consent" supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
if [ "$GDPR_TABLES" -ge 2 ]; then
  ok "GDPR consent v $GDPR_TABLES migráciách"
else
  warn "GDPR consent iba v $GDPR_TABLES migráciách"
fi

section "Audit log coverage % (TARGET ≥ 80%)"
WRITE_API=$(find src/app/api -name "route.ts" | xargs grep -l "POST\|PATCH\|DELETE" 2>/dev/null | wc -l | tr -d ' ')
LOGGED=$(grep -rln "logAudit" src/app/api --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
PCT=$(python3 -c "print(round(100*$LOGGED/$WRITE_API) if $WRITE_API > 0 else 0)")
if [ "$PCT" -ge 80 ]; then
  ok "Audit log: $LOGGED/$WRITE_API ($PCT%)"
elif [ "$PCT" -ge 50 ]; then
  warn "Audit log: $LOGGED/$WRITE_API ($PCT%) — pod 80% target"
else
  fail "Audit log iba $PCT% coverage — KRITICKÝ accountability gap"
fi

section "Faktúra retention check"
if grep -rqn "retention\|10.*year\|archive" src/app/api/faktury 2>/dev/null; then
  ok "Faktúra retention/archive logika nájdená"
else
  warn "Faktúra retention NEenforced v code — zákon 10 rokov"
fi

section "AML check pred KZ (Náberáky)"
if grep -rqn "aml_check\|amlCheck" src/app/api/nabery 2>/dev/null; then
  ok "AML check spomenutý v nabery endpointoch"
else
  warn "AML check ENFORCEMENT chýba — KZ podpis bez AML overenia"
fi

section "Privacy policy súbor"
if [ -f public/privacy.html ] || [ -f public/privacy-policy.html ] || [ -d src/app/privacy ]; then
  ok "Privacy policy súbor existuje"
else
  warn "Privacy policy súbor nenájdený — over že je niekde"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED — compliance gap"; exit 1; }
echo "✅ OK"
exit 0
