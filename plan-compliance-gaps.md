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
- **G32 — 🔴 Mazanie klienta (kôš) = tvrdý DELETE → musí byť anonymizácia (erasure flow):** Kôš v zozname klientov volá `DELETE /api/klienti` (raw `.delete()`) → na klientovi s faktúrami padne na FK alebo (cascade) zmaže faktúry = porušenie § 76 zák. 222/2004 (10 r. DPH) + § 8/431/2002 (nemennosť) + § 20 zák. 297/2008 (AML 5 r.). **VERDIKT (compliance): kôš = anonymizácia (`/api/gdpr/erasure`), NIE tvrdý DELETE.** Čl. 17 nie je absolútne (ods. 3 b/e — zákonná retencia + nároky) → anonymizovať PII, ponechať chránené záznamy. Podmienky: UI transparentne uvedie že anonymizuje + ponecháva faktúry/AML; re-auth + audit + company scope; heslo v POST body. **Tvrdý DELETE preč z UI; API guard: žiadny path nesmie tvrdo zmazať klienta s faktúrou/AML/obchodom.** Vlastník: Klienti okno. (Heslo v URL query = security nález → Bezpecnost.)

> **Bezpečnostné nálezy z RoPA discovery → odovzdané MD/Bezpecnosti (NIE compliance okno):** rad
> kandidátnych nechránených GET endpointov (faktury/pdf, obhliadky/pdf, objednavka-pdf, dodavatel,
> google/*, parse-lv, pricing/estimate, okolie-analysis, naber-analyza, kolize, email/kolizia),
> RLS USING(true) politiky (migr. 045/026/036), PII v logoch (google callback, calendar-sync).
> Treba overiť (časť môže byť whitelisted/authed) v rámci kompletného skenu anonymných endpointov.
