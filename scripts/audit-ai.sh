#!/usr/bin/env bash
# Audit: AI nástroje
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: AI nástroje"
echo "   Spustené: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════"

section "Hot files"
for f in src/app/api/ai-writer/route.ts src/app/api/parse-doc/route.ts src/app/api/analyze/route.ts; do
  if [ -f "$f" ]; then ok "$f"; else fail "Chýba: $f"; fi
done

section "API kľúče NIE sú v client kóde"
LEAK=$(grep -rn "ANTHROPIC_API_KEY\|GEMINI_API_KEY\|OPENAI_API_KEY" src/components src/hooks --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "process.env" | wc -l | tr -d ' ')
if [ "$LEAK" = "0" ]; then
  ok "Žiadne AI kľúče v klient komponentoch/hookoch"
else
  fail "$LEAK podozrivých výskytov AI kľúčov v client kóde — leak risk!"
fi

section "parse-doc maxDuration = 300s"
if grep -q "maxDuration.*300\|export const maxDuration = 300" src/app/api/parse-doc/route.ts 2>/dev/null; then
  ok "parse-doc má 300s timeout"
else
  warn "parse-doc maxDuration explicitne nie 300 — Vercel default 60s môže timeoutnúť"
fi

section "Property Story formát check (znaky [The Hook] atď v ai-writer)"
if grep -qE "\\[The Hook\\]|\\[The Lifestyle\\]|\\[Social Snippet\\]" src/app/api/ai-writer/route.ts 2>/dev/null; then
  ok "Property Story formát templovaný v prompte"
else
  warn "ai-writer nezmienuje Property Story 4-časťový formát explicitne"
fi

section "Brand voice blacklist scan"
if grep -qE "vysnívaný|jedinečná príležitosť|exclusive|dream home|must see" src/app/api/ai-writer/ 2>/dev/null; then
  ok "Brand voice blacklist sa kontroluje"
else
  warn "Žiadny blacklist na zakázané frázy — brand voice gap"
fi

section "AI usage tracking (ai_usage_log tabuľka)"
if grep -rln "ai_usage_log" supabase/migrations/ 2>/dev/null | head -1 >/dev/null; then
  ok "ai_usage_log tabuľka existuje (cost tracking)"
else
  warn "ai_usage_log tabuľka CHÝBA — žiadny cost tracking, P1 ticket"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED"; exit 1; }
echo "✅ OK"
exit 0
