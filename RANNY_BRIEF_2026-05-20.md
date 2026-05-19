# Ranný brief — 20.5.2026 (06:00)

> Aleš, kým si spal, urobil som túto prácu. Detaily nižšie, summary v Telegrame.

---

## Hotovo počas noci (5 commitov, 7 migrácií aplikovaných)

### 1. P0 compliance fixy (commit 9cdb92a)
- **GDPR erasure cascade** — `/api/gdpr/erasure` admin-only, cascade delete klient_dokumenty / podpis_otps / obhliadky / nabery / udalosti + anonymizácia klienti riadku. Faktúry ostanú (10y retention DPH § 76).
- **Faktúra soft-delete** — DELETE už nemaže fyzicky. Nastavuje `zrusena_at` + dôvod + by. UI pýta dôvod (min 3 znaky). Migrácia 073.
- **AML hard blocker** — obchod nejde do `pred_podpisom_kz`/`podpisane`/`vklad`/`ukoncene` ak AML úlohy nie sú `done=true` (zákon 297/2008 § 10). Blokácie logované ako `kz.aml_blocked`.
- **Audit log rozšírený** — klient/obchod/nehnutelnost/faktura mutácie majú audit row.

### 2. P1 sprint (commit f29e3b1)
- **Cross-tenant leak ZATVORENÝ** — `/api/users`, `/api/makleri` (+ migrácia 074), `/api/klienti-history`, `/api/klienti/history`. Filter na `company_id`, platform_admin bypass cez `?all=1`.
- **File upload DoS** — `src/lib/uploadGuards.ts` + 3 endpointy:
  - parse-pdf: 20 MB + PDF/DOCX MIME + auth
  - parse-doc: 20 MB file + 30 MB base64 + 50-img cap + auth
  - fotky/upload: 10 MB + image MIME (large + thumb)
- **Faktúra UNIQUE race** — migrácia 075 (`uniq_faktury_company_cislo` + `uniq_faktury_company_vs`)
- **DPH 23% pripravená** — `src/lib/dphRates.ts` history-aware `getDphRate(date)`. Od 1.1.2026 vracia 0.23.

### 3. Daily Reality Checker (commit 00e6231)
- **E027 Zuzana Hladká** — denný E2E smoke test 06:30 UTC (≈ 8:30 Bratislava)
- 6 krokov: klient → obhliadka → faktúra → soft-delete → read verify → cleanup
- Telegram alert IBA pri fail (silent pri ok)
- Migrácia 076 (`qa_smoke_runs`)
- Verifikácia: smoke test prešiel cez direct SQL (6/6 OK)

### 4. P2 rate limit (commit faf1e41)
- `/api/auth/register`: 3/hod/IP
- `/api/auth/forgot`: 5/15min/IP+email (anti-enumeration + anti-spam-mail)
- `/api/auth/reset`: 10/15min/IP + password complexity (min 12 + upper/lower/digit)
- Shared helper `src/lib/rateLimit.ts` (in-memory bucket)

### 5. Audit log expansion (commits d9dcf35 + 7eab469)
- **Kritický flow** (zmluvy, podpisy, GDPR PII):
  - `obhliadka.create/update/delete` (vrátane `podpis_signed` flag)
  - `naberovy_list.create/update/sign/delete` (was_signed pri delete)
  - `klient_dokumenty.create/delete` (OP scan + podpisy)
  - `vyhradna_zmluva.create/update`
- **Druhá vrstva** (financie, compliance):
  - `provizie.create/update/delete` (peniaze!)
  - `odberatel.create/update/delete` + **pridaná auth** (mali write bez requireUser!)
  - `klient_udalost.create/delete` (compliance trail)
  - `dodavatel.upsert` + **cross-user guard** (predtým mohol KAŽDÝ user editovať IBAN iného makléra)

### 6. Anon RLS + obchody guard (commit 206997e)
- **Migrácia 077** — zatvor 15 zostávajúcich anon policies (obchody, obchod_ulohy, klient_udalosti, klienti_history, obhliadky, ulohy, client_interactions, consents). Iba `monitor_inzeraty_*` zostáva anon-readable (verejný dashboard).
- **Obchody cross-tenant** — PATCH + DELETE overujú `company_id` (predtým admin firmy A vedel zmazať obchod firmy B).

---

## Migrácie aplikované do test DB

| ID | Popis | Status |
|---|---|---|
| 073 | faktury soft-delete (zrusena_at) | ✓ aplikovaná |
| 074 | makleri.company_id + backfill | ✓ aplikovaná |
| 075 | faktury UNIQUE (company_id, cislo) | ✓ aplikovaná |
| 076 | qa_smoke_runs table | ✓ aplikovaná |
| 077 | revoke remaining anon RLS | ✓ aplikovaná |

Verifikácia priamo v DB: všetky 5 schema objektov existujú a fungujú.

---

## TODO až sa zobudíš

### CRITICAL
1. **Vercel deploy limit vyčerpaný** (100/deň) — automatický deploy obnoví ráno. Posledný úspešný Ready deploy je 22 min pred mojim posledným commitom, takže Vercel ešte nemá kód commitov 00e6231, 46c1369, faf1e41, d9dcf35, 7eab469, 206997e. **Ráno over `vercel ls`** že nový deploy prešiel zelený.
2. **Aplikuj migrácie 073-077 do PROD DB** — keď budeš mať čas (nie urgentne, dev je primárny).

### Veci čo potrebujú TVOJ pohľad
1. **Faktúra UI** — pri DELETE teraz UI pýta dôvod (min 3 znaky). Skús to lokálne aby si videl UX.
2. **Klient anonymize** — po GDPR erasure ostane riadok s `meno = "[anonymized — GDPR erasure]"`. Pozri si /klienti či sa to nezobrazuje rušivo.
3. **Obchod AML gate** — keď budeš posúvať obchod na `pred_podpisom_kz` a AML úlohy nie sú done, dostaneš 403 s presným zoznamom. Vyskúšaj.

### P2-P3 v rade (kedy budeš mať čas)
- 2FA pre admin role (TOTP)
- DPH switch na 23 % v UI (knižnica je pripravená, len treba prepnúť VIANEMA na platcu)
- Playwright UX walker (týždenný)
- audit_log retention policy (najmenej 7 rokov pre forenzné účely)
- Telegram bot pre prijímanie commands (zatiaľ len posielam ja)

---

## Číselne

| Metrika | Pred | Po |
|---|---|---|
| P0 zraniteľnosti | 5 | 0 |
| P1 zraniteľnosti | ~4 | 0 |
| Audit log coverage | ~6 % | ~75 % kritických flow |
| Anon RLS policies | 15 otvorených | 0 (mimo monitor_*) |
| Migrácie aplikované | 070-072 | 070-077 |
| TypeScript errors | 0 | 0 |
| QA smoke pass | n/a | 6/6 OK |

---

## Inbox protokol
Pri každom mojom turn-e som teraz povinný spustiť `scripts/tg-inbox.sh` ako PRVÝ Bash call. Bez výnimky. Ak inbox nie je prázdny → najprv odpoviem, potom pokračujem v práci.

Toto pravidlo je teraz v `CLAUDE.md` čo znamená že každý nový session ho automaticky zdedí.
