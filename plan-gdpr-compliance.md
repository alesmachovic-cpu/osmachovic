# Plán — GDPR & právny compliance audit (RK Vianema)

**Dátum auditu:** 2026-06-03
**Audítori:** Compliance Officer (K. Bartošová) + Security Auditor (A. Vrabec), syntéza + verifikácia CEO.
**Stav:** ANALÝZA HOTOVÁ — čaká sa na poradie implementácie.

Toto je živý plán. Každý nález = budúci fix. Implementuje sa po schválení CEO, jeden po druhom, vždy s `audit-all.sh` pred commitom.

---

## 🚨 P0 — zákonné riziko HNEĎ (implementovať ako prvé)

### F1 — Cross-tenant únik klientskych dokumentov (OP/LV/AML) — IDOR
**Súbor:** `src/app/api/klient-dokumenty/route.ts` (GET/POST/PATCH/DELETE)
**Stav:** ✅✅ **OPRAVENÉ 2026-06-03** (uncommitted). Všetky 4 metódy scopujú `company_id` (cross-company → 404), DELETE navyše `canEditRecord`. Root-cause proces: `audit-cross-tenant.sh` rozšírený o detské PII tabuľky (CHILD_PII_TABLES) — odhalil a opravený aj `gdpr/erasure` (super_admin mohol mazať klienta inej firmy → doplnený company guard). Overené: tsc čistý, audit-all 20=20 baseline (žiadna regresia).
**Problém:** Endpoint používa service role (obchádza RLS) a nekontroluje `company_id` ani vlastníka. Ktokoľvek prihlásený zavolá `GET /api/klient-dokumenty?klientId=<cudzie-uuid>` → dostane **odšifrované** OP/LV/AML scany cudzieho klienta (aj inej firmy). `DELETE ?id=` zmaže cudzí dokument.
**Zákon:** GDPR čl. 32(1)(b) + čl. 5(1)(f); osobitná kategória údajov (OP, AML).
**Riziko:** Najcitlivejšia tabuľka v systéme. Insider alebo unesená session = stiahne všetky OP/AML scany firmy. Pokuta + ohlasovacia povinnosť.
**Fix:** Pred query načítať klienta, overiť `klient.company_id === scope.company_id` a `canEditRecord(scope, klient.makler_id)` pri write. Doplniť do `audit-cross-tenant` checku.

### F2 — PII tretích osôb (vlastníci z LV) posielané do US AI bez podkladu
**Stav:** ✅ OPRAVENÉ 2026-06-03 (uncommitted) — rozhodnutie CEO: používať IBA Anthropic na klientske dokumenty.
- **parse-lv, parse-doc, parse-pdf** prepísané na VÝHRADNE Claude (Anthropic). Claude číta PDF (document blok), rasterizované stránky (image bloky) aj text/OCR natívne. Gemini + OpenAI úplne odstránené z PII parse flow. parse-pdf si nechal lokálny `pdf-parse` (bez prenosu dát) ako last resort.
- Model: `claude-haiku-4-5-20251001`. SDK 0.96.0 podporuje document bloky (overené tsc).
- `/bezpecnost`: disclosure spresnený — klientske dokumenty výhradne Anthropic; OpenAI/Gemini ostávajú pre copywriter + analýzu trhu/okolia (bez identifikačných dokumentov klientov).
- **Minimalizácia netreba** — CEO potvrdil: všetci vlastníci na LV sú štandardne naši predávajúci klienti (nepredáva sa len časť nehnuteľnosti), spracúvame ich legitímne na základe zmluvy.
**Overené:** tsc čistý, PII routes bez Gemini/OpenAI, audit-all 20=20. ✅ ŽIVÝ TEST na dev.amgd.sk PREŠIEL (2026-06-03) — Claude cez document blok presne vytiahol všetky polia z LV PDF vrátane vlastníkov s dátumami narodenia, `_ai:"Claude"` potvrdený, 5,4s. Commit `5de4e0c` na dev.
**Zostáva mimo kódu:** podpísať DPA s Anthropicom (ak ešte nie je); CEO potvrdiť presnosť na 1 reálnom (skenovanom) LV v appke.
**Pozn. (nový nález mimo F2):** `parse-lv` nemá `requireUser()` guard — anonymný útočník môže páliť náš Claude quota + posielať ľubovoľné PDF. Pridať do plánu (P1, cost/abuse).
**Súbory:** `parse-lv/route.ts`, `parse-doc/route.ts`, `parse-pdf/route.ts`, `src/app/(legal)/bezpecnost/page.tsx`
**Problém:** Do Anthropic/OpenAI/Gemini (USA) sa posiela **celý PDF base64** LV / znaleckého posudku / zmlúv = mená vlastníkov, dátumy narodenia, rodné čísla, adresy. Žiadna redakcia/pseudonymizácia. Sú to PII **cudzích osôb** (nie naši klienti, bez súhlasu). Subprocessor zoznam na `/bezpecnost` (r. 76-86) **neobsahuje OpenAI ani Gemini**, hoci sa reálne volajú.
**Zákon:** GDPR čl. 6 (právny základ), čl. 9 (osobitná kategória – rodné číslo), čl. 28 (subprocessor), čl. 44+ (transfer mimo EÚ), čl. 13/14 (informačná povinnosť).
**Riziko:** Aktívne pri každom parse-LV v náberovom flow. Bez DPA + transfer základu neobhájiteľné.
**Fix:** (1) Doplniť OpenAI+Gemini do subprocessor tabuľky. (2) Server-side redakcia rodného čísla/mien pred odoslaním, kde use-case dovolí. (3) AI disclosure do privacy policy. (4) Overiť DPA + že API tier netrénuje na dátach (právne).

### F3 — Faktúra po vystavení voľne meniteľná + bez audit logu
**Stav:** ✅ OPRAVENÉ 2026-06-03. PATCH `/api/faktury`: (1) company_id scope (cross-tenant ochrana), (2) zámok vystavenej faktúry — povolené len `zaplatene`/`datum_uhrady`/`poznamka`, ostatné → 409 INVOICE_LOCKED, (3) `logAudit("faktura.update")`. POST: `logAudit("faktura.create")`. Frontend PATCHuje len platobné polia → UI nezlomené. Dodávateľ-snapshot commitnutý samostatne (eaa20bc). Overené: tsc, audit-all 20=20.
**Súbor:** `src/app/api/faktury/route.ts` (PATCH r. 184-201, POST)
**Problém:** PATCH dovolí prepísať akékoľvek pole vystavenej faktúry (suma, dátum, odberateľ) bez kontroly stavu a **bez `logAudit()`**. POST tiež neloguje. Snapshot dodávateľa (migr. 100) rieši len časť — hlavička faktúry sa dá prepísať.
**Zákon:** Zák. 431/2002 § 8 (nemennosť účtovného záznamu), zák. 222/2004 § 71 (oprava len dobropisom/ťarchopisom).
**Riziko:** Kontrola Finančnej správy → pokuta, dorovnanie DPH, žiadny trail kto menil.
**Fix:** Po vystavení zamknúť PATCH (povoliť len `zaplatene`/`datum_uhrady`); ostatné opravy len storno + nová faktúra. `logAudit()` do POST aj PATCH.

---

## ⚠️ P1 — riešiť v rámci týždňov/mesiacov

### F4 — GDPR export exportuje dáta makléra, nie klienta (právo na prístup nefunkčné)
**Stav:** ✅ OPRAVENÉ 2026-06-03. Pridaná vetva `GET /api/gdpr/export?klient_id=X` → exportuje osobné údaje klienta-subjektu (klient record + nábery + obhliadky + dokumenty-metadata + udalosti), scoped na company_id, s audit logom `gdpr_export_subject`. (PR #19 medzitým pridal cross-tenant guard na pôvodný maklér-export.) Follow-up: tlačidlo „Export GDPR" na detaile klienta (UI). Overené: tsc, audit-all 20=20.
**Súbor:** `src/app/api/gdpr/export/route.ts` (r. 32-37 filtruje podľa `makler_id`/`user_id`)
**Problém:** „Export všetkých údajov" vráti údaje makléra, nie subjektu. Žiadosť klienta o prístup (čl. 15) by sme nesplnili.
**Zákon:** GDPR čl. 15 + čl. 20, zák. 18/2018 § 21.
**Fix:** Prepísať export na vstup `klient_id` → exportovať klienta + nábery + obhliadky + dokumenty + udalosti + faktúry kde je odberateľom.

### F5 — GDPR výmaz nemaže dokumenty v Google Drive
**Stav:** ✅ ČIASTOČNE 2026-06-03. Keďže OAuth scope je `drive.readonly` (nevieme mazať programaticky), erasure teraz generuje audit záznam `gdpr.erasure.drive_manual_required` + `drive_manual_delete_required: true` + výrazné upozornenie v odpovedi, aby admin Drive priečinok klienta zmazal ručne. Plné riešenie (scope `drive.file` + auto-delete) = budúci follow-up. Overené: tsc, audit-all 20=20.
**Súbory:** `src/app/api/gdpr/erasure/route.ts`, `src/lib/google.ts` (scope `drive.readonly`, r. 16)
**Problém:** Erasure spraví cascade delete v DB + anonymizáciu, ale Drive sa nedotkne (grep `drive` = 0). OAuth scope je `readonly` → CRM technicky ani nemôže mazať. OP/LV scany ostávajú v Drive natrvalo → výmaz neúplný.
**Zákon:** GDPR čl. 17.
**Fix:** Buď (a) generovať TODO pre admina na zmazanie Drive priečinka + audit entry `drive_manual_delete_required`, alebo (b) rozšíriť scope na `drive.file` a mazať programaticky.

### F6 — AML identifikácia nie je tvrdý blocker pred KZ + chýba evidencia
**Súbor:** `src/lib/obchodStatus.ts` (r. 38-47)
**Problém:** `allAmlDone = ulohy.filter(aml).every(done)` — na prázdnom poli `.every()` = `true` → obchod bez AML úloh preskočí rovno na `pred_podpisom_kz`. V schéme **chýbajú** polia `aml_check_at`, `kuv`, `pep`. `/aml-poucenie` je len verejný text, nie evidencia.
**Zákon:** Zák. 297/2008 § 10-11 (identifikácia pri obchode >15 000 € — nehnuteľnosť vždy), § 5 (RK = povinná osoba). **Registrácia povinnej osoby deadline 31.8.2026.**
**Fix:** Pridať AML evidenciu (identifikácia KUV, referencia OP scanu, dátum, PEP/sankčný check) + tvrdý blocker stavu KZ. Zaregistrovať Vianemu do 31.8.2026.

### F7 — Faktúra PDF nezobrazuje základ dane a sadzbu DPH
**Stav:** ✅ OPRAVENÉ 2026-06-03. PDF teraz pre platiteľa DPH zobrazuje rozpis: Základ dane / DPH X% / Celkom k úhrade (sadzba sa počíta z dph÷suma_bez_dph). Pre neplatiteľa pridaný text „Dodávateľ nie je platiteľom DPH." Súbor `faktury/pdf/route.ts`. Overené: tsc, audit-all 20=20.
**Súbor:** `src/app/api/faktury/pdf/route.ts` (r. 306-307 — len „Celkom k úhrade")
**Problém:** DPH sa počíta (`lib/dphRates`), ale na PDF chýba rozpis základ dane / sadzba / suma DPH.
**Zákon:** Zák. 222/2004 § 74 ods. 1.
**Fix:** Doplniť na PDF rozpis: základ dane / sadzba (15/19/23 %) / DPH / spolu. Overiť sadzbu od 1.1.2026 (23 %).

### F8 — Audit log neloguje READ prístup k PII + pokrýva len ~33 % write operácií
**Stav:** ✅ ČIASTOČNE 2026-06-03. Pridané logovanie READ prístupu k najcitlivejšiemu endpointu — `klient-dokumenty` GET (dešifrovanie OP/LV/AML scanov) → `klient_dokumenty.read` (len keď count>0). GDPR export už loguje (F4). Zostáva: batch-doplniť write audit na zvyšok endpointov (ongoing). Overené: tsc, audit-all 20=20.
**Súbory:** `src/app/api/klienti/route.ts`, `klient-dokumenty/route.ts` (GET nelogujú)
**Problém:** Loguje sa len write (29/87 súborov). Čítanie PII (zoznam klientov, dešifrovanie OP/LV scanu) sa neloguje → pri breachi nevieme dokázať rozsah dotknutých osôb.
**Zákon:** GDPR čl. 5(2) accountability, čl. 33/34 (rozsah breachu).
**Fix:** Logovať READ aspoň na `klient-dokumenty` GET (dešifrovanie OP/AML) a GDPR export. Batch-doplniť write audit na tabuľky s PII (cieľ 100 %).

### F9 — Retention audit_log cron je nefunkčný (no-op konflikt s triggerom)
**Stav:** ✅ OPRAVENÉ 2026-06-03. Odstránený mŕtvy `audit_log.delete()` z cleanup cronu (trigger ho blokol → tichý no-op, navyše 2r < zákonných 5/10r). audit_log = zámerne append-only (forenzná + zákonná retencia, GDPR čl.6 oprávnený záujem). login_attempts cleanup teraz surfaceuje chyby. Overené: tsc, audit-all 20=20.
**Súbory:** `src/app/api/cron/cleanup/route.ts` (r. 24), `supabase/migrations/080_audit_log_immutable.sql`
**Problém:** Cron robí `DELETE` na `audit_log` po 2 rokoch, ale migr. 080 má `BEFORE DELETE RAISE EXCEPTION` → delete vždy zlyhá, cron ticho vráti `audit_log_cleaned: false`. Retention reálne nefunguje, log rastie donekonečna (IP, mená). Navyše 2 roky < zákonných 5 r. (AML) / 10 r. (DPH).
**Zákon:** GDPR čl. 5(1)(e) minimalizácia vs. zák. 297/2008 § 11 (5 r.) / zák. 222/2004 § 76 (10 r.).
**Fix:** Rozlíšiť typy logov — bezpečnostné/AML/účtovné archivovať 5/10 r., operatívne mazať po lehote cez kontrolovaný proces (nie cez delete čo trigger blokne). Alert pri zlyhaní cronu.

---

## 📋 P2 — roadmapa (nie urgentné)

### F10 — Granulárny consent sa nezbiera pri klientovi
**Stav:** ✅ OPRAVENÉ 2026-06-03. Nové `GET/POST/PATCH /api/consents` zapája existujúcu `consents` tabuľku (ledger): udelenie súhlasu (purpose napr. "marketing", s proof_ip/user_agent), odvolanie (čl.7 ods.3 → withdrawn_at), zoznam. Scoped cez klienta na company_id, audit `consent.granted`/`consent.withdrawn`. Core spracovanie (predávajúci/kupujúci) je na zmluve — súhlas len pre marketing. Follow-up: UI checkbox v NewKlientModal + zobrazenie/odvolanie na detaile klienta.
`gdpr_consent` existuje len na `obhliadky`/`naberove_listy` (migr. 025). `klienti` ho nemá. Tabuľka `consents` existuje ale žiadny API ju nezapisuje. Žiadna granularita (spracovanie vs. marketing) ani evidencia odvolania.
**Zákon:** GDPR čl. 6/7. **Fix:** pri klientovi zaznamenať právny základ; pre marketing samostatný granulárny súhlas + odvolanie.

### F11 — Žiadny automatický výmaz/anonymizácia klientov po lehote
**Stav:** ✅ OPRAVENÉ 2026-06-03. Nový cron `GET /api/cron/retention-anonymize`: anonymizuje PII leadov, ktorí sa NIKDY nestali obchodom a sú >RETENTION_YEARS (default 5) neaktívni. **Bezpečnosť:** DEFAULT = DRY-RUN (len report kandidátov, žiadna zmena); reálne anonymizuje len pri `RETENTION_ANONYMIZE_ENABLED=true`. Vylučuje klientov v obchodoch (zákonná retencia) + už anonymizovaných. Audit `klient.retention_anonymized`. **Nie je naplánovaný vo vercel.json** — spustí sa až keď CEO nastaví retention politiku. Follow-up: po overení politiky zapnúť + naplánovať.
Erasure je len manuálna. Žiadny cron na anonymizáciu PII po uplynutí účelu (napr. nezrealizovaný záujemca po X rokoch).
**Zákon:** GDPR čl. 5(1)(e). **Fix:** definovať retention lehoty per kategória + cron na anonymizáciu.

### F12 — Chýba breach notification playbook (72h)
**Stav:** ✅ HOTOVÉ 2026-06-03. Napísaný `security-audit/breach-playbook.md` — kompletný 72h SOP: definícia breachu, okamžité kroky, eskalácia, posúdenie rizika, ohlásenie ÚOOÚ (čl.33), informovanie klientov (čl.34), register incidentov, šablóny, scenáre pre Vianemu, prevencia. Follow-up: doplniť reálne dátumy na `/bezpecnost`.
Žiadny proces „ak leak, čo do 72 h". `/bezpecnost` má placeholdery `[DOPLŇTE DÁTUM]`.
**Zákon:** GDPR čl. 33/34. **Fix:** napísať playbook + doplniť reálne dátumy.

### F13 — eKasa pre hotovostné platby
**Stav:** ✅ VYRIEŠENÉ POLICY (nie kód) 2026-06-03. eKasa (zák. 289/2008) sa vzťahuje len na **tržbu = hotovosť/karta na mieste** (§ 2 písm. h). **Bankový prevod NIE JE tržba → eKasa povinnosť nevzniká.** Riešenie: policy „provízia výhradne bezhotovostne, prevodom na účet" → žiadna eKasa integrácia do CRM netreba. **Akcie CEO:** (1) doplniť do obchodných podmienok + šablóny faktúry „úhrada výlučne prevodom"; (2) [daňový poradca overiť] aktuálne znenie prílohy č.1 (či realitka nie je na zozname) + obsah novely 170/2024. Pozn.: zákon 394/2012 aj tak zakazuje hotovosť nad 15 000 €.
Od 1.1.2026 RK eviduje hotovosť cez eKasu. Žiadna integrácia/policy.
**Fix:** buď integrácia, alebo formálna policy „iba bezhotovostné platby" (jednoduchšie).

### F14 — Nový zákon 170/2024 o realitnom sprostredkovaní — PRÁVNE OVERIŤ
Účinný od 1.1.2025. Treba overiť či sprostredkovateľská/vyhradná zmluva + náberový list obsahujú nové povinné náležitosti: register sprostredkovateľov, informačné povinnosti, poistenie zodpovednosti, odborná spôsobilosť. Súbor: `src/app/api/vyhradna-zmluva/pdf/route.ts`.
**Fix:** delegovať externému právnikovi na presné znenie, potom doplniť do generátorov zmlúv.

---

## QA hardening (po review F2, 2026-06-03)
Po ostrej QA spätnej väzbe na testovací checklist doplnené:
- **Regresný harness** `tools/parse-regression/` — gold-standard fixtúry, skórovanie presnosti, P50/P95 latencia, prah ACCURACY_MIN 90 % + p95<30s. Beží proti dev. Podporuje aj docx (multipart, AUTH_COOKIE).
- **#6 race condition** — klient_dokumenty: unique index (migr. 101) + 23505 catch v POST. Real bug fix.
- **#8 kill-switch** — `AI_PARSE_ENABLED=false` (env) vypne AI parsing → manuálne vyplnenie. `src/lib/aiFlag.ts`, zapojené v 3 parse routes.
- **#4 failure UX + review fronta** — tabuľka `parse_failures` (migr. 102) + `src/lib/parseFailure.ts` logovanie zlyhaní; vedené hlášky v InzeratForm (dokument je uložený, vyplň ručne).
- **#5 authz test** `tools/security/klient-dokumenty-authz.mjs` — request-level cross-company izolácia (čaká na 2 cookies od CEO).
- **SLA:** p95 < 30s (prísnejšie). UI progres počítadlo stránok = drobný follow-up.

## TOP 5 NA OKAMŽITÚ IMPLEMENTÁCIU
1. **F1** — cross-tenant IDOR na klient-dokumenty (verifikované, exploitovateľné teraz).
2. **F2** — ošetriť PII do AI (subprocessor zoznam + redakcia + disclosure).
3. **F3** — zamknúť faktúru po vystavení + audit log.
4. **F4** — opraviť GDPR export na dáta klienta.
5. **F6 + F9** — AML blocker pred KZ + oprava audit retention. (+ registrácia povinnej osoby do 31.8.2026.)

## ZÁKONNÉ DEADLINY
- **31.8.2026** — registrácia Vianema ako AML povinná osoba (novela 73/2026).
- **1.1.2026** — DPH sadzba 23 %, eKasa pre hotovosť.

## ČO UŽ FUNGUJE SPRÁVNE (nemeniť)
Append-only audit log (migr. 080), AES-256-GCM šifrovanie dokumentov at-rest (`cryptoDocs.ts`), šifrované Google/TOTP tokeny, HSTS aktívny (`next.config.ts:39`), scope filtering na `klienti`/`obhliadky`/`nabery`, GDPR erasure cascade s re-auth, čisté PII v logoch, snapshot dodávateľa+odberateľa, DPH výpočet podľa dátumu.
