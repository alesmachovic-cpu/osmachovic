#!/usr/bin/env bash
# Audit: DevOps & Infrastructure
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: DevOps & Infrastructure"
echo "═══════════════════════════════════════════════"

section "Sensitive .env súbory NIE sú git tracked"
TRACKED=$(git ls-files | grep -cE "^\.env\.local$|^\.env\.local\.prod$|^\.env\.local\.dev$|^\.env\.production" 2>/dev/null || echo "0")
if [ "$TRACKED" = "0" ]; then
  ok "Žiadne .env.local* git tracked"
else
  fail "$TRACKED .env súborov GIT TRACKED — leak risk!"
fi

section ".gitignore obsahuje .env"
if grep -q "\.env\.local\|\.env\.production" .gitignore 2>/dev/null; then
  ok ".env vzory v .gitignore"
else
  fail ".gitignore NEignoruje .env súbory"
fi

section "Vercel cron schedules (8 očakávaných)"
if [ -f vercel.json ]; then
  CRONS=$(python3 -c "import json; d=json.load(open('vercel.json')); print(len(d.get('crons',[])))")
  if [ "$CRONS" -ge 8 ]; then
    ok "$CRONS cronov v vercel.json"
  else
    warn "Iba $CRONS cronov (očakávané 8)"
  fi
fi

section "Vercel projects (CLI access)"
if command -v vercel >/dev/null 2>&1; then
  PROJECTS=$(vercel project ls 2>/dev/null | grep -cE "vianema|funny-stonebraker" 2>/dev/null | tr -d ' \n')
  PROJECTS=${PROJECTS:-0}
  if [ "$PROJECTS" -ge 2 ] 2>/dev/null; then
    ok "$PROJECTS Vercel projektov dostupných (funny-stonebraker + vianema-dev)"
  else
    warn "Iba $PROJECTS Vercel projektov nájdených — over CLI auth"
  fi
fi

section "Posledný úspešný deploy < 7 dní (funny-stonebraker)"
if command -v vercel >/dev/null 2>&1; then
  AGE=$(vercel ls funny-stonebraker 2>/dev/null | grep "Ready" | head -1 | awk '{print $1}')
  if [ -n "$AGE" ]; then
    case "$AGE" in
      *m|*h|*d)
        # Check if d > 7
        if echo "$AGE" | grep -q "d"; then
          DAYS=$(echo "$AGE" | sed 's/d//')
          if [ "$DAYS" -le 7 ]; then
            ok "Posledný úspešný deploy: $AGE (healthy)"
          else
            warn "Posledný úspešný deploy: $AGE (>7d, možno nikto nepushuje)"
          fi
        else
          ok "Posledný úspešný deploy: $AGE (recent)"
        fi
        ;;
    esac
  fi
fi

section "TS check pred deploy (manuálne — alebo CI)"
if [ -f .github/workflows/ci.yml ] || [ -f .github/workflows/test.yml ]; then
  ok "GitHub Actions CI konfigurované"
else
  warn "Žiadne GitHub Actions = žiadny test gate pred merge"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED"; exit 1; }
echo "✅ OK"
exit 0
