# Podklad pre právnika — bezpečnostný incident 2026-06-07 (GDPR oznamovacia povinnosť)

> **Účel:** Rýchly podklad, aby právnik vedel rozhodnúť o oznámení ÚOOÚ (čl. 33) a dotknutým osobám
> (čl. 34). Pripravené Compliance; technické fakty od Security. **Otázka na rozhodnutie je na konci.**
> Podrobný interný záznam: `security-audit/incident-2026-06-07-s3-s7.md`.

## 1. Subjekty
- **Prevádzkovateľ (controller):** Vianema s. r. o. (realitná kancelária).
- **Spracovateľ (processor):** Machovic s. r. o. (prevádzkovateľ CRM „os-machovic").
- **Prostredie:** `vianema.amgd.sk` — doteraz interné test/demo prostredie pre maklérov, ALE prod DB
  obsahuje **zmiešané reálne + testovacie dáta** (~28 reálnych klientov z 62). Reálne dotknuté osoby
  sú teda v hre.

## 2. Čo sa stalo
Pri internom audite (2026-06-07) sa zistilo, že **celá bezpečnostná „hardening" vrstva existuje len
na vývojovej vetve (`dev`) a nikdy nebola nasadená na ostrý server** (`main`, ~93 commitov pozadu).
Dôsledok: **~12 API endpointov vystavujúcich osobné údaje klientov bolo prístupných anonymne** (bez
prihlásenia), naprieč firmami, cez verejný internet.

Dotknuté endpointy (okrem iných): história interakcií klienta, dopyty kupujúcich, voľní klienti,
matching (mená+telefóny), odberatelia faktúr (IČO/DIČ/email), manažérske/SLA prehľady, kalendár/
obhliadky, provízie, prevádzkové logy (s telefónmi), pobočky.

## 3. Dotknuté údaje a osoby
- **Osoby:** klienti RK (predávajúci, kupujúci, záujemcovia); čiastočne tretie osoby (spoluvlastníci
  na LV, príjemcovia faktúr — pri živnostníkoch ide o osobné údaje).
- **Údaje:** meno, telefón, e-mail, lokalita, požiadavky kupujúcich, história komunikácie (voľný
  text), IČO/DIČ. **Nie** osobitná kategória (čl. 9) cez tieto endpointy (žiadne zdravotné údaje;
  rodné číslo/OP idú cez iný, šifrovaný a teraz už chránený kanál).

## 4. Časová os (okná expozície)
- S3 (história interakcií): od **2026-05-11** (~27 dní). S7 (cron): od **2026-04-26** (~42 dní).
- Ostatné endpointy: okná dopĺňa Security z git histórie. Rádovo **týždne**.
- **Zistené (awareness):** 2026-06-07. Diery sa zatvárajú hotfixom v ten istý deň.

## 5. Bola diera reálne zneužitá?
- **Žiadny dôkaz zneužitia.** Nález je interný (audit), nie nahlásený útok.
- **Prístupové logy sú TRVALO nedostupné** (Vercel Hobby bez log drains/ephemeral; Supabase Free
  ~1-dňová retencia). ⇒ Skutočný neoprávnený prístup **nemožno ani potvrdiť, ani vylúčiť**.

## 6. Predbežné posúdenie Compliance (na ratifikáciu právnikom)
Závisí od jednej technickej skutočnosti — či boli zoznamové endpointy **bulk-enumerable**:
- **Ak boli „id-gated"** (vyžadovali znalosť konkrétneho UUID, ako potvrdený matching) → masové
  stiahnutie nereálne → **nízke riziko**; obhájiteľné NEoznamovať, len zaevidovať.
- **Ak boli „bulk"** (anonymný dotaz vrátil celé zoznamy klientov bez ID) → triviálne masové
  stiahnutie reálnych PII počas týždňov → **stredné–vysoké riziko**; výnimka čl. 33/1 „unlikely to
  result in a risk" **ťažko udržateľná** → **odporúčame oznámiť ÚOOÚ** (a posúdiť čl. 34 voči
  klientom).
- **Stav k teraz:** matching potvrdený id-gated (nízke). Rozhodujú ešte: `objednavky`, `odberatelia`,
  `logy`, `manazer/sla` — Security overuje (koľko riadkov vráti anonymný dotaz).

## 7. Lehota
72-hodinová lehota (čl. 33 ods. 1) formálne plynie od zistenia *porušenia* (nie len zraniteľnosti);
potvrdené porušenie (prístup) nie je. Pri **precautionary** oznámení však odporúčame brať
**awareness = 2026-06-07** ako začiatok a nepremeškať rámec.

## 8. OTÁZKA NA ROZHODNUTIE PRÁVNIKA
1. Na základe vyššie uvedeného (a po doplnení bulk-vs-id-gated výsledku) — **oznámiť ÚOOÚ podľa
   čl. 33? ÁNO / NIE** a v akej lehote?
2. **Informovať dotknuté osoby (klientov) podľa čl. 34?** (relevantné najmä ak bulk).
3. Je nutné/odporúčané niečo nad rámec interného záznamu (napr. dobrovoľné oznámenie z opatrnosti)?

Doplnkové: konzistentnosť retencie AML 5 r. vs dokumenty k nehnuteľnosti 7 r.; informačná povinnosť
čl. 14 voči spoluvlastníkom z LV a scrapovaným predajcom (Monitor) — viď `plan-compliance-gaps.md`.
