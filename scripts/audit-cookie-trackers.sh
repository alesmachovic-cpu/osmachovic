#!/usr/bin/env bash
# audit-cookie-trackers.sh (G23)
# Zabráni tichému pridaniu analytického/marketingového trackera BEZ cookie
# súhlasu. GDPR/ePrivacy: tracker smie bežať len po súhlase (CookieConsent).
#
# Pravidlo: ak sa v src/ objaví známy tracker (gtag/GA/fbq/posthog/plausible/
# hotjar/mixpanel/clarity), CookieConsent musí mať SHOW_BANNER = true (inak
# tracker beží bez možnosti súhlas odmietnuť).
set -uo pipefail
cd "$(dirname "$0")/.."

TRACKERS='googletagmanager|gtag\(|google-analytics|\bfbq\(|connect\.facebook\.net|posthog|plausible\.io|static\.hotjar|mixpanel|clarity\.ms'

# Hľadaj reálne trackery (ignoruj CookieConsent/consent lib a komentáre o nich).
HITS=$(grep -rEn "$TRACKERS" src --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -viE "audit-cookie|consent\.ts|CookieConsent|// |/\*|no analytics|žiadne anal" || true)

if [ -z "$HITS" ]; then
  echo "✓ Žiadne analytické/marketingové trackery — cookie súhlas netreba vynucovať."
  exit 0
fi

echo "Našiel som možný tracker:"
echo "$HITS"

# Tracker existuje → CookieConsent musí mať SHOW_BANNER = true.
if grep -qE "SHOW_BANNER\s*=\s*true" src/components/CookieConsent.tsx 2>/dev/null; then
  echo "✓ Tracker existuje a cookie banner je zapnutý (SHOW_BANNER = true)."
  echo "  POZOR: over že tracker je zabalený v hasConsent('analytics'|'marketing')."
  exit 0
else
  echo "✗ FAIL — tracker existuje, ale CookieConsent.SHOW_BANNER nie je true."
  echo "  Pridaj cookie banner (SHOW_BANNER=true) + zabaľ tracker do hasConsent()."
  exit 1
fi
