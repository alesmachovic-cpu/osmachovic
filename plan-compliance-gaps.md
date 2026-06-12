# Compliance Gap Map — kompletný re-audit (2026-06-04)

Dôkladný re-audit celého CRM (3 paralelné compliance sweepy + verifikácia v kóde).
Tentoraz vyčerpávajúco — prvý audit (F1–F14) minul viacero P0. Každý nález =
**zadanie pre príslušného vývojára/agenta** (CEO si želá len právnu časť, implementáciu deleguje).

Legenda vlastníkov: **DB/Klienti** (Petra/klienti-owner) · **Security** (security-owner) ·
**Finance** (financie-owner) · **Monitor** (monitor-owner) · **Náberáky/Zmluvy** (naberaky-owner) ·
**CEO/Právnik** (mimo kódu).

---

## 🔴 P0 — zákonné riziko, riešiť hneď

### G1 — Rodné číslo prežíva GDPR výmaz + chýba v exporte ✅ OPRAVENÉ 2026-06-04
**Hotové:** erasure teraz anonymizuje `vyhradne_zmluvy.majitelia` (zmaže RČ/meno/bydlisko/kontakt, zmluvu-škrupinu + nehnuteľnosť nechá); export doplnený o `vyhradne_zmluvy` + `consents`. Overené: tsc, audit-all 20=20.
**Overené:** `vyhradne_zmluvy.majitelia` (JSONB, migr. 068) ukladá `{meno, datum_narodenia, rc, bydlisko...}`. `gdpr/erasure/route.ts` sa `vyhradne_zmluvy` **vôbec nedotýka** (0 výskytov) a klient sa len anonymizuje (nie DELETE → cascade sa nespustí). RČ + meno + adresa vlastníkov ostanú po výmaze. Chýba aj v `gdpr/export`.
**Zákon:** GDPR čl. 17 (výmaz), čl. 15/20 (export), § 78 zák. 18/2018 (rodné číslo).
**Zadanie (DB/Klienti):** erasure doplniť o anonymizáciu/zmazanie `vyhradne_zmluvy` (pozor na prípadnú retenciu zmlúv); export doplniť o `vyhradne_zmluvy` + `consents`. **Compliance-critical → CEO červené upozornenie pred zmenou.**

### G2 — Anon RLS leak na monitor snapshots (PII súkromníkov) ✅ OPRAVENÉ 2026-06-04
**Hotové:** migr. 106 dropla `anon_read_monitor_snapshots` + `anon_read_monitor_disap`. Čítanie ide cez API (service_role) — anon policy bola zbytočný leak. Overené: audit-anon-rls ✓, audit-all 20=20.
**Overené:** migr. 035 — `anon_read_monitor_snapshots` aj `anon_read_monitor_disap` majú `FOR SELECT TO anon USING (true)`. Snapshot JSONB obsahuje `predajca_meno`/`predajca_telefon`. → PII čitateľné **anonymným** kľúčom. Porušuje aj CLAUDE.md („Žiadny USING (true) FOR anon").
**Zadanie (Security):** zrušiť anon SELECT policy, povoliť len `authenticated`/`service_role`. Rýchly RLS fix, netreba rozhodnutie CEO.

### G3 — Monitor ukladá osobné údaje súkromných predajcov bez podkladu
**Overené:** `monitor_inzeraty.predajca_meno/telefon`, filter `len_sukromni` cielene berie fyzické osoby, `notifyKupujuciMatches` servíruje kontakt maklérovi = cold-contact pipeline.
**Zákon:** GDPR čl. 6 (základ), čl. 14 (informačná povinnosť pri zbere nie od subjektu — úplne chýba), zák. 351/2011 (nevyžiadaná komunikácia).
**Zadanie (Monitor) — data-minimizácia (CEO schválil):** viď samostatná špecifikácia nižšie (sekcia „MONITOR HAND-OFF").

### G4 — DPIA (posúdenie vplyvu, čl. 35) chýba
**Overené:** žiadna DPIA. Min. dve vysoko-rizikové spracovania: (a) monitor scraping + profilovanie súkromníkov, (b) AI parsovanie LV/posudkov (meno, dátum narodenia → Anthropic USA).
**Zadanie (CEO/Právnik):** spracovať DPIA (dokument, nie kód) — najmä pre monitor.

### G5 — Zákon 170/2024 o realitnom sprostredkovaní — systém o ňom nevie
**Overené:** `grep "170/2024"` = 0. Výhradná zmluva (`vyhradna-zmluva/pdf`) sa odvoláva len na OZ 40/1964. Chýba: povinné náležitosti sprostredkovateľskej zmluvy, predzmluvné info, evidencia poistenia zodpovednosti, register sprostredkovateľov, odborná spôsobilosť. (`firma_info.poistovna` + `cislo_licencie` existujú ale prázdne.)
**Zadanie (CEO/Právnik + Náberáky):** právnik overí presné náležitosti 170/2024 → doplniť do generátora zmluvy + hlavičku. Overiť registračnú povinnosť (MDV SR) + odbornú spôsobilosť.

---

## 🟠 P1 — riešiť v rámci týždňov

### G6 — Poistenie zodpovednosti verejne sľúbené, systém needviduje ✅ OPRAVENÉ 2026-06-04
**Hotové:** etický kódex + obchodné podmienky prevedené na async + `getFirmaInfo` → poistenie sa zobrazí **len keď je `firma_info.poistovna` vyplnené** (data-driven, ako už robí o-nas). Keď CEO doplní reálnu poistku, automaticky sa ukáže; pokým je prázdne, žiadne nepravdivé tvrdenie. Overené: tsc 0 chýb, audit-all 20=20. **Pozn.: zákon 170/2024 môže poistenie pre RK vyžadovať — over u právnika (G5).**
VOP (bod 4) + etický kódex tvrdia poistenie; `firma_info.poistovna` prázdne, nikam sa nevkladá. **Rovnaký typ nepravdy ako odstránený „Penetračné testy Q3".** **Zadanie:** zaevidovať reálnu poistku, alebo odstrániť verejný sľub. **+ regression check: žiadne verejné tvrdenie o licencii/poistení/členstve bez naplneného `firma_info` poľa.**

### G7 — E-podpis označený „právne záväzný" bez uvedenia limitov ✅ OPRAVENÉ 2026-06-04
**Hotové:** text v zmluve PDF zmenený na „jednoduchý elektronický podpis (OTP + časová pečiatka + IP)" + dodatok že pri listinách vyžadujúcich úradné overenie (KZ, vklad) nenahradza úradné osvedčenie. (OTP metadata už zmluva obsahovala.) Follow-up: OTP metadata aj do obhliadkového PDF (drobnosť). Overené: tsc.
OTP + IP + timestamp = jednoduchý elektronický podpis (eIDAS čl. 3/10) — platný, ale PDF zmluvy tvrdí „právne záväzný" bez uvedenia že KZ vyžaduje úradné overenie. Obhliadkové PDF navyše nevypisuje OTP metadata. **Zadanie (Náberáky):** upraviť text (jednoduchý e-podpis + limity), doplniť OTP metadata do obhliadkového PDF.

### G8 — RoPA (záznamy o spracovateľských činnostiach, čl. 30) chýba
Povinný interný register (účely, kategórie, príjemcovia, lehoty, prenosy). Stavebné bloky rozhádzané (retention, subprocesori) — skonsolidovať. **Zadanie (CEO/Compliance):** vytvoriť RoPA dokument.

**📋 GO-LIVE CHECKLIST — feature „LV súbor do klient_dokumenty" (verdikt 2026-06-07, zelená):**
- ✅ **PRIPRAVENÉ na dev (necommitnuté, čaká na go-live):**
  - `src/app/gdpr/page.tsx` → **v2.1**: nový právny základ (sekcia 4, čl. 6/1/b+f vrátane spoluvlastníkov), doba uchovávania LV (sekcia 7), zdroj údajov z katastra (sekcia 3, čl. 14). Lint 0 chýb.
  - `security-audit/retention-policy.md` → riadok „Dokumenty k nehnuteľnosti (LV/výpis z katastra) — 7 r., základ b+f, `aml_retention=false`".
- ⏳ **Pri go-live ešte spraviť:** plný RoPA dokument (toto G8) — LV kategória tam patrí prirodzene; commit + deploy zásad v2.1 (legal text → vyžaduje finálne OK CEO).
- Pozn.: teraz len test dáta → žiadna okamžitá povinnosť. Odovzdá sa do `plan-release.md`, keď ho MD vytvorí.

### G9 — Breach register (tabuľka) chýba ✅ OPRAVENÉ 2026-06-04
**Hotové:** migr. 108 `breach_register` (čl. 33 ods. 5) + `/api/gdpr/breach` (admin POST/GET). Tabuľka otestovaná (insert/select/delete). Follow-up: admin UI na zobrazenie. RLS service-role only.
Playbook existuje, ale evidencia incidentov (čl. 33 ods. 5) ako tabuľka nie. **Zadanie (DB):** tabuľka `breach_register` + určená zodpovedná osoba.

### G10 — Privacy policy nepokrýva scrapované tretie osoby
`gdpr/page.tsx` pokrýva len klientov, nie osoby zo scrapovaných inzerátov (monitor profilovanie). **Zadanie:** doplniť informačnú vrstvu / čl. 14 disclosure.

### G11 — Evidencia podpísaných DPA
`/bezpecnost` tvrdí DPA/SCC so subprocesormi, ale podpis (najmä Anthropic) nie je doložený. **Zadanie (CEO):** podpísať/overiť DPA, viesť evidenciu.

### G12 — Faktúra umožňuje „Hotovosť" napriek policy „len bezhotovostne"
`faktury/nova/page.tsx:181` `<option>Hotovosť</option>`. Otvára hotovostný príjem mimo evidencie (AML riziko). `prehlad` write nemá logAudit. **Zadanie (Finance):** odstrániť Hotovosť option, doplniť logAudit na prehlad.

### G13 — Práva subjektu neúplné: obmedzenie (18) + námietka (21)
**Stav:** 🟡 ČIASTOČNE. Podanie žiadosti UŽ funguje — `/api/gdpr/request` prijíma typy `restriction` aj `objection` (zaeviduje, admin spracuje do 30 dní = legálne). **Odložené (vedome, nie dead-scaffolding):** technické VYNÚTENIE „freeze" (flag enforcovaný pri každom čítaní) je veľký zásah; pre malú RK je manuálne spracovanie žiadosti dostatočné. Flag column dodať až s reálnym enforcement.

### G14 — GDPR erasure musí vynechať faktúry (overiť cascade)
Faktúry = 10r retencia (prebíja výmaz). Overiť že cascade delete klienta nezmaže `faktury`. **Zadanie (DB):** overenie.

### G15 — Audit log coverage 37 % (accountability, čl. 5 ods. 2)
`audit-compliance.sh` to hlási ako kritický fail (cieľ 80 %). **Zadanie (všetci owneri):** batch doplniť logAudit na write endpointy s PII.

---

## 🟡 P2 — roadmapa

- **G16** ⚠️ NEMENIŤ NASLEPO: odkaz „108/2024" v zmluve (r. 308) NIE je jasná chyba — **108/2024 Z.z. je NOVÝ zákon o ochrane spotrebiteľa (účinný 7/2024)**, ktorý nahradil 102/2014. Zmena na 102/2014 by zaviedla odkaz na starý zákon. **Treba právne overiť** správny zákon + §, neopravovať naslepo.
- **G17** Provízie: DPH-status makléra (platiteľ?), evidencia výplaty provízie.
- **G18** AML hranica: text `aml-poucenie` 10 000 € vs interný proces 15K — zladiť.
- **G19** ✅ OPRAVENÉ 2026-06-04: consent-refresh mail má one-click unsubscribe (`/api/consent-unsubscribe`, HMAC token, odvolá súhlas) + odkaz na /gdpr. (`G23` cookie-tracker audit check pridaný do audit-all.)
- **G20** 🟡 ODLOŽENÉ (vedome): pole „spôsob úschovy" je AML-relevantné, ale samotný stĺpec bez UI poľa v obchode = mŕtve lešenie. Dorobiť spolu s UI v ObchodTab (zadanie pre obchody doménu).
- **G23** ✅ OPRAVENÉ 2026-06-04: `scripts/audit-cookie-trackers.sh` (auto-beží v audit-all) — fail ak pribudne tracker bez zapnutého cookie banneru.
- **G21** Reverse charge cezhranične — dokumentovať ako známe obmedzenie.
- **G22** DPH `dphRates.ts`: položka 1993 rate kozmetická chyba.
- **G23** Cookie audit check: fail ak pribudne `gtag/fbq/...` bez zapnutia banneru.

---

## MONITOR — HAND-OFF ŠPECIFIKÁCIA (pre monitor-owner)

**Cieľ:** data-minimizácia — z monitora odstrániť osobné údaje, nechať len objekt + link.

**Prestať ukladať / odstrániť:** `predajca_meno`, `predajca_telefon`, `popis` (autorské právo), `raw_data` JSONB (alebo orezať len na neosobné polia — obsahuje meno/telefón/popis).
**Nechať (neosobné, objekt):** `url` (link), `typ`, `lokalita`, `cena`, `plocha`, `izby`, `predajca_typ` (klasifikácia), `foto_url` (odkaz), dátumy.
**Nadpis skladať z faktov:** napr. „Byt 2-izb · Bratislava-Petržalka · 149 900 € · bazoš → [link]".
**Plus:** zrušiť anon RLS (G2); interné pravidlo „monitor = len trhová analýza, ZÁKAZ kontaktovať predajcov z monitora"; retencia objektov (napr. 24 mes.); logAudit na scrape zápis; vypnúť/obmedziť `notifyKupujuciMatches` cold-contact.

**⚠️ Čo data-minimizácia NEvyrieši (CEO musí vedieť):**
- **ToS portálov** (bazos/reality/nehnutelnosti) — scraping zakázaný + `scraper.ts` aktívne obchádza anti-bot (ScrapingBee CAPTCHA/Cloudflare bypass, fake User-Agent) → zmluvné/súťažné riziko (nekalá súťaž § 44+ ObchZ).
- **Databázové právo (§ 135+ AZ 185/2015)** — systematické sťahovanie podstatnej časti databázy ostáva, aj keď ukladáme len fakty.
- **Riešenie:** buď API/súhlas portálu, alebo CEO **písomne akceptuje zvyškové riziko**.

---

## Procesné odporúčania
- Vytvoriť `memory/role-compliance.md` (playbook ho označuje ako mandatory, neexistuje).
- Regression check na verejné tvrdenia (G6).
- Cookie tracker audit check (G23).

## RoPA audit nálezy (2026-06-07) — G8 dorobené, nové compliance medzery
**G8 RoPA HOTOVÉ (návrh):** `security-audit/ropa-cl30.md` (čl. 30, 20 spracovateľských činností) +
`security-audit/register-dpa.md` (čl. 28, register subprocesorov). Návrh — čaká revíziu CEO + právnika.

Nové compliance medzery odhalené pri stavbe RoPA:
- **G24 — Subprocesori chýbajú v zásadách sekcia 9:** OpenAI, Stripe, Twilio (SMS), ScrapingBee, (posúdiť) Nominatim/OSM sa reálne používajú, ale nie sú v privacy policy. **Doplnenie = 🔴 červený protokol (súhlas CEO).** Detail v register-dpa.md.
- **G25 — Hlavná sprostredkovateľská zmluva Vianema↔Machovic (čl. 28) nie je doložená** — uzavrieť písomne, uložiť do `legal/dpa/`. (P0 pred ostrou prevádzkou.)
- **G26 — čl. 14 pre tretie osoby:** spoluvlastníci z LV (kataster) + scrapovaní predajcovia (Monitor) sú spracúvaní bez ich vedomia — doložiť informačnú povinnosť/výnimku čl. 14 ods. 5.
- **G27 — Obhliadkový list PDF tvrdí „súhlas so spracovaním"**, no základ je oprávnený záujem (čl. 6/1/f) — zavádzajúci právny titul, zosúladiť znenie. (Náberáky + Compliance.)
- **G28 — Auto-vznik klientskej karty bez informovania** (kupujúci na obhliadke → záznam v klienti) — doplniť transparentnosť pri prvom spracovaní.
- **G29 — Chýbajúce retenčné lehoty:** pricing_estimates, monitor_inzeraty, analyzy_trhu, kolizny_log, signature_otps, in-app notifikácie — doplniť do retention-policy + cleanup.
- **G30 — AML retencia 5 r. vs dokumenty k nehnuteľnosti 7 r.** — overiť konzistenciu u právnika (súvisí F6/F14).
- **G31 — Faktúrne číslovanie = per DODÁVATEĽ/MAKLÉR (✅ POTVRDENÉ CEO 2026-06-09; faktúry sú REÁLNE vystavené):** Každý maklér má vlastné IČO a fakturuje províziu Vianeme ako samostatný dodávateľ (odberateľ = Vianema; schéma: makler_dodavatel migr. 029 per user + dodavatel_snapshot migr. 100). ⇒ účtovná jednotka pre číslovanie = MAKLÉR → poradové číslo unikátne v rámci radu DODÁVATEĽA (§ 74/1/b zák. 222/2004, § 8 zák. 431/2002 nemennosť). **3× FA20260001 od 3 maklérov = NIE duplicita.** **PROD index `(user_id, cislo_faktury)` (migr. 032) SPRÁVNY — zachovať. Dev migr. 075 `(company_id,…)` = REGRESIA → ✅ index opravený migr. 114.** V rámci 1 makléra: unique + sekvenčné + atomické (retry 23505) + nemenné po vystavení (oprava len storno + nová). Žiadny manuálny UPDATE čísel.
  - **DOPREDNÝ RISK — ✅ VYRIEŠENÉ + OVERENÉ COMPLIANCE (commit ca37ca9, 2026-06-09):** migr. 075 mala `UPDATE faktury SET cislo_faktury=…||'-DUP'…` (+VS) = mutácia vystavených faktúrnych čísel. Financie celú vecnú časť 075 zakomentovalo (no-op) — UPDATE-y aj company CREATE indexy. Overené (grep: 0 aktívnych príkazov v 075; migr. 114 drží per-maklér indexy). ⇒ žiadna migrácia už nemutuje vystavené číslo, prod migration sync je bezpečný. **Pravidlo do budúcna: faktúrne migrácie = len schéma/index, NIKDY UPDATE/SET na cislo_faktury/variabilny_symbol.**
  - **Dev artefakt DUP2** (`nikoleta-szalayova` = FA20260001-DUP2 z 075 dedupu): bez manuálneho UPDATE → vyriešiť re-seedom dev z produ alebo nechať do refreshu (dev nie sú reálne knihy; prod nedotknutý). Pôvodné posúdenie „per firma" som opravil (mylný predpoklad, že vystavovateľ je Vianema).
- **G33 — 🔴 GDPR erasure: evidencia + audit ticho nefungujú (BLOCKER pred go-live):** `/api/gdpr/erasure` má 3 medzery: (1) `gdpr_requests` tabuľka chýba (aspoň dev) → insert in_progress/completed ticho zlyháva → žiadosti o výmaz sa NEevidují; (2) `gdpr.erasure.*` sa nezapisuje do audit_log → žiadny forenzný trail; (3) Alešov test vrátil reálnu „1 chyba" → výmaz možno nedobehol celý, PII mohlo ostať. **Dopad:** čl. 5/2 (accountability — nevieme PREUKÁZAŤ vybavenie), čl. 12/3 (1-mes. lehota nepreukázateľná), čl. 17 (ticho čiastočný výmaz = právo nesplnené, falošný súlad). **BLOCKER pred ostrou prevádzkou.** Akceptačné kritériá: (a) gdpr_requests nasadené vrátane prod + spoľahlivá evidencia (prijatie/stavy/dokončenie/rozsah); (b) FAIL-CLOSED (ak sa neeviduje/neauditује → operácia zlyhá, nie ticho); (c) audit gdpr.erasure.* + gdpr.export do append-only audit_log; (d) žiadne tiché čiastočné zlyhanie — transakčné/all-or-reported, rozlíšiť Drive-manual (F5) od chyby; (e) preukázateľnosť 1-mes. lehoty; (f) root-cause „1 chyby" + over že PII reálne preč. Vlastník tech. opravy: Bezpecnost. Lekcia: compliance feature nie je hotová, kým jej evidencia+audit nie sú OVERENÉ že fungujú (nielen happy path). Súvisí RoPA Č.7, F4/F5.
  - **Root cause (overené 2026-06-11):** (1) „1 chyba" = erasure :149 maže z `podpis_otps` (neexistuje; správne `signature_otps`) — pod-krok, NIE hlavná anonymizácia (:185 beží nezávisle, PII klienta pravdepodobne preč; over anonymized_at). (2) gdpr_requests = migr. **066** existuje, nikdy neaplikovaná + insert :89 bez error-checku. **FIX = aplikovať 066** (má requested_at+completed_at → kritérium e ✓). 🔴 **ALE: 066 status CHECK = ('pending','in_progress','completed','rejected') NEobsahuje 'completed_with_errors' (kód :189 to zapisuje) ani 'failed' → rozšíriť CHECK, inak fail-loud/partial recording padne na CHECK.**
  - **🔴 signature_otps = čl. 17 úplnosť + čl. 5/1/e retencia:** erasure pre zlý názov nikdy nezmazal signature_otps (telefón/IP/podpis subjektu). OVERENÉ: signature_otps nemá cleanup cron (len `expires_at` = validita, nie mazanie) → PII pretrváva natrvalo. ⇒ (i) erasure MUSÍ mazať `signature_otps` (čl. 17 úplnosť) + vyčistiť zvyšky test md; (ii) signature_otps doplniť do retention-policy + cleanup cron (čl. 5/1/e — hromadí sa PII všetkých podpisujúcich; súvisí G29). RoPA Č.21 „TTL 15 min" = len validita, nie mazanie → zladiť.
  - **✅ FIX OVERENÝ COMPLIANCE (2026-06-11, daf8686+17f248c, migr. 066+115):** gdpr_requests schéma (klient_id/type/status/details/requested_at/completed_at/handled_by) spĺňa čl. 30 + 30d lehotu; status enum rozšírený (115); kód overený — fail-closed (evidencia+audit musia prejsť pred výmazom, inak 500 + status failed, dáta nedotknuté), signature_otps mazané cez entity_id, gdpr.erasure.* auditované. Kritériá a–f SPLNENÉ. Zostáva: prod deploy 066+115 (riadený) + finálne po Alešovom dev e2e (reálny priebeh) + signature_otps retencia (samostatne, G29).
  - **Legacy text-ID type-mismatch (e2e nález 2026-06-11):** gdpr_requests.user_id (uuid) zlyhal na legacy users.id='ales' (text) → fail-closed správne abortol (validoval kritérium b naživo). Fix uuid→text. 🔴 ROVNAKÝ problém: gdpr_requests.**handled_by** (uuid) + **breach_register.created_by** (migr. 108, uuid) → admin s text-ID by pri zápise breachu (čl. 33/5) zlyhal rovnako. Zjednotiť user-referencie na TEXT (konvencia audit_log migr. 012) naprieč accountability tabuľkami. audit_log = už TEXT, OK. → ✅ OPRAVENÉ migr. 116 (gdpr_requests user_id+handled_by) + 117 (breach_register.created_by).
  - **✅ E2E OVERENÉ + FINÁLNE COMPLIANCE OK (2026-06-11):** Alešov dev e2e + DB verifikácia naživo: gdpr_requests status=completed/errors=[], audit_log started+completed zapísané, signature_otps=0, klient [anonymized]/anonymized_at set/PII preč. Všetkých 6 kritérií a–f overených e2e. BEZ SECURITY DEFINER. **READY NA PROD** (066+115+116+117). Post-deploy overiť: gdpr_requests RLS aktívne (service-role-only); 117 vyžaduje 108 na prode; follow-up gdpr.export audit (čl. 15/20).
  - **✅ PROD DEPLOY ÚSPEŠNÝ (2026-06-11, overené naživo na vianeme):** gdpr_requests completed/errors=[]/text fix, audit_log started+drive+completed, klient [anonymized]/PII preč, curl 4 routes 401 (auth baseline 1:1 zachovaný cieleným 3-súborovým deployom). Kritériá a–f splnené aj na PRODE. Post-deploy check (Pravo): SQL pre Aleša = RLS gdpr_requests + test md PII + reziduálne signature_otps. **Export evidenčná medzera = FOLLOW-UP (nie blocker):** export je auditovaný (audit_log gdpr_export_subject/gdpr_export), ale nepíše do gdpr_requests → doplniť type='export' pre paritu (RoPA Č.7, vlastník Bezpecnost).
- **G32 — 🔴 Mazanie klienta (kôš) = tvrdý DELETE → musí byť anonymizácia (erasure flow):** Kôš v zozname klientov volá `DELETE /api/klienti` (raw `.delete()`) → na klientovi s faktúrami padne na FK alebo (cascade) zmaže faktúry = porušenie § 76 zák. 222/2004 (10 r. DPH) + § 8/431/2002 (nemennosť) + § 20 zák. 297/2008 (AML 5 r.). **VERDIKT (compliance): kôš = anonymizácia (`/api/gdpr/erasure`), NIE tvrdý DELETE.** Čl. 17 nie je absolútne (ods. 3 b/e — zákonná retencia + nároky) → anonymizovať PII, ponechať chránené záznamy. Podmienky: UI transparentne uvedie že anonymizuje + ponecháva faktúry/AML; re-auth + audit + company scope; heslo v POST body. **Tvrdý DELETE preč z UI; API guard: žiadny path nesmie tvrdo zmazať klienta s faktúrou/AML/obchodom.** Vlastník: Klienti okno. (Heslo v URL query = security nález → Bezpecnost.)

> **Bezpečnostné nálezy z RoPA discovery → odovzdané MD/Bezpecnosti (NIE compliance okno):** rad
> kandidátnych nechránených GET endpointov (faktury/pdf, obhliadky/pdf, objednavka-pdf, dodavatel,
> google/*, parse-lv, pricing/estimate, okolie-analysis, naber-analyza, kolize, email/kolizia),
> RLS USING(true) politiky (migr. 045/026/036), PII v logoch (google callback, calendar-sync).
> Treba overiť (časť môže byť whitelisted/authed) v rámci kompletného skenu anonymných endpointov.
