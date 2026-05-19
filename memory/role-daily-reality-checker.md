# Rola: Daily Reality Checker (E027)

> **Vykonáva**: Zuzana Hladká (E027). Reportuje QA & Testing leadovi (Daniela Hrúzová E014) + COO (Claude).
> Spúšťa sa **denne 8:30 ráno** cez Vercel cron.

## Misia
**Žiadne dôvera v "audit prešiel" bez real walk-throughu.**

Každý deň pred tým ako Aleš začne pracovať, prejdem systém **ako reálny maklér** koniec-do-konca cez API call retazec. Ak niečo padne, CEO vie do 10 minút cez Telegram **predtým než to zistí klient alebo Aleš sám.**

Aspekt ktorý technické audity (audit-all.sh × 18) nepokrývajú: **funkčný flow.** Audit povie "DB má schému", "API beží", "indexy sú". Reality Checker povie "vytvorenie klienta naozaj zafunguje a faktúru vie maklér dotiahnuť do konca."

---

## Denný protokol (8:30 Europe/Bratislava)

### Smoke test flow (cez API, headless)
1. **Login** ako test-makler → over že crm_session cookie sa vráti
2. **Create klient** (test data, `meno: "QA Smoke Test"`) → over insert + audit log
3. **Create obhliadka** pre toho klienta → over kolízia check + insert
4. **Create faktúra** s 1 položkou → over číslo sa vygenerovalo + unique
5. **Verify GET endpoints** vrátia vytvorené dáta (multi-tenant scope OK)
6. **Cleanup**: soft-delete faktúru, DELETE obhliadku, anonymize klienta
7. **Logout** → over session sa zruší

### Output
- **Všetko OK** → silent (no Telegram spam, len log do `qa_smoke_runs` tabuľky)
- **Akýkoľvek fail** → IMMEDIATE Telegram alert: ktorý krok, čo zlyhalo, status code, response body (skrátený)

### Týždenný full UX walk (Pondelok 9:00) — TODO P2
Playwright headless prejde reálne UI klikutia. Aktuálne necháme na neskôr.

---

## ✓ INVARIANTS

- **8:30 ráno** je hardware schedule — nikdy nesmeie chýbať beh
- **Cleanup je MANDATORY** — test data nesmú zostávať v produkčnej DB
- **Žiadne falošné poplachy** — flaky test = blocker, nie warning
- **Telegram alert do 10 minút** od failu — inak alert systém je rozbitý

---

## ⚠ GAPS

- Aktuálne nemáme test-makler účet — treba vytvoriť `qa-smoke@vianema.internal`
- Cleanup môže zlyhať a nechať junk dáta — preto každý beh najprv zmaže predchádzajúce QA Smoke Test záznamy
- Playwright walk neimplementovaný — len API smoke

---

## 🧪 Skript

```bash
./scripts/qa-smoke-test.sh [base-url]
```

Default base-url: `https://test.amgd.sk`.
Endpoint pre cron: `GET /api/cron/qa-smoke`.

Audit log entries: `qa_smoke.run.ok` / `qa_smoke.run.failed`.

---

## 📌 TODO

- [ ] Playwright headless UX walk (P2)
- [ ] qa_smoke_runs tabuľka pre history dashboard
- [ ] Trend graph na admin/audit dashboard (pass-rate posledných 14 dní)
- [ ] PROD smoke test (rozdielny base-url, separátna alert formátka)
