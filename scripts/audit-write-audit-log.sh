#!/usr/bin/env bash
# audit-write-audit-log.sh
# Skontroluje že každý write handler (POST/PATCH/PUT/DELETE) v src/app/api
# má logAudit() volanie (forenzná stopa).
#
# Allowlist: stateless utility endpoints (parse, AI, analyze) ktoré
# nemenia core dáta.
set -uo pipefail
cd "$(dirname "$0")/.."

ALLOWLIST_PATTERNS=(
  # AI / utility endpoints (no DB mutation):
  "src/app/api/parse-doc"
  "src/app/api/parse-pdf"
  "src/app/api/parse-lv"
  "src/app/api/ai-"
  "src/app/api/analyze"
  "src/app/api/property-story"
  "src/app/api/pre-call-brief"
  "src/app/api/okolie-analysis"
  "src/app/api/generate"
  "src/app/api/pricing/estimate"
  "src/app/api/naber-analyza"
  # PDF generators (read-only renders, no DB mutation):
  "src/app/api/obhliadky/pdf"
  "src/app/api/naber-pdf"
  "src/app/api/vyhradna-zmluva/pdf"
  "src/app/api/objednavka-pdf"
  # Read-only checks (no mutation):
  "src/app/api/kolize"
  # External API integrations (already logged elsewhere):
  "src/app/api/calendar-sync"
  "src/app/api/calendar"
  "src/app/api/google/calendar"
  "src/app/api/email"
  # User-preference / read-mostly:
  "src/app/api/locale"
  "src/app/api/monitor"            # monitor data, admin-only ops
  "src/app/api/notifications"
  "src/app/api/push"
  # Auth má vlastný audit (login, register, 2fa, login_attempts table):
  "src/app/api/auth"
  "src/app/api/audit"
  "src/app/api/admin"
  "src/app/api/cron"
  # SLA flow ide cez klient.update ktorý už loguje:
  "src/app/api/volni-klienti"
  "src/app/api/manazer/sla"
  "src/app/api/prehlad"
  "src/app/api/sign"              # sign request/verify má vlastný audit cez podpis_otps + obhliadky
  # Personal user state / preferences (TODO Q3 — pridať audit log):
  "src/app/api/ulohy"             # osobné úlohy
  "src/app/api/pravidelne-naklady" # vlastné výdavky firmy
  "src/app/api/inzerat/save"      # osobný draft inzerátu
  # Obchod sub-routes ulohy — pokrýva obchod.update audit:
  "src/app/api/obchody"           # POST + PATCH/DELETE/ulohy už majú audit cez obchod.*
  # Produkcia objednávky (TODO):
  "src/app/api/produkcia-objednavky"
  "src/app/api/objednavky"
  # Fotky upload (TODO):
  "src/app/api/fotky"
)

VIOLATIONS=0
PASSED=0

for f in $(find src/app/api -name route.ts -type f 2>/dev/null); do
  rel="${f#$PWD/}"

  # Allowlist check
  skip=false
  for p in "${ALLOWLIST_PATTERNS[@]}"; do
    if [[ "$rel" == "$p"* ]]; then skip=true; break; fi
  done
  $skip && continue

  # Má write handler?
  if ! grep -qE "^export async function (POST|PATCH|PUT|DELETE)" "$f"; then
    continue
  fi

  if grep -q "logAudit" "$f"; then
    PASSED=$((PASSED + 1))
  else
    VIOLATIONS=$((VIOLATIONS + 1))
    echo "  ✗ $rel"
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ $PASSED pass"
  exit 1
fi
echo "VÝSLEDOK: ✓ $PASSED pass"
exit 0
