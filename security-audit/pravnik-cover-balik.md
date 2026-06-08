# Sprievodný list pre právnika — GDPR/compliance balík (RK Vianema / CRM os-machovic)

**Dátum:** 2026-06-07 · **Pripravil:** Compliance (interne) · **Pre:** externý advokát (GDPR + realitné právo)

Dobrý deň, prosíme o právnu kontrolu a rozhodnutie v nižšie uvedených bodoch. Dokumenty sú interné
návrhy pripravené pred prechodom CRM do ostrej prevádzky s reálnymi klientmi. **Otázky 1–12 sú veci,
o ktorých má rozhodnúť právnik** (my sme ich zámerne nechali otvorené, lebo presahujú interné
posúdenie).

## Dokumenty na kontrolu (v repo `security-audit/`)
1. **`ropa-cl30.md`** — Záznam o spracovateľských činnostiach (čl. 30 GDPR), 20+ činností.
2. **`register-dpa.md`** — register subprocesorov (čl. 28) + hlavná zmluva Vianema↔Machovic.
3. **`incident-2026-06-07-s3-s7.md`** — záznam o bezpečnostnom incidente (čl. 33/5) + naše posúdenie.
4. **`retention-policy.md`** — politika uchovávania (lehoty + právne základy).
5. **`pravnik-brief-incident-2026-06-07.md`** — stručný podklad k incidentu.
6. Verejné zásady: `src/app/gdpr/page.tsx` (v2.2).

## Kľúčové roly
- **Prevádzkovateľ:** Vianema s. r. o. · **Spracovateľ:** Machovic s. r. o. (CRM).
- Subprocesori v zásadách: Supabase, Vercel, Resend, Google, Anthropic, OpenAI, Nominatim/OSM.

---

## A. Na ratifikáciu: posúdenie incidentu (oznamovacia povinnosť)
Dňa 2026-06-07 sme interným auditom zistili, že viaceré API endpointy boli na ostrom serveri dočasne
prístupné bez prihlásenia (~16 endpointov, okná rádovo týždne; príčina: bezpečnostné opravy boli len
na vývojovej vetve). **Všetky sú zatvorené a overené.** Naše posúdenie: **neoznamovať ÚOOÚ ani
dotknutým osobám** — žiadny endpoint nevystavil priame identifikátory hromadne (jediný „bulk" obsahoval
3 pseudonymné záznamy bez mien/telefónov; ostatné vyžadovali konkrétne ID), žiadny dôkaz prístupu,
nález interný → výnimka čl. 33/1 „unlikely to result in a risk". **Prosíme o ratifikáciu tohto záveru**
(prístupové logy sú trvalo nedostupné — prístup nemožno potvrdiť ani vylúčiť).

## B. Otázky na rozhodnutie (1–12)
1. **Obhliadkový list — právny základ:** PDF dnes obsahuje vetu „súhlasím so spracovaním OÚ" (čl. 6/1/a),
   no RoPA priraďuje čl. 6/1/b+f. Ktorý je správny? (Od toho závisí prepis vety v PDF.)
2. **Marketingová re-permission (consent-refresh):** je oslovenie existujúceho klienta e-mailom prípustné
   cez § 62 ods. 3 zák. 351/2011 („vlastný podobný produkt") + čl. 6/1/f, alebo treba predošlý súhlas?
3. **Scraping konkurenčných inzerátov:** obstojí oprávnený záujem (čl. 6/1/f) na transientnom spracúvaní
   + profilovaní PII súkromných predajcov? Ako splniť informačnú povinnosť čl. 14 (verejné oznámenie vs
   odôvodnená výnimka čl. 14/5/b)?
4. **AML prah identifikácie:** zladiť 10 000 € (hotovostný, § 10/1/a) vs 15 000 € (interný proces). Pri
   nehnuteľnosti je identifikácia povinná pri vzniku obchodného vzťahu — potvrdiť správne znenie.
5. **AML paragrafy zák. 297/2008:** je ohlásenie neobvyklej obchodnej operácie FSJ § 17 (nie § 15)?
   Doplniť § 11 (overenie identifikácie).
6. **Rodné číslo § 78 zák. 18/2018:** ktorý presný odsek sa uplatňuje na spracúvanie RČ?
7. **Zákon 170/2024 o realitnom sprostredkovaní:** povinné náležitosti zmluvy, predzmluvné info,
   poistenie zodpovednosti, registrácia (MDV SR), odborná spôsobilosť — čo premietnuť do dokumentov a
   generátora zmlúv?
8. **Postavenie maklérov:** SZČO spolupracovníci alebo zamestnanci? Ak zamestnanci, monitoring výkonu
   (SLA) spadá pod § 78 ods. 2 zák. 18/2018 (informačná povinnosť o monitoringu).
9. **GDPR export (právo na prístup):** je to samostatný účel s čl. 6/1/c, alebo súčasť pôvodného
   spracúvania (accountability)?
10. **Úschovná zmluva (ÚZ):** má notárska/advokátska úschova vlastný právny režim relevantný pre RoPA
    (banka/notár ako príjemca)?
11. **Anthropic DPA:** potvrdiť, či je pre API zmluvne zabezpečená zero-/krátka retencia a no-training
    (cez Anthropic idú aj rodné čísla / kópie OP klientov).
12. **Daňový režim Vianema:** `ic_dph` je vyplnené, ale `platca_dph=false` — je firma platiteľom DPH?
    (Od toho závisí rozpis DPH na faktúrach.) — potvrdiť s účtovníkom.

## C. Mimo právnika (interné handoffy — len na vedomie)
- **Technická oprava retencie:** F11 anonymizačný cron nečistí snapshot PII v `produkcia_objednavky`
  ani `kolizny_log` → odovzdané vývoju (okno Klienti).
- **Doplniť read-audit-log** na PII endpointy (prevencia) → vývoj (okno Bezpečnosť).
- **Hlavná sprostredkovateľská zmluva Vianema↔Machovic (čl. 28)** + DPA subprocesorov — uzavrieť/doložiť.
