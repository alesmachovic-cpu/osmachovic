# ZADANIE: Monitor — data-minimizácia (odstrániť osobné údaje predajcov)

**Priorita:** P0 (GDPR) · **Doména:** Monitor & Analýza · **Typ:** schéma + scraper + UI

## Prečo (kontext)
Monitor scrapuje cudzie portály a ukladá **meno + telefón súkromných predajcov**. To z nás
robí prevádzkovateľa ich osobných údajov bez právneho základu a bez splnenia informačnej
povinnosti (GDPR čl. 14) → priame riziko pokuty. **Riešenie: prestať ukladať osobné údaje,
ukladať len údaje o nehnuteľnosti + link.** Keď maklér chce kontaktovať predajcu, klikne na
link a kontakt si nájde priamo v inzeráte (my ho nedržíme).

## Čo treba spraviť

### 1. DB schéma (nová migrácia)
- **Vynulovať a odstrániť** stĺpce z `monitor_inzeraty`:
  `predajca_meno`, `predajca_telefon`, `popis`, `raw_data`
  (najprv `UPDATE ... SET = NULL`, potom `DROP COLUMN`).
- Pôvodné definície: `supabase/migrations/008_monitor_tables.sql`.
- **Nechať** (sú to údaje o objekte, nie o osobe): `url`, `typ`, `lokalita`, `cena`, `mena`,
  `plocha`, `izby`, `predajca_typ` (len klasifikácia súkromník/realitka), `foto_url`, dátumy.

### 2. Scraper + parsery (`src/lib/monitor/`)
- `scraper.ts` + `parsers/*` (bazos, reality, topreality, nehnutelnosti): **prestať plniť**
  `predajca_meno`, `predajca_telefon`, `popis`, `raw_data`.
- **Nadpis (`nazov`) skladať z faktov**, nie kopírovať z inzerátu:
  napr. `"Byt 2-izb · Bratislava-Petržalka · 149 900 €"`.
- `push.ts` → `notifyKupujuciMatches`: **nezobrazovať/neposielať kontakt predajcu**
  maklérovi (zrušiť cold-contact pipeline). Notifikácia môže ostať, ale len s objektom + link.

### 3. API
- `src/app/api/cron/scrape/route.ts`: zápis bez osobných polí. Pridať `logAudit` na scrape beh.
- `src/app/api/monitor/classify-override/route.ts`: **neukladať scrapnuté osoby** do training
  data / `rk_directory` ak obsahujú meno/telefón.

### 4. UI (`src/app/monitor/page.tsx`)
- Zobraziť **nadpis (typ + lokalita + cena) + tlačidlo „Otvoriť inzerát" (link)**.
- Odstrániť zobrazenie mena/telefónu predajcu.

### 5. (Voliteľné, odporúčané)
- Retencia objektov: mazať `monitor_inzeraty` staršie ako ~24 mesiacov.
- Interné pravidlo (do popisu feature): **„Monitor slúži len na trhovú/cenovú analýzu.
  Kontaktovať predajcov z monitora je zakázané."**

## Hotové, keď (acceptance criteria)
- [ ] `monitor_inzeraty` nemá stĺpce `predajca_meno/predajca_telefon/popis/raw_data`.
- [ ] Po novom scrape behu sa nikde neuloží meno ani telefón predajcu (over v DB).
- [ ] UI ukazuje nadpis z faktov + link, žiadny kontakt predajcu.
- [ ] `notifyKupujuciMatches` neposiela kontakt.
- [ ] `npm run build` + typecheck OK, `audit-all.sh` bez novej regresie.

## MIMO rozsahu tohto zadania (nerieš tu)
- **G2 — anon RLS leak** (migr. 035, `FOR SELECT TO anon USING(true)` na snapshotoch) →
  samostatný **bezpečnostný** fix (security-owner). Môže ísť hneď, nezávisle.
- **ToS portálov + databázové právo** — scraper obchádza anti-bot (CAPTCHA/Cloudflare).
  Data-minimizácia toto NErieši. Rozhodnutie CEO (API portálu / akceptovať riziko písomne).

## Súbory
- `supabase/migrations/008_monitor_tables.sql` (+ nová migrácia)
- `src/lib/monitor/scraper.ts`, `src/lib/monitor/parsers/*`, `src/lib/monitor/push.ts`
- `src/app/api/cron/scrape/route.ts`, `src/app/api/monitor/classify-override/route.ts`
- `src/app/monitor/page.tsx`
