# Doména: Monitor & Analýza

> **Owner**: každý kto mení súbory v `src/app/api/monitor/`, `src/lib/monitor/`,
> `src/app/monitor/`, `src/app/api/cron/scrape/`, `src/app/api/cron/monitor-daily/`,
> alebo migrácie typu `monitor_*`. **Pred zmenou prečítaj. Po zmene spusti
> `scripts/audit-monitor.sh`.**

## Účel domény
Monitor sleduje konkurenčné inzeráty (Bazos, Reality.sk, Nehnuteľnosti.sk), klasifikuje predajcov
(súkromník vs realitka), detekuje "motivovaných predajcov" (relisting, zníženie ceny, mimo trhu).
Maklér v ňom hľadá tipy na nové nábery + sleduje trh.

Ak sa táto doména rozbije: maklér nemá insights, môže prísť o nábery, AI analýza je nepoužiteľná.

---

## ✓ INVARIANTS

### Scraping
- **Daily cron**: `vercel.json` → `/api/cron/scrape` o **08:00 UTC** denne.
- 3 parsery: `bazos-sk.ts`, `reality-sk.ts`, `nehnutelnosti-sk.ts`. Každý vracia normalizovaný `MonitorInzerat[]`.
- Scraper má retry + timeout per request. Failed scrape = log + pokračuj na ďalší zdroj.
- Vždy filtruj **iba súkromní predajcovia** v UI default (migrácia 014_monitor_len_sukromni.sql).

### Klasifikátor (v2)
- `src/lib/monitor/classifier.ts` rozhoduje `sukromnik | realitka | nejisty`.
- Signály (váhy + reason) → `raw_score` → `predajca_typ`. Confidence threshold pre "nejisty".
- **Test coverage**: `classifier.test.ts` (existuje! → vždy spusti pri zmene).
- Override flow: `/api/monitor/classify-override` umožňuje manuálne prepísanie ak klasifikátor zlyhá.

### AI Analýza
- `/api/monitor/analyza` agreguje aktívne inzeráty, by_portal, by_typ, predajcovia.
- "Motivated sellers" = filter inzerátov so signálmi (RELISTED, atď.).
- Signál `evidence` je **JSON objekt** v DB ({days_away, prev_cena, new_cena, ...}), nie string.
  Pri rendrovaní použiť `formatEvidence()` v `analyzy/page.tsx`.

### Tabuľky (migrácie)
- `monitor_inzeraty` (008) — surové inzeráty
- `monitor_snapshots` + `monitor_disappearances` (035) — historický stav
- `motivation_signals` + dedup (039)
- `classifier_v2_*` (041) — confidence, method
- `monitor_extra_fields` (042)
- Všetky majú `company_id` (061).

### Vzťah ku klientovi/náberu
- Tipom z monitora vie maklér rovno **vytvoriť klienta** (button "Pridať ako lead"). Volá `/api/klienti` POST.
- Žiaden auto-sync — explicitná akcia.

---

## ⚠ GAPS — možné problémy

### 1. **Žiadny health check pre scrape cron** ⚠
Ak `/api/cron/scrape` zlyhá (3rd party zmení HTML, network, Vercel timeout 60s), VšeČO PRESTANE FUNGOVAŤ TICHO. Treba:
- Tabuľka `cron_runs(name, started_at, finished_at, status, error)`
- Banner v UI ak scrape zlyhal posledných 24h
- Email alert adminovi

### 2. **Žiadne pamätanie target site changes** ⚠
Keď bazos.sk zmení HTML, parser tichotka začne vracať prázdne. Treba sentinel test: "očakávame >50 inzerátov denne, ak menej → log error".

### 3. **Klasifikátor v2 confidence floor** ⚠
Aký % inzerátov je `predajca_typ = 'nejisty'`? Ak vysoký, klasifikátor nemá užitočnosť. Treba metric.

### 4. **Reclassify-all bezpečnosť** ⚠
`/api/monitor/reclassify-all` prebehne cez všetky inzeráty. Pri 100K rows = timeout. Treba batchovať alebo asynchrónne.

### 5. **Motivated signals retention** ⚠
Signály sa pravdepodobne neumažú nikdy. Pri 100K inzerátoch × 5 signálov = 500K+ rows. Treba retention policy (napr. 6 mesiacov).

---

## 🔥 HOT FILES

| Súbor | Prečo kritický |
|---|---|
| `src/app/api/cron/scrape/route.ts` | Daily scrape — ak padne, doména je mŕtva |
| `src/lib/monitor/classifier.ts` | Klasifikácia predajcov. Bug = falošné pozitíva/negatíva |
| `src/lib/monitor/parsers/*.ts` | Parsery 3rd party. Krehké na zmeny target HTML |
| `src/app/api/monitor/analyza/route.ts` | AI insight endpoint. Pri 100K inzerátoch = perf risk |
| `src/app/api/cron/monitor-daily/route.ts` | Detekcia signálov (RELISTED atď.). Ovplyvňuje "motivated sellers" UI |
| `supabase/migrations/039_motivation_signals_*.sql` | Schema signal storage. Zmena tu = potenciálne mazanie historických signálov |

---

## 📅 Cron schedule (vianema produkcia)

| Cron | Schedule UTC | Účel |
|---|---|---|
| `/api/cron/scrape` | 08:00 | Daily scrape všetkých portálov |
| `/api/cron/monitor-daily` | 09:00 | Vyhodnocovanie signálov (1h po scrape) |
| `/api/cron/api-status` | 06:00 | Healthcheck 3rd party API |

Predpoklad: scrape skončí do 1h (do 09:00 monitor-daily). Ak scrape trvá viac → monitor-daily pracuje so starými dátami.

---

## 🧪 Pravidelný audit

```bash
./scripts/audit-monitor.sh
```

Skontroluje:
1. Posledný scrape behol < 36h späť (ak nie → cron je rozbitý)
2. Počet aktívnych inzerátov >= 10 (sanity)
3. Parsery sa kompilujú (TS check)
4. Classifier testy prejdú

---

## 📌 Otvorené tickety / TODO

- [ ] Cron health check (`cron_runs` tabuľka + banner) — P1
- [ ] Sentinel test "scrape vrátil >50 inzerátov" — P2
- [ ] Reclassify-all batching pre 100K+ rows — P2
- [ ] Signal retention policy — P3
- [ ] Klasifikátor confidence metric v UI — P3

---

## História významných incidentov

- **2026-05-18** Aleš nahlásil React #31 crash v AI Analýza. Príčina: backend ukladá `evidence` ako objekt, frontend type bol `string`. Fix: `formatEvidence()` v `analyzy/page.tsx`. Commit `5ecc967` (dev).
- **(starší)** Klasifikátor v2 vznikol kvôli nízkej presnosti v1 (false positives na realitky). Tests sú v `classifier.test.ts`.
