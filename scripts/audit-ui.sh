#!/usr/bin/env bash
# Audit: UX / Visual Designer
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; WARN=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "─── $1 ───"; }

echo "═══════════════════════════════════════════════"
echo "   AUDIT: UX / Visual Designer"
echo "═══════════════════════════════════════════════"

section "A11y — <input> bez label"
INPUTS_NO_LABEL=$(grep -rn "<input" src/components src/app --include="*.tsx" 2>/dev/null | grep -v "aria-label\|<label" | wc -l | tr -d ' ')
if [ "$INPUTS_NO_LABEL" -lt 10 ]; then
  ok "Inputs bez label/aria: $INPUTS_NO_LABEL (akceptovateľne)"
else
  warn "Inputs bez label/aria: $INPUTS_NO_LABEL — a11y gap"
fi

section "A11y — <img> bez alt"
IMG_NO_ALT=$(grep -rn "<img" src/components src/app --include="*.tsx" 2>/dev/null | grep -v "alt=" | wc -l | tr -d ' ')
if [ "$IMG_NO_ALT" = "0" ]; then
  ok "Všetky <img> majú alt"
else
  warn "$IMG_NO_ALT <img> bez alt — screen reader fail"
fi

section "Hardcoded farby (mali by byť CSS vars)"
HARDCODED=$(grep -rnE "color:[[:space:]]*[\"']?#[0-9a-fA-F]{3,6}" src/components --include="*.tsx" 2>/dev/null | grep -v "var(--" | wc -l | tr -d ' ')
if [ "$HARDCODED" -lt 30 ]; then
  ok "Hardcoded color hodnoty: $HARDCODED (akceptovateľne)"
else
  warn "$HARDCODED hardcoded color hodnôt — refaktor na CSS vars"
fi

section "CSS premenné v globals.css"
if grep -q "\-\-bg-base\|\-\-text-primary\|\-\-accent" src/app/globals.css 2>/dev/null; then
  ok "globals.css definuje design tokens"
else
  warn "globals.css nemá design tokens"
fi

section "Dark mode CSS premenné"
if grep -q "data-theme.*dark\|prefers-color-scheme.*dark" src/app/globals.css 2>/dev/null; then
  ok "Dark mode CSS premenné definované"
else
  warn "Dark mode CSS premenné chýbajú"
fi

section "Tailwind v projekte"
if [ -f tailwind.config.ts ] || [ -f tailwind.config.js ]; then
  ok "Tailwind config existuje"
fi

section "Inline styles dominancia (TODO refaktor)"
INLINE=$(grep -rln "style={{" src/components --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$INLINE" -gt 30 ]; then
  warn "$INLINE komponentov používa inline style — long-term refaktor na CSS modules"
fi

section "Focus visible CSS"
if grep -qE "focus-visible|outline" src/app/globals.css 2>/dev/null; then
  ok "Focus styles definované"
else
  warn "Focus styles nie definované — keyboard nav nie viditeľná"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "VÝSLEDOK: ✓ $PASS pass | ⚠ $WARN warn | ✗ $FAIL fail"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "❌ FAILED"; exit 1; }
echo "✅ OK"
exit 0
