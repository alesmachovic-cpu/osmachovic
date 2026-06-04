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
