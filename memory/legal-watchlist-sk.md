# Legal Watchlist — Slovenské reality + GDPR + AML + dane

> **Vlastní**: JUDr. Katarína Bartošová (E018) Compliance + PhDr. Adam Vrabec (E016) Security Auditor.
> **Refresh**: mesačne (1. v mesiaci) Compliance Officer + Inspector General review.
> **Vznikol**: 2026-05-19 z web research (zdroje na konci dokumentu).

## 🚨 Aktuálne platné a aktívne (musíme rešpektovať dnes)

### 1. Zákon č. 246/2015 Z.z. — Realitná činnosť
- Aktuálne znenie. Definuje povinnosti realitných maklérov + RKty.
- Hlavné: odbornosť, povinné zmluvy (sprostredkovateľská, exkluzívna), inzerovanie pravdivých údajov.
- **VIANEMA dopad**: Náberové listy = sprostredkovateľská zmluva. Vianema musí dbať na pravidelné AML/odbornostné aktualizácie maklérov.

### 2. Zákon č. 18/2018 Z.z. — Ochrana osobných údajov (slovenská GDPR implementácia)
- Doplňuje EÚ Nariadenie 2016/679 (GDPR) o slovenské špecifiká.
- **VIANEMA dopad**: Všetka klient PII (meno, telefón, email, OP, rodné číslo). 8 audit log routes z 84 = nedostatočne, P0 ticket #2.

### 3. Zákon č. 297/2008 Z.z. — AML (Ochrana pred legalizáciou príjmov)
- Aktuálne s novelou **účinnou 15.1.2025**.
- Realitné kancelárie sú **povinné osoby** (§ 5).
- Identifikácia KUV (konečný užívateľ výhod) povinná pri obchodoch **>15 000 EUR**.
- Sankcie za nedodržanie sa zvyšujú.
- **VIANEMA dopad**: KZ podpis pre nehnuteľnosť (typicky 100k+) = vždy AML check. Aktuálne nie je hard blocker (P1 ticket #8 v roadmap).

### 4. Zákon č. 222/2004 Z.z. — DPH
- Provízia maklera = poskytnutie služby vzťahujúca sa k nehnuteľnosti.
- Miesto plnenia = kde sa nehnuteľnosť nachádza (väčšinou SK).
- **VIANEMA dopad**: Faktúry s DPH 23% (od 1.1.2026 zmena z 19%), retention 10 rokov.

### 5. Zákon č. 595/2003 Z.z. — Daň z príjmov
- Realitný maklér ako SZČO → daňové priznanie elektronicky.
- Retention účtovných dokladov **10 rokov**.

---

## ⏰ Nadchádzajúce zmeny (rok 2026/2027) — pripraviť VIANEMA

### A. 🆕 eKasa rozšírenie — od 1.1.2026 ⚠ KRITICKÉ
- **Čo**: Povinnosť evidovať hotovostné platby cez eKasa systém pre realitné kancelárie.
- **Dôsledok**: Každá prijatá hotovosť (provízia, kaucia, záloha) musí byť cez eKasa + pokladničný doklad.
- **Sankcia**: Vysoké pokuty pri zanedbaní.
- **VIANEMA action**: Treba **eKasa integrácia** alebo policy "len bezhotovostné platby". P0 ticket potrebný.

### B. 🆕 AML novela — zákon 73/2026 Z.z., deadline 31.8.2026 ⚠ KRITICKÉ
- **Čo**: Účinné od 14.4.2026. Registrácia povinných osôb (vrátane RKty) do **31.8.2026**.
- **Nové**:
  - Sprísnená identifikácia KUV (konečný užívateľ výhod)
  - Rozšírený zoznam rizikových krajín
  - Hlásenie neobvyklých obchodných operácií
- **VIANEMA action**: Zaregistrovať Vianemu ako povinnú osobu pred 31.8.2026. P0 ticket.

### C. 🆕 Digitálna identifikácia — eIDAS 2.0 od 2026 ⚠ HIGH
- **Čo**: Povinnosť overiť identitu klienta digitálne (online), nie len fyzicky.
- **Dôsledok**: AML check môže (musí) byť cez slovenský eID alebo bankový BankID.
- **VIANEMA action**: Integrácia s eID alebo BankID flow. P1 ticket, nezávisí od fyzickej obhliadky.

### D. 🆕 Nový GDPR zákon — od 1.1.2027 ⚠ HIGH
- **Čo**: Návrhy LP/2025/305 a LP/2025/306 nahradia 18/2018.
- **Nové**:
  - Sprísnené pravidlá pre osobitné kategórie údajov (zdravotné, biometrické)
  - Zákaz zverejňovania rodného čísla (s výnimkami)
  - **Povinnosť revidovať rizikové profily pri AI a automatizovanom spracovaní** ← VIANEMA AI Writer + analyze
  - Nové mechanizmy zodpovednosti (kódexy správania)
  - ÚOOÚ nové právomoci (kontrola softvérových riešení, záväzné usmernenia)
- **VIANEMA action**: AI usage transparency v privacy policy, rizikový profil pre Anthropic/Gemini/OpenAI spracovanie klient dát. P1 ticket.

### E. 🆕 Kataster nehnuteľností — od 1.7.2026
- **Čo**: Koniec anonymného prístupu, vyžaduje sa prihlásenie (eID).
- **Od 1.7.2027**: Poplatky 6 EUR za list vlastníctva, 12 EUR za mapu.
- **VIANEMA dopad**: Parse-doc workflow (LV upload) bude vyžadovať že maklér si LV stiahne prihlásený. Cost +6 EUR per LV. Treba zaúčtovať.

### F. 🆕 DPH zmena — od 1.1.2026
- Niektoré položky preč z 19% sadzby na základných 23%. Real estate služby zvyčajne 23%.
- **VIANEMA action**: Update daňových sadzieb v `/api/faktury/pdf` — P1 ticket.

---

## ⚖ EÚ úroveň — sledovať

### G. AML smernica EÚ 2024 (transponovaná do 2026)
- Centrálna AML autorita (AMLA) v EÚ.
- Jednotné pravidlá KUV.
- Beneficial ownership registers cross-border.

### H. EDPB usmernenia
- Nové guidelines pre AI a automated decision-making.
- VIANEMA musí byť aligned (AI Writer = automated processing of klient data).

### I. eIDAS 2.0 — európska digitálna identita
- Slovensko ju musí implementovať do 2026.
- EU digital identity wallet — VIANEMA by mohla akceptovať.

---

## 📋 Action items (pridať do roadmap)

| # | Akcia | Doména | Priority | Deadline |
|---|---|---|---|---|
| L1 | Registrovať VIANEMA podľa AML novely 73/2026 | Compliance | P0 | **31.8.2026** zákonný deadline |
| L2 | eKasa integrácia alebo policy "iba bezhotovostné" | Financie + Náberáky | P0 | **1.1.2026 už platí** |
| L3 | AML hard blocker pred KZ (KUV identifikácia >15k) | Náberáky + Compliance | P0 | ASAP |
| L4 | Digitálna identifikácia (eID / BankID) integrácia | Klienti + Security | P1 | 2026 priebeh |
| L5 | AI privacy disclosure v Privacy Policy | Compliance + AI | P1 | Pred 1.1.2027 |
| L6 | Update DPH sadzieb v faktúrach (19→23%) | Financie | P1 | Skontrolovať či už uplatnené |
| L7 | Audit log na 100% write operácií (z 6%) | Compliance + všetci Tech Leads | P0 | Q2 2026 |
| L8 | Zákaz zverejnenia rodného čísla — code audit | Security + Compliance | P1 | Pred 1.1.2027 |
| L9 | Kataster eID flow: maklér prihlásený pri LV download | Náberáky + Google | P2 | 2027 |
| L10 | Cost tracking eKasa + kataster poplatky | Financie | P2 | 2027 |

---

## 🔄 Watch cadence

| Frekvencia | Robí | Čo |
|---|---|---|
| **Týždenne** | Compliance (Katarína) | Skim ÚOOÚ news, FIU SR aktualizácie |
| **Mesačne** | Compliance + Inspector G | Hlbší audit zdrojov, update tohto watchlistu |
| **Kvartálne** | CEO + Compliance | Strategický review, action priorities |
| **Pri novele** | Compliance | Okamžite analyzovať dopad, navrhnúť code zmeny |

---

## 📚 Zdroje (refresh-uj pri update)

### Oficiálne
- ÚOOÚ SR — https://dataprotection.gov.sk/
- Ministerstvo financií SR — https://www.mfsr.sk/sk/dane-cla-uctovnictvo/
- Finančná správa SR — https://www.financnasprava.sk/
- NRSR.sk (pripravované návrhy) — https://www.nrsr.sk/
- Zákony pre ľudí — https://www.zakonypreludi.sk/zz/novo-ucinne/2026-1

### Odborné
- Realitná únia SR — https://www.realitnaunia.sk/
- ZRKS (Združenie realitných kancelárií Slovenska) — https://www.zrks.sk/
- NARKS — https://www.narks.sk/
- Slovenská realitná akadémia — https://www.sora.sk/

### Compliance špecialisti
- Konečná & Zacha (právnici) — https://www.konecna-zacha.com/
- Semančín & Partners (AML pokuty) — https://semancin.sk/
- AMLko (AML praktická aplikácia) — https://amlko.sk/

### EÚ
- EDPB — https://edpb.europa.eu/
- IAPP — https://iapp.org/

---

## 📌 Posledná aktualizácia

**2026-05-19** — Initial research (Claude AI cez WebSearch). Pokryté: 246/2015, 18/2018, 297/2008, 222/2004, kataster novela, eKasa, eIDAS, GDPR návrh LP/2025/305-306.

**TODO**: Mesačná refresh — Katarína + IG review zdrojov, update aktuálneho stavu.
