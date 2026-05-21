# Externé security scany — 2026-05-21

Po nasadení security branch `security/hsts-and-dev-protect` na dev.amgd.sk
(deployment `vianema-97ay95anb-amgd.vercel.app`).

## 1. Header check (curl manual, ekvivalent securityheaders.com)

### dev.amgd.sk (s basic auth: `dev:4meZKJ5w2G7nJ4uoufWi`)

```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload   ✓ NEW
content-security-policy: default-src 'self'; ... frame-src 'self' blob: ... ✓
referrer-policy: strict-origin-when-cross-origin                           ✓
x-content-type-options: nosniff                                            ✓
x-frame-options: SAMEORIGIN                                                ✓
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()   ✓
cross-origin-opener-policy: same-origin                                    ✓
x-robots-tag: noindex, nofollow, nosnippet, noarchive                      ✓
```

**Manuálne grade hodnotenie (podľa securityheaders.com kritérií):**
- HSTS s preload ✓ (+20 bodov)
- CSP s `unsafe-inline` (–5 lebo nie nonce)
- Všetky ostatné headers ✓

**Očakávaný grade: A** (predtým A- bez HSTS)

### dev.amgd.sk (BEZ basic auth)

```
HTTP/2 401
www-authenticate: Basic realm="dev.amgd.sk"
strict-transport-security: max-age=63072000; includeSubDomains; preload
```

Bot scannery dostanú 401 → nemôžu enumerovať endpointy ani exploity testovať.

### vianema.amgd.sk PROD (nedotknutý)

```
HTTP/2 200 (BEZ basic auth — verejne dostupný)
strict-transport-security: max-age=63072000; includeSubDomains; preload   ← už mal HSTS
```

PROD má HSTS pravdepodobne z Vercel default alebo Cloudflare proxy (nie z môjho commitu).
PROD frame-src ešte nemá `blob:` (PDF náhľad bug fix čaká na merge dev → main → prod deploy).

## 2. Exempt paths verifikácia

| Path | Status | Pozn. |
|---|---|---|
| `/api/cron/cleanup` | 200 | Cron jobs prešli — bezpečné lebo majú CRON_SECRET |
| `/api/auth/google/callback` | 307 redirect | OAuth flow funguje — Google redirect prešiel |

## 3. ssllabs.com — manuálny krok

Aleš zatiaľ nespustil. Po vykonaní:
- URL: https://www.ssllabs.com/ssltest/analyze.html?d=dev.amgd.sk
- Očakávaný grade: **A+** (Vercel managed TLS, automatický)

## 4. Mozilla Observatory — manuálny krok

URL: https://developer.mozilla.org/en-US/observatory/analyze?host=dev.amgd.sk
- Očakávané: ~85/100 (CSP s `unsafe-inline` zhadzuje 10–15 bodov)

## Status úloh

| # | Úloha | Status |
|---|---|---|
| 1 | HSTS header | ✅ Hotovo, verifikované |
| 2 | dev.amgd.sk basic auth | ✅ Hotovo, verifikované |
| 3 | Externé skeny | ⏳ Manuálne kroky pre Aleša (securityheaders, ssllabs, observatory) |
| 4 | Nonce-based CSP | ❌ Naplánované do separate session |

## Basic Auth credentials (uchovať bezpečne)

- **Hostname:** `dev.amgd.sk`
- **Username:** `dev`
- **Password:** `4meZKJ5w2G7nJ4uoufWi`
- Uložené v Vercel env `DEV_BASIC_AUTH_PW` projektu `vianema-dev` (Sensitive).
- Pri prvom prístupe na dev.amgd.sk → browser zobrazí popup → username `dev` + password.
- Browser si pamätá do reštartu / vyčistenia cookies.
