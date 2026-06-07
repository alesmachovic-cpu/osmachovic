# GDPR — rozhodovací rámec: kedy je expozícia endpointu oznamovateľný breach

> **Stav k 2026-06-07:** Archivované ako referencia pre **budúcnosť**. Vznikol pri náleze
> S3 (`/api/klient-udalosti` GET bez auth) a S7 (`/api/cron/volni-klienti` verejný cron),
> ktoré boli technicky reálne (anonymne exploitovateľné na `vianema.amgd.sk`), **ale v tom
> čase boli na vianeme aj dev len FIKTÍVNE testovacie dáta — žiadne reálne dotknuté osoby.**
> Preto vtedy **nevznikla žiadna oznamovacia povinnosť** (ÚOOÚ ani Machovic→Vianema), žiadny
> breach register. Tento dokument hovorí, **čo bude platiť, keď vianema pôjde do ostrej
> prevádzky s reálnymi klientmi** — vtedy sa rovnaký typ nálezu posudzuje úplne inak.

Pozn.: nie je to právny posudok advokáta; je to interný rozhodovací rámec pre rýchle
posúdenie. Pri reálnom incidente vždy konzultovať s právnikom.

---

## Role (GDPR)

- **Prevádzkovateľ (controller)** = realitná kancelária (napr. Vianema s.r.o.) — má reálnych
  klientov, určuje účel spracúvania. **Oznamuje ÚOOÚ a dotknutým osobám.**
- **Spracovateľ (processor)** = Machovic s.r.o. — prevádzkuje CRM. **Oznamuje incident
  prevádzkovateľovi „bez zbytočného odkladu" (čl. 33 ods. 2).** Sám ÚOOÚ neoznamuje.
- Sub-spracovatelia: Anthropic, Supabase, Google, Resend, Vercel.

---

## Dve osi, ktoré rozhodujú o VŠETKOM

Pri každom náleze typu „endpoint vystavuje osobné údaje" sa pýtaj na dve nezávislé otázky:

### Os A — Sú dáta reálne?
Sú v systéme osobné údaje **identifikovateľných žijúcich fyzických osôb**, alebo len fiktívne
testovacie dáta?
- Len fiktívne → **GDPR sa neuplatní**. Žiadne hlásenie, len opraviť kód.
- Reálne → GDPR platí naplno (viď Os B).

> ⚠️ **Pasca:** ak makléri pri „testovaní" zadajú reálnych klientov (reálne mená, telefóny,
> poznámky) — čo je pri onboardingu RK softvéru bežné — **nie sú to test dáta, sú reálne.**
> „Testovacie prostredie" neznamená „testovacie dáta".

### Os B — Je prostredie reálne nedostupné zvonku?
- **Sieťovo izolované** (VPN, IP whitelist, infra-login, nie je verejne dosiahnuteľné) →
  riziko nízke; ak sa k tomu dostal len okruh oprávnených (makléri), spravidla **nejde
  o breach navonok**.
- **Technicky verejné** (URL dostupná hocikomu z internetu, hoci „určená pre maklérov") →
  expozícia sa blíži verejnej.

> ⚠️ **Najčastejšia chyba:** „interné prostredie pre maklérov" je **účel použitia**, nie
> technické prístupové opatrenie. Ak Bezpečnosť potvrdí, že endpoint je **anonymne**
> dosiahnuteľný z internetu, prostredie NIE je izolované — bez ohľadu na to, ako sa „volá".

---

## Rozhodovacia matica

| Os A (dáta) | Os B (prístup) | Záver |
|---|---|---|
| Fiktívne | hocijaké | GDPR neplatí → **len opraviť kód**, žiadne hlásenie |
| Reálne | Izolované (len oprávnení) | Spravidla **nie breach navonok** → opraviť + interný záznam |
| Reálne | Technicky verejné | **Posudzovať ako potenciálny breach dôvernosti** → viď nižšie |

---

## Ak Reálne + Technicky verejné (najvážnejší scenár)

1. **Klasifikácia (čl. 4 bod 12):** porušenie ochrany = neoprávnený prístup. Samotná
   zraniteľnosť *bez* prístupu ešte nie je „breach"; **ale** ak je endpoint anonymne dostupný
   a **chýba audit log** → prístup sa nedá vylúčiť → posudzuj ako breach.
2. **Spracovateľ → prevádzkovateľ (čl. 33 ods. 2):** Machovic informuje RK **bezodkladne**.
3. **ÚOOÚ (čl. 33 ods. 1):** povinnosť LEN ak je riziko pre práva osôb. Aplikuj test
   *„unless unlikely to result in a risk"*. Pri bežných kontaktných/operatívnych dátach +
   bez dôkazu prístupu → riziko skôr nízke; pri citlivom obsahu voľnotextových poznámok +
   nevylúčiteľnom prístupe → prikloniť sa k oznámeniu. **Rozhodne právnik.**
4. **Dotknuté osoby (čl. 34):** len pri **vysokom** riziku (prísnejší test). Bežné kontaktné
   dáta → spravidla nie. Citlivý obsah → áno.
5. **Vždy zaevidovať** do interného breach registra — vrátane rozhodnutia *„neoznamujeme a
   prečo"* (čl. 33 ods. 5, čl. 5 ods. 2 — accountability).

### Lehota 72 h
Beží od momentu, keď **prevádzkovateľ** nadobudne istotu, že ide o **oznamovateľný breach**
(reálne dáta + reálny/nevylúčiteľný neoprávnený prístup). Fáza „ešte zisťujeme, či ide o
osobné údaje" lehotu **nespúšťa**.

### Vedomé odloženie opravy
Ak **Reálne + Technicky verejné**, odkladať opravu živej anonymnej diery je z compliance
pohľadu **neobhájiteľné** (čl. 32 — bezpečnosť spracúvania). Vtedy dieru **aspoň dočasne
zavrieť hneď** (vypnúť endpoint / pridať auth), nečakať na „peknú" opravu cez dev.
Pri Fiktívnych dátach alebo Izolovanom prostredí je štandardný odklad opravy akceptovateľný.

---

## Sprievodný accountability nedostatok
Chýbajúci **audit log prístupu k PII** (čl. 5 ods. 2) je samostatný problém — práve kvôli
nemu sa pri reálnom incidente nedá overiť rozsah prístupu. Oprava = logovať prístup k
citlivým read endpointom (rieši Bezpečnosť).
