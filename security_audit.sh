#!/usr/bin/env bash
# =============================================================================
# VIANEMA / AMGD — Security & GDPR Audit Script
# Použitie: bash security_audit.sh https://vianema.amgd.sk
# Vyžaduje: curl, jq (voliteľné pre farebný JSON výstup)
# =============================================================================

TARGET="${1:-https://vianema.amgd.sk}"
BASE="${TARGET%/}"
PASS="✅"
FAIL="❌"
WARN="⚠️ "
SEP="─────────────────────────────────────────────"

# Farby
RED='\033[0;31m'; ORANGE='\033[0;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

header() { echo -e "\n${BOLD}${BLUE}$1${RESET}\n${SEP}"; }
ok()     { echo -e "  ${GREEN}${PASS} $1${RESET}"; }
fail()   { echo -e "  ${RED}${FAIL} $1${RESET}"; }
warn()   { echo -e "  ${ORANGE}${WARN}$1${RESET}"; }
info()   { echo -e "       $1"; }

echo -e "\n${BOLD}════════════════════════════════════════════"
echo -e "  Security & GDPR Audit: ${TARGET}"
echo -e "  Dátum: $(date '+%d.%m.%Y %H:%M')"
echo -e "════════════════════════════════════════════${RESET}"

# =============================================================================
# 1. HTTPS / TLS
# =============================================================================
header "1. HTTPS / TLS"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}/")
if [[ "${BASE}" == https://* ]]; then
  ok "HTTPS je aktívne"
else
  fail "HTTPS nie je aktívne — kritické!"
fi

REDIRECT=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "http://${BASE#https://}/")
if [[ "$REDIRECT" == https://* ]]; then
  ok "HTTP → HTTPS redirect funguje"
else
  warn "HTTP → HTTPS redirect nebol potvrdený"
fi

# =============================================================================
# 2. HTTP SECURITY HEADERS
# =============================================================================
header "2. HTTP Security Headers"

HEADERS=$(curl -sI --max-time 10 "${BASE}/")

check_header() {
  local name="$1"
  local value=$(echo "$HEADERS" | grep -i "^${name}:" | head -1)
  if [[ -n "$value" ]]; then
    ok "${name}"
    info "${value}"
  else
    fail "${name} — CHÝBA"
  fi
}

check_header "Strict-Transport-Security"
check_header "Content-Security-Policy"
check_header "X-Frame-Options"
check_header "X-Content-Type-Options"
check_header "Referrer-Policy"
check_header "Permissions-Policy"

SERVER=$(echo "$HEADERS" | grep -i "^server:" | head -1)
if [[ -n "$SERVER" ]]; then
  warn "Server header exposes version info: ${SERVER}"
fi

# =============================================================================
# 3. AUTENTIFIKÁCIA API ENDPOINTOV
# =============================================================================
header "3. API Endpoints — ochrana bez prihlásenia"

check_api() {
  local endpoint="$1"
  local desc="$2"
  local code=$(curl -s -o /tmp/api_resp.txt -w "%{http_code}" --max-time 10 "${BASE}${endpoint}")
  local size=$(wc -c < /tmp/api_resp.txt | tr -d ' ')
  local preview=$(cat /tmp/api_resp.txt | head -c 120 2>/dev/null)

  if [[ "$code" == "401" || "$code" == "403" ]]; then
    ok "${endpoint} → ${code} (správne chránené)"
  elif [[ "$code" == "200" ]]; then
    fail "${endpoint} → ${code} VEREJNE PRÍSTUPNÉ! (${size} bytes)"
    info "Preview: ${preview}"
  elif [[ "$code" == "302" || "$code" == "301" ]]; then
    ok "${endpoint} → ${code} (redirect — pravdepodobne chránené)"
  else
    warn "${endpoint} → ${code} (${desc})"
  fi
}

check_api "/api/users"       "Zoznam používateľov"
check_api "/api/clients"     "Klienti"
check_api "/api/properties"  "Nehnuteľnosti"
check_api "/api/invoices"    "Faktúry"
check_api "/api/stats"       "Štatistiky"
check_api "/api/settings"    "Nastavenia"
check_api "/api/admin"       "Admin"
check_api "/api/health"      "Health check"

# =============================================================================
# 4. GDPR / PRÁVNE STRÁNKY
# =============================================================================
header "4. GDPR & Právne stránky (verejne prístupné)"

check_page() {
  local path="$1"
  local desc="$2"
  local code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 "${BASE}${path}")
  local final=$(curl -s -o /dev/null -w "%{url_effective}" -L --max-time 10 "${BASE}${path}")

  if [[ "$code" == "200" && "$final" == *"${path}"* ]]; then
    ok "${desc} (${path}) → dostupné"
  elif [[ "$code" == "200" ]]; then
    warn "${desc} (${path}) → redirect na ${final}"
  else
    fail "${desc} (${path}) → ${code} — CHÝBA"
  fi
}

check_page "/gdpr"                    "GDPR / Ochrana údajov"
check_page "/cookies"                 "Cookie Policy"
check_page "/obchodne-podmienky"      "Obchodné podmienky"
check_page "/podmienky-pouzitia"      "Podmienky používania"
check_page "/reklamacny-poriadok"     "Reklamačný poriadok"
check_page "/aml-poucenie"            "AML poučenie"
check_page "/eticky-kodex"            "Etický kódex"
check_page "/kontakt"                 "Kontaktná stránka"
check_page "/o-nas"                   "O nás"
check_page "/bezpecnost"              "Bezpečnosť"
check_page "/.well-known/security.txt" "security.txt (RFC 9116)"

# =============================================================================
# 5. COOKIE / TRACKING ANALÝZA
# =============================================================================
header "5. Cookies & Tracking"

COOKIES=$(curl -sc /tmp/cookies.txt -o /dev/null --max-time 10 "${BASE}/" 2>/dev/null && cat /tmp/cookies.txt)
BODY=$(curl -s --max-time 15 "${BASE}/")

if echo "$COOKIES" | grep -qi "session\|auth\|token\|jwt"; then
  warn "Session/auth cookies nastavené — overiť Secure a HttpOnly flagy"
else
  ok "Žiadne session cookies pri prvom načítaní"
fi

if echo "$BODY" | grep -qi "google-analytics\|gtag\|ga\.js"; then
  warn "Google Analytics detekovaný"
else
  ok "Google Analytics — NEDETEKOVANÝ"
fi

if echo "$BODY" | grep -qi "hotjar\|hjid"; then
  warn "Hotjar detekovaný"
else
  ok "Hotjar — NEDETEKOVANÝ"
fi

if echo "$BODY" | grep -qi "fbq\|facebook\.net\|connect\.facebook"; then
  warn "Facebook Pixel detekovaný"
else
  ok "Facebook Pixel — NEDETEKOVANÝ"
fi

if echo "$BODY" | grep -qi "turnstile\|cloudflare"; then
  warn "Cloudflare Turnstile (3rd party script) — vyžaduje cookie consent"
else
  ok "Cloudflare Turnstile — nedetekovaný"
fi

if echo "$BODY" | grep -qi "cookie.*consent\|gdpr.*banner\|cookie.*banner\|cookiebot\|onetrust"; then
  ok "Cookie consent mechanizmus detekovaný"
else
  fail "Cookie Consent Banner — CHÝBA (porušenie zákona č. 452/2021)"
fi

# =============================================================================
# 6. REGISTRAČNÁ STRÁNKA
# =============================================================================
header "6. Registračná stránka — GDPR povinnosti"

REG_BODY=$(curl -s --max-time 15 -L "${BASE}/registracia")

if echo "$REG_BODY" | grep -qi "privacy\|ochrana\|gdpr\|súhlas\|súhlasím"; then
  ok "Odkaz na Privacy Policy / súhlas pri registrácii"
else
  fail "Chýba odkaz na Privacy Policy / súhlas pred registráciou (porušenie GDPR čl. 13)"
fi

if echo "$REG_BODY" | grep -qi "podmienk\|terms\|obchodn"; then
  ok "Odkaz na obchodné podmienky pri registrácii"
else
  fail "Chýbajú obchodné podmienky pri registrácii (porušenie zákona č. 108/2024)"
fi

if echo "$REG_BODY" | grep -qi "14.*dní\|30.*dní\|odstúpi\|zrušeni"; then
  ok "Informácia o lehote na odstúpenie od zmluvy"
else
  warn "Chýba informácia o 30-dňovej lehote odstúpenia (zákon č. 108/2024)"
fi

# =============================================================================
# 7. BEZPEČNOSŤ AUTENTIFIKÁCIE
# =============================================================================
header "7. Prihlásenie — bezpečnostné kontroly"

LOGIN_HEADERS=$(curl -sI --max-time 10 "${BASE}/")

if echo "$LOGIN_HEADERS" | grep -qi "x-frame-options: DENY\|x-frame-options: SAMEORIGIN"; then
  ok "Clickjacking ochrana (X-Frame-Options)"
else
  warn "X-Frame-Options nie je nastavené — riziko clickjackingu na login stránke"
fi

TURNSTILE=$(echo "$BODY" | grep -c "turnstile" || true)
if [[ "$TURNSTILE" -gt 0 ]]; then
  ok "Bot ochrana (Cloudflare Turnstile) na login forme"
else
  warn "Bot ochrana na login forme — nepotvrdená"
fi

# =============================================================================
# 8. npm AUDIT (ak je dostupný lokálny projekt)
# =============================================================================
header "8. npm audit (lokálny projekt)"

if command -v npm &>/dev/null && [[ -f "package.json" ]]; then
  echo "  Spúšťam npm audit..."
  npm audit --json 2>/dev/null | \
    python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  vulns = data.get('metadata', {}).get('vulnerabilities', {})
  total = sum(vulns.values())
  print(f'  Celkovo zraniteľností: {total}')
  for sev, count in vulns.items():
      if count > 0:
          marker = '❌' if sev in ['critical','high'] else '⚠️ '
          print(f'  {marker} {sev}: {count}')
  if total == 0:
      print('  ✅ Žiadne zraniteľnosti v závislostiach')
except:
  print('  ⚠️  Nepodarilo sa parsovať npm audit výstup')
" 2>/dev/null || npm audit 2>&1 | tail -20
else
  warn "npm / package.json nedostupné v aktuálnom adresári — spusti manuálne v projekte"
fi

# =============================================================================
# ZÁVEREČNÝ REPORT
# =============================================================================
header "ZÁVEREČNÝ PREHĽAD"

echo ""
echo -e "  ${BOLD}Legislatíva, ktorú treba dodržať:${RESET}"
echo "  • GDPR (EU 2016/679) — základný rámec"
echo "  • Zákon č. 18/2018 Z.z. — SK implementácia GDPR"
echo "  • Zákon č. 452/2021 Z.z. — cookies (opt-in povinný)"
echo "  • Zákon č. 297/2008 + 387/2024 Z.z. — AML (od 15.1.2025)"
echo "  • Zákon č. 108/2024 Z.z. — ochrana spotrebiteľa (od 1.7.2024)"
echo ""
echo -e "  ${BOLD}Prioritné kroky:${RESET}"
echo "  🔴 1. Zablokovať /api/users bez autentifikácie — DNES"
echo "  🟠 2. npm audit fix + oprava TypeScript errorov — do 7 dní"
echo "  🟠 3. Privacy Policy + Cookie Banner + VOP — do 14 dní"
echo "  🟠 4. Security Headers (next.config.js) — do 14 dní"
echo "  🟠 5. DPA zmluva s AMGD + AML program — do 30 dní"
echo ""
echo -e "${BOLD}${SEP}${RESET}"
echo -e "  Audit dokončený: $(date '+%d.%m.%Y %H:%M')"
echo -e "${BOLD}${SEP}${RESET}"

# Cleanup
rm -f /tmp/api_resp.txt /tmp/cookies.txt
