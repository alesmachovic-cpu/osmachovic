#!/usr/bin/env bash
# audit-rate-limit.sh
# Skontroluje že každý auth endpoint má rate limit.
set -uo pipefail
cd "$(dirname "$0")/.."

# Endpointy ktoré musia mať rate limit (defence-in-depth proti brute force).
AUTH_ENDPOINTS=(
  "src/app/api/auth/login/route.ts"
  "src/app/api/auth/register/route.ts"
  "src/app/api/auth/forgot/route.ts"
  "src/app/api/auth/reset/route.ts"
  "src/app/api/auth/2fa/verify/route.ts"
  "src/app/api/users/invite/accept/route.ts"
)

VIOLATIONS=0
PASSED=0

for f in "${AUTH_ENDPOINTS[@]}"; do
  [ ! -f "$f" ] && continue
  if grep -qE "rateLimit|checkRateLimit|RATE_LIMITS" "$f"; then
    PASSED=$((PASSED + 1))
  else
    VIOLATIONS=$((VIOLATIONS + 1))
    echo "  ✗ ${f#$PWD/}"
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ $PASSED pass"
  exit 1
fi
echo "VÝSLEDOK: ✓ $PASSED pass"
exit 0
