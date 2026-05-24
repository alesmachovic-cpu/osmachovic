# VIANEMA Playwright UX walker

Týždenný headless prechod cez reálne UI. Doplnok k dennému API-only QA smoke.

## Kedy beží
- **GitHub Actions**: Pondelok 5:00 UTC (= 7:00 Bratislava)
- **Manuálne**: workflow_dispatch v GitHub Actions UI
- **Lokálne**: viď nižšie

## Lokálny beh

```bash
# Inštalácia (lokálne — NEPRIDÁVA sa do package.json)
npm install --no-save @playwright/test@1.50.0
npx playwright install chromium

# Spustenie proti dev.amgd.sk (default)
BASE_URL=https://dev.amgd.sk npx playwright test --config tests/playwright/playwright.config.ts

# Spustenie proti localhost
BASE_URL=http://localhost:3000 npx playwright test --config tests/playwright/playwright.config.ts

# Authenticated walk (vyžaduje test účet)
UX_USER=test@example.com UX_PASS=xxx npx playwright test --config tests/playwright/playwright.config.ts
```

## GitHub Actions secrets

Pridať v repo Settings → Secrets:

| Secret | Účel |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Default `https://dev.amgd.sk` (optional) |
| `PLAYWRIGHT_USER` | Test účet meno/email (pre authenticated walk) |
| `PLAYWRIGHT_PASS` | Test účet heslo |
| `TELEGRAM_BOT_TOKEN` | Pre alert pri fail (rovnaký ako daily-audit) |
| `TELEGRAM_CHAT_ID` | Chat ID kde sa pošle alert |

Ak `PLAYWRIGHT_USER` / `PLAYWRIGHT_PASS` nie sú nastavené, authenticated walk
sa preskočí (test.skip) a beží len public smoke.

## Čo pokrýva

1. **Login screen renders** — UI sa zobrazí
2. **Klienti list** — sidebar navigation funguje
3. **Portfolio + Faktúry + Nastavenia** — žiadne 500 error
4. **Public legal pages** — GDPR, cookies, podmienky, AML poučenie (5 stránok)
5. **Smoke endpoints** — `/manifest.json`, `/api/firma-info`

## Čo NEROBÍ

- Žiadne destructive operácie (DELETE klient, faktúra, ...)
- Žiadne reálne emaily / SMS
- Žiadne payment flows
