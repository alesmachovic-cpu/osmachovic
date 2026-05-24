#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# audit-auth-paths.sh — Security Auditor regression check pre 2FA gate.
#
# Účel: zabezpečiť že VŠETKY API endpointy ktoré vystavujú session cookie
#       (buildSessionCookieValue) majú implementovaný 2FA gate.
#
# Bug ktorý tento check chytí (2026-05-20):
#   /api/auth/google/match a /api/users/invite/accept vystavovali session bez
#   kontroly users.totp_enabled_at → 2FA bypass cez Google OAuth alebo invite.
#
# Pravidlo: každý súbor ktorý volá buildSessionCookieValue() MUSÍ obsahovať
#   buď "totp_enabled_at" check, alebo "requires_2fa" branch, alebo byť
#   v explicit ALLOWLIST nižšie (s odôvodnením).
#
# Exit code:
#   0 — všetky session emittery sú 2FA-aware
#   1 — našiel som endpoint bez 2FA gate
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Allowlist: súbory ktoré legitímne vystavujú session BEZ vlastného 2FA gate.
# Každá položka musí mať odôvodnenie.
ALLOWLIST=(
  # 2FA verify endpoint SÁM kontroluje 2FA (tu sa overuje), takže session
  # vystavený TU = po overení. Nesmie sám sebe pridať gate (paradox).
  "src/app/api/auth/2fa/verify/route.ts"
  # Register vytvára NOVÉHO usera → nový user nemôže mať 2FA (totp_enabled_at IS NULL).
  # Defence-in-depth: register endpoint by mal NIKDY nedovoliť vytvoriť usera
  # s totp_enabled_at != NULL z bodu (server insertuje len password + email +
  # nemá body.totp_enabled_at v allowed fields).
  "src/app/api/auth/register/route.ts"
)

echo "Audit: 2FA gate coverage v session emitteroch"
echo "─────────────────────────────────────────────"

# Nájdi všetky súbory ktoré volajú buildSessionCookieValue
EMITTERS=$(grep -rln "buildSessionCookieValue" src/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "src/lib/auth/session" || true)

if [ -z "$EMITTERS" ]; then
  echo "⚠ Žiadne session emittery nenájdené — buď zlý grep alebo žiadna auth."
  exit 1
fi

VIOLATIONS=0
PASSED=0

for file in $EMITTERS; do
  rel="${file#$REPO_ROOT/}"

  # Allowlist check
  in_allowlist=false
  for allowed in "${ALLOWLIST[@]}"; do
    if [ "$rel" = "$allowed" ]; then in_allowlist=true; break; fi
  done

  if $in_allowlist; then
    echo "  ⊘ $rel (allowlist)"
    continue
  fi

  # Hľadáme buď "totp_enabled_at" check ALEBO "requires_2fa" branch v súbore
  if grep -q "totp_enabled_at\|requires_2fa" "$file"; then
    echo "  ✓ $rel"
    PASSED=$((PASSED + 1))
  else
    echo "  ✗ $rel  ← NEMÁ 2FA gate!"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

echo "─────────────────────────────────────────────"
echo "Pass: $PASSED   Violations: $VIOLATIONS   Allowlisted: ${#ALLOWLIST[@]}"

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "❌ FAIL: nájdený endpoint ktorý vystavuje session BEZ 2FA gate."
  echo "Pridaj buď totp_enabled_at check, alebo explicitne pridaj do ALLOWLIST"
  echo "v scripts/audit-auth-paths.sh s odôvodnením."
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ $PASSED pass"
  exit 1
fi

echo "✓ OK: všetky session emittery majú 2FA gate (alebo allowlist exception)."
echo "VÝSLEDOK: ✓ $PASSED pass"
exit 0
