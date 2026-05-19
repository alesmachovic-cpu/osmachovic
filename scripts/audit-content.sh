#!/usr/bin/env bash
# Audit: Brand & Marketing (Content)
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: Brand & Marketing"
echo "═══════════════════════════════════════════════"

section "Blacklist frázy v UI / AI Writer"
BLACKLIST=("vysnívaný domov" "jedinečná príležitosť" "must see" "neopakovateľná" "raj na zemi" "dream home")
HITS=0
for phrase in "${BLACKLIST[@]}"; do
  COUNT=$(grep -rln "$phrase" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 0 ]; then
    fail "Blacklist fráza '$phrase' nájdená v $COUNT súboroch"
    HITS=$((HITS+1))
  fi
done
[ "$HITS" = "0" ] && ok "Žiadne blacklist frázy v UI/code"

section "Property Story formát check"
if grep -qE "\\[The Hook\\]|\\[The Lifestyle\\]" src/app/api/ai-writer/route.ts 2>/dev/null; then
  ok "Property Story formát templovaný"
else
  warn "Property Story 4-časťový formát neexplicitne v ai-writer prompte"
fi

section "Slovenský pravopis — vzorka diacritics check"
# Sample: vyhľadaj zlé substring (príklad: 'pokus' vs 'pokuš')
SK_WORDS_COUNT=$(grep -rlEi "(klient|nehnutel|náber|obhliad|maklér)" src/components --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$SK_WORDS_COUNT" -gt 0 ]; then
  ok "SK doménová terminológia v UI komponentoch ($SK_WORDS_COUNT súborov)"
else
  warn "Žiadne SK doménové slová detekované — možno anglické UI"
fi

section "Emoji v Property Stories (mali by len v Social Snippet)"
EMOJI_API=$(grep -rln "emoji\|emojis" src/app/api/ai-writer 2>/dev/null | wc -l | tr -d ' ')
if [ "$EMOJI_API" -gt 0 ]; then
  ok "AI Writer riadi emoji usage"
fi

section "Error messages — sú konkrétne?"
GENERIC=$(grep -rlnE "['\"]Chyba['\"]|['\"]Error['\"]|['\"]Niečo sa pokazilo['\"]" src/app/api --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$GENERIC" -lt 5 ]; then
  ok "Iba $GENERIC routes má generic error messages (target: 0)"
else
  warn "$GENERIC routes má generic error messages — pridať konkrétny kontext"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ Brand violation"; exit 1; }
echo "✅ OK"
exit 0
