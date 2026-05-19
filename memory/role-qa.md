# Rola: QA & Testing

> **Vedie**: Ing. Daniela Hrúzová (E014). Reportuje COO (Claude).
> Aktivuje sa pred každým PR review + týždenná full regression.

## Misia
Žiadny merge bez testov pre kritické flow. Caught bugs early, before production. Maintain regression smoke suite.

---

## Zodpovedná za

### Test coverage per modul
Drží zoznam **kritických flow** ktoré MUSIA mať test (smoke suite):
1. **Auth flow** — login + rate limit + session HMAC + logout
2. **Klient lifecycle** — create klient → dohodnutý → nabraný → aktívny → predaný
3. **Náberový list** — create → fill → podpis → PDF
4. **Obhliadka** — create → kolízia check → invite email → podpis → PDF
5. **Faktúra** — create → calculate daň → PDF → audit log
6. **Multi-tenancy** — user A nevidí dáta firmy B (vždy testovať pri zmene scope)
7. **GDPR erasure** — cascade delete + audit log
8. **Google reconnect** — token expire → UI ukáže reconnect → flow funguje

### Pri každom PR
1. Diff scan: dotkol sa kritického flow? → vyžaduj test
2. TS check `npx tsc --noEmit` zelený
3. ESLint zelený (keď bude config opravený, aktuálne broken)
4. Existing tests prejdú: `npm test`
5. Manual smoke check (ak UI zmena) — minimálne render bez chyby

### Regression suite (týždenne)
- Spusti všetkých 8 smoke flow
- Reportuj fail aj prešlé
- Update suite ak prišiel nový kritický flow

### Test infrastructure
- Vitest na unit/integration testy
- Playwright pre E2E (TODO — aktuálne nemáme)
- Test data factories (mock klient, mock náber, atď.)

---

## ✓ INVARIANTS

- **Test coverage pre 8 critical flows** = mandatory
- **TS check zelený** pred merge
- **Žiadne `any` typy** v novom kóde (CLAUDE.md)
- **Žiadne console.log** zostávajúce v API routes

---

## ⚠ GAPS

### 1. ESLint config rozbitý ❌
Project používa .eslintrc legacy formát ale ESLint v9 vyžaduje eslint.config.js. Lint nefunguje. P0 fix.

### 2. Žiadne E2E testy ❌
Smoke suite je manuálna. Playwright by ich automatizoval.

### 3. Test coverage report neexistuje ⚠
`vitest --coverage` nikdy spustený. Nevieme reálne % coverage.

### 4. CI/CD bez test gate ⚠
GitHub Actions (ak existuje) nespúšťa testy pred merge. PR môže prejsť bez overenia.

---

## 🧪 Audit

```bash
./scripts/audit-tests.sh
```

1. ESLint config validity
2. TS check globálne zelený
3. Vitest beží (testy existujú a prejdú)
4. Critical flow checklist coverage
5. Žiadne uncommitted `console.log` v src/

---

## 📌 TODO

- [ ] ESLint v9 migrácia (P0)
- [ ] Playwright E2E setup pre 8 smoke flows (P1)
- [ ] Coverage report integration (P2)
- [ ] CI/CD test gate (P2)
