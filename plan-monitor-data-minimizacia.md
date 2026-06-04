# Plán: Monitor — data-minimizácia (GDPR, P0)

Zdroj: `tickets/monitor-data-minimizacia.md`. Pracujeme **len na `dev`**.

## Cieľ
Prestať UKLADAŤ osobné údaje súkromných predajcov (meno, telefón, popis, raw_data).
Ukladať len údaje o objekte + link. Keď maklér chce kontakt, otvorí inzerát.

## 🔑 Kľúčové rozhodnutie (čaká na Aleša)
Klasifikátor súkromník/RK (jadro hodnoty monitora) DNES potrebuje meno+telefón+popis.
Ak ich úplne prestaneme čítať → klasifikácia spadne na „meno v titulku" → veľa „nejasných".

**Odporúčaný prístup (B): transientné spracovanie.**
Parsery meno/telefón/popis stále vyextrahujú do pamäte → klasifikátor ich použije
počas behu → do DB sa zapíše LEN výsledok (predajca_typ) + objekt + link. Osobné údaje
sa nikdy neuložia (žijú v pamäti funkcie pár sekúnd). Acceptance kritérium „v DB nie je
meno/telefón" je splnené. Klasifikácia ostáva takmer rovnako presná (popis-signály +
detail-page agency check fungujú; padne len 30-dňový phone/name-count signál).

Alternatíva (A): doslova prestať čítať → jednoduchšie, ale klasifikácia výrazne horšia.

## Kroky (po schválení)
1. **Migrácia 050** — `UPDATE monitor_inzeraty SET predajca_meno=NULL, predajca_telefon=NULL, popis=NULL, raw_data='{}'`; potom `DROP COLUMN` tých 4. (nezvratné na dev DB)
2. **types.ts** — `ScrapedInzerat`: meno/telefón/popis/raw_data nechať ako voliteľné *transientné* polia (prístup B), ale neukladané.
3. **scrape route** — upsert bez 4 PII polí; nazov skladať z faktov (`Byt 2-izb · BA-Petržalka · 149 900 €`); phone/name-count signál vypnúť (stĺpce zmiznú); pridať `logAudit` na beh.
4. **push.ts** — `notifyKupujuciMatches` + `recordInAppNotifications` + `sendPushForNewListings`: nazov z faktov, žiadny kontakt (už teraz neposielajú kontakt — over).
5. **classify-override route** — neukladať meno/telefón do `rk_directory` (nechať len email_domain/brand, čo nie je osobný údaj súkromníka).
6. **monitor UI** — už dnes nezobrazuje meno/telefón; over a uprav nazov-rendering. Zvážiť skrytie „📞 Brief".
7. **pre-call-brief** — FLAG: je to cold-contact pipeline na súkromníkov (ticket sekcia 5 to zakazuje). Mimo úzkeho scope ticketu → spýtať sa Aleša samostatne.
8. **/api/monitor route** — `select("*")` po DROP-e prestane vracať PII automaticky; over [id] route.
9. `npm run build` + typecheck + `./scripts/audit-all.sh` (baseline porovnanie).

## MIMO scope (nerob tu)
- G2 anon RLS leak (mig 035) → samostatný security fix.
- ToS portálov / anti-bot obchádzanie → rozhodnutie CEO.

## Acceptance
- [x] `monitor_inzeraty` nemá meno/telefón/popis/raw_data (migr. 106 aplikovaná na dev).
- [ ] Po scrape behu v DB žiadne meno/telefón (overiť LIVE scrape behom — čaká).
- [x] UI: nadpis z faktov + link, žiadny kontakt (Brief tlačidlo odstránené).
- [x] `notifyKupujuciMatches` neposiela kontakt (posiela len objekt + link).
- [x] typecheck `src/` čistý, audit bez novej regresie (20 = baseline, monitor ✗0).
- [x] rk_directory bez osobných údajov; classify-override neukladá PII.
- [x] pre-call-brief (cold-contact) odstránený; monitor-daily PHASE 4/5 odstránené.

## Stav: HOTOVÉ (čaká len LIVE scrape verifikácia)
Build lokálne padá na `@parcel/watcher` (env problém, nesúvisí) — typecheck src/ čistý.
Cron `/api/cron/scrape` aktuálne nebeží automaticky (zistené skôr) — samostatná téma.
