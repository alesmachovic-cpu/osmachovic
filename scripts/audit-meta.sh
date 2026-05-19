#!/usr/bin/env bash
# Audit: META — Inspector General (audit nad auditormi)
# Sleduje či 22 zamestnancov reálne robí svoju prácu cez sledovanie artefaktov.
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   META AUDIT (Inspector General, E023)"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

NOW=$(date +%s)
DAY=86400
WEEK=$((7*DAY))
MONTH=$((30*DAY))
QUARTER=$((90*DAY))

section "1) Audit script freshness (kedy boli naposledy modified)"
STALE_AUDITS=0
for script in scripts/audit-*.sh; do
  [ ! -f "$script" ] && continue
  MTIME=$(stat -f %m "$script" 2>/dev/null || stat -c %Y "$script" 2>/dev/null)
  AGE_DAYS=$(( (NOW - MTIME) / DAY ))
  NAME=$(basename "$script")
  if [ "$AGE_DAYS" -gt 30 ]; then
    fail "$NAME: posledná úprava pred $AGE_DAYS dňami — owner nezasahuje?"
    STALE_AUDITS=$((STALE_AUDITS+1))
  elif [ "$AGE_DAYS" -gt 14 ]; then
    warn "$NAME: pred $AGE_DAYS dňami (>14d, sleduj)"
  fi
done
[ "$STALE_AUDITS" = "0" ] && ok "Všetky audit scripty modified < 30 dní"

section "2) Memory file freshness"
STALE_MEM=0
for mem in memory/*.md; do
  [ ! -f "$mem" ] && continue
  MTIME=$(stat -f %m "$mem" 2>/dev/null || stat -c %Y "$mem" 2>/dev/null)
  AGE_DAYS=$(( (NOW - MTIME) / DAY ))
  NAME=$(basename "$mem")
  if [ "$AGE_DAYS" -gt 90 ]; then
    fail "$NAME: pred $AGE_DAYS dňami — memory rot, owner nezaznamenáva"
    STALE_MEM=$((STALE_MEM+1))
  elif [ "$AGE_DAYS" -gt 60 ]; then
    warn "$NAME: pred $AGE_DAYS dňami (>60d, soon refresh)"
  fi
done
[ "$STALE_MEM" = "0" ] && ok "Všetky memory files updated < 90 dní"

section "3) Memory files majú History sekciu"
NO_HISTORY=0
for mem in memory/domain-*.md memory/role-*.md; do
  [ ! -f "$mem" ] && continue
  if ! grep -qE "^## (História|History|## Historié)" "$mem"; then
    warn "$(basename "$mem"): chýba ## História sekcia"
    NO_HISTORY=$((NO_HISTORY+1))
  fi
done
[ "$NO_HISTORY" = "0" ] && ok "Všetky memory files majú History sekciu"

section "4) TODO inflation tracking"
TOTAL_TODOS=$(grep -rh "^- \[ \]" memory/ 2>/dev/null | wc -l | tr -d ' \n')
P0_COUNT=$(grep -rhE "^- \[ \].*P0" memory/ 2>/dev/null | wc -l | tr -d ' \n')
P1_COUNT=$(grep -rhE "^- \[ \].*P1" memory/ 2>/dev/null | wc -l | tr -d ' \n')
TOTAL_TODOS=${TOTAL_TODOS:-0}
P0_COUNT=${P0_COUNT:-0}
P1_COUNT=${P1_COUNT:-0}
echo "  Celkový open TODO count: $TOTAL_TODOS"
echo "  Z toho P0: $P0_COUNT, P1: $P1_COUNT"
if [ "$P0_COUNT" -gt 10 ]; then
  fail "P0 tickets > 10 (aktuálne $P0_COUNT) — preťaženie, riešiť"
elif [ "$P0_COUNT" -gt 5 ]; then
  warn "P0 tickets: $P0_COUNT — pozorne sledovať"
else
  ok "P0 tickets: $P0_COUNT (zdravé)"
fi

section "5) Subagent definícií pre každú memory rolu"
MEM_COUNT=$(ls memory/ 2>/dev/null | wc -l | tr -d ' ')
AGENT_COUNT=$(ls .claude/agents/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$AGENT_COUNT" -ge "$MEM_COUNT" ]; then
  ok "Agent definícií: $AGENT_COUNT (memory files: $MEM_COUNT) — coverage OK"
else
  warn "Memory files: $MEM_COUNT, agents: $AGENT_COUNT — chýbajúce agent definície"
fi

section "6) Excel org chart up-to-date"
if [ -f vianema-engineering-org.xlsx ]; then
  MTIME=$(stat -f %m vianema-engineering-org.xlsx 2>/dev/null || stat -c %Y vianema-engineering-org.xlsx 2>/dev/null)
  AGE_DAYS=$(( (NOW - MTIME) / DAY ))
  if [ "$AGE_DAYS" -le 30 ]; then
    ok "Excel org chart aktualizovaný pred $AGE_DAYS dňami"
  elif [ "$AGE_DAYS" -le 90 ]; then
    warn "Excel org chart: $AGE_DAYS dní — overiť či sedí so skutočným stavom"
  else
    fail "Excel org chart: $AGE_DAYS dní — určite outdated"
  fi
else
  fail "Excel org chart neexistuje"
fi

section "7) Domain audit failures aggregate (top concerns)"
echo "  (spusti všetky audit-*.sh manuálne pre detailný stav)"
echo "  Indikátory pretrvávajúcich fail:"
PERSISTENT_FAILS=("audit log 6%" "anon RLS USING(true)" "Monitor scrape mŕtve")
for issue in "${PERSISTENT_FAILS[@]}"; do
  echo "    • $issue (tracked v memory)"
done

echo ""
echo "═══════════════════════════════════════════════"
echo "META VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
if [ "$FAIL" -gt 0 ]; then
  echo "❌ META AUDIT FAILED — kontrolný proces sám má dieru"
  exit 1
fi
[ "$WARN" -gt 0 ] && echo "⚠ Niektoré indikátory rotu — sleduj v týždennom reporte"
echo "✅ Kontrolný proces zdravý"
exit 0
