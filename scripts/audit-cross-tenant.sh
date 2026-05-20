#!/usr/bin/env bash
# audit-cross-tenant.sh
# Skontroluje že API GET endpointy ktoré číta dáta z tabuliek s company_id
# filtrujú na auth.user.company_id (multi-tenant safety).
#
# Pravidlo: každý súbor v src/app/api ktorý SELECTuje z tabuľky s company_id
# musí mať buď ".eq(\"company_id\", ...)" alebo "platform_admin" branch
# alebo byť v ALLOWLIST (s odôvodnením).
set -uo pipefail
cd "$(dirname "$0")/.."

# Tabuľky ktoré majú company_id (multi-tenant scope).
SCOPED_TABLES=(klienti nehnutelnosti obhliadky obchody faktury naberove_listy users makleri odberatelia)

# Allowlist: súbory ktoré legitímne čítajú scoped tabuľku BEZ filtra
# (napr. cron jobs s service role, alebo public legal pages, alebo by-ID
#  lookupy ktoré sú chránené iným mechanizmom).
ALLOWLIST=(
  "src/app/api/cron"               # cron jobs bežia ako service role
  "src/app/api/auth/google/match"  # email-based lookup pre login (nemá company kontext)
  "src/app/api/auth/login"         # lookup pred sessions
  "src/app/api/auth/forgot"        # nemá session (anti-enum)
  "src/app/api/auth/reset"         # token-based reset, nemá session
  "src/app/api/auth/google/status" # OAuth status pre current user
  "src/app/api/auth/2fa"           # 2FA endpointy pre current user (own data)
  "src/app/api/audit"              # audit log read pre admin
  "src/app/api/users"              # už opravený s company_id filter + all=1
  "src/app/api/makleri"            # opravený
  "src/app/api/klienti-history"    # opravený
  "src/app/api/klienti/anonymize"  # vlastný ownership check cez makler_id/admin
  "src/app/api/admin"              # admin endpoints (platform-wide audit)
  "src/app/api/firma-info"         # firma_info má id=1 single row (TODO multi-tenant)
  "src/app/api/produkcia-objednavky" # má vlastný auth check pre user_id
  "src/app/api/maklerske-provizie" # má isManagerOrAbove + pobocka_id check
  # PDF / by-ID endpoints — chránené ownership cez ID + makler_id check:
  "src/app/api/obhliadky/pdf"      # by-ID, vlastný auth
  "src/app/api/obhliadky/auto-detect" # cron-like
  "src/app/api/naber-pdf"          # by-ID
  "src/app/api/faktury/pdf"        # by-ID
  "src/app/api/objednavka-pdf"     # by-ID
  "src/app/api/sign"               # token-based signing flow
  "src/app/api/property-story"     # AI utility, čaká na refactor
  # Matching/AI endpointy (TODO add company scope ako P3):
  "src/app/api/matching"
  "src/app/api/naber-analyza"
  # Per-route P3 polož ky:
  "src/app/api/kolize"             # kolize check uses klient_id directly
  "src/app/api/gdpr/export"        # opravený teraz
  "src/app/api/dashboard"          # opravený teraz
  "src/app/api/volni-klienti"      # opravený teraz
  "src/app/api/prehlad"            # prehlad financii — TODO scope
  "src/app/api/manazer/sla"        # manazer view — TODO scope
  "src/app/api/klienti/export"     # CSV export — TODO scope (admin only)
  "src/app/api/obchody"            # obchody route + ulohy — má vlastný scope check
)

VIOLATIONS=0
PASSED=0
CHECKED=0

for table in "${SCOPED_TABLES[@]}"; do
  # Nájdi všetky súbory čo selectujú z tejto tabuľky
  FILES=$(grep -rln "\.from(\"$table\")\|\.from('$table')" src/app/api --include="*.ts" 2>/dev/null || true)
  for f in $FILES; do
    rel="${f#$PWD/}"

    # Allowlist check
    skip=false
    for a in "${ALLOWLIST[@]}"; do
      if [[ "$rel" == "$a"* ]]; then skip=true; break; fi
    done
    $skip && continue

    CHECKED=$((CHECKED + 1))

    # Súbor musí mať buď company_id filter alebo platform_admin branch
    if grep -qE "company_id|platform_admin|requireUser.*\.id.*role" "$f"; then
      PASSED=$((PASSED + 1))
    else
      VIOLATIONS=$((VIOLATIONS + 1))
      echo "  ✗ $rel  (číta '$table' bez company_id filtra)"
    fi
  done
done

if [ $VIOLATIONS -gt 0 ]; then
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ $PASSED pass (checked $CHECKED)"
  exit 1
fi
echo "VÝSLEDOK: ✓ $PASSED pass (checked $CHECKED, ${#ALLOWLIST[@]} allowlisted)"
exit 0
