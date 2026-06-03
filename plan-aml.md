# Plán: AML (F6) — identifikácia klienta + hard blocker pred KZ

**Stav:** NÁVRH — čaká na schválenie CEO + právne overenie pred kódom.
**Zákon:** 297/2008 Z.z. (AMLZ) — RK je povinná osoba podľa § 5 ods.1 písm. h).
**Dozor:** Finančná spravodajská jednotka (FSJ/FIU) pri NAKA.

> ⚠️ **Pred ostrým nasadením daj celý tento podklad skontrolovať AML právnikovi.**
> Body označené 🔶 = TREBA PRÁVNE OVERIŤ.

---

## 1. Prečo to riešime (riziko)
Jedno vážne AML pochybenie = pokuta **až do 1 000 000 €** (§ 33) + možný zákaz činnosti + trestnoprávna zodpovednosť. Nehnuteľnosti sú vždy nad prahom 15 000 € → AML je **vždy povinná** pri predávajúcom aj kupujúcom. To ospravedlňuje **hard blocker** prístup.

## 2. Aktuálny stav (čo je zle)
- **Bug v `src/lib/obchodStatus.ts:38-40`:** `ulohy.filter(aml).every(done)` — `.every()` na prázdnom poli vracia `true`. Obchod **bez jedinej AML úlohy** preskočí rovno na `pred_podpisom_kz`. AML sa dnes neeviduje vôbec štruktúrovane — len ako voliteľná textová "úloha".
- **Schéma:** `klienti` nemá rodné číslo, číslo OP, PEP, ani AML polia. Žiadne tabuľky `aml_*`, `kuv`, `noo`. `obchody` má len `klient_id` (jeden účastník) + `kupujuci_meno` (voľný text, nie FK) → druhý účastník nie je vždy klient.
- **`/aml-poucenie`** je len verejný text, nie evidencia.
- **Konflikt s GDPR erasure:** erasure dnes maže `klient_dokumenty` → zmazal by aj AML doklady, ktoré majú **zákonnú retention 5–10 r.** a NESMÚ sa mazať (GDPR čl.17 ods.3 písm.b). Treba ošetriť.

## 3. Čo zákon vyžaduje evidovať (dátový model)

### 3.1 AML profil osoby (FO/PO)
**Fyzická osoba (§ 7 ods.1):** meno, priezvisko, rodné číslo / dátum narodenia, štátna príslušnosť, adresa, druh + číslo dokladu totožnosti, platnosť dokladu.
**Právnická osoba (§ 7 ods.2):** názov, sídlo, IČO, register; identifikácia štatutára (ako FO); **KUV** (viď 3.3).

### 3.2 Overenie + úroveň starostlivosti (§ 8, §10–14)
- overenie: spôsob, kto overil (user), kedy, fyzická prítomnosť áno/nie 🔶 (spôsob bez fyzickej prítomnosti overiť)
- úroveň: **základná** / **zvýšená** (PEP, cudzinec z rizikovej krajiny, atypická suma/hotovosť, klient bez prítomnosti) → pri zvýšenej navyše **pôvod prostriedkov** + **schválenie štatutárom**

### 3.3 PEP, sankcie, KUV
- **PEP (§ 6):** status áno/nie, dôvod, zdroj overenia, dátum. PEP → povinná zvýšená starostlivosť.
- **Sankčný skríning (zák. 289/2016 + EÚ):** výsledok čistý/match, verzia zoznamu, dátum. Match → obchod STOP + interný alert.
- **KUV (§ 6a, §11) — len pri PO:** zoznam FO ovládajúcich PO (>25 % podiel/hlasy, menovanie štatutára, alebo management). Každý: meno, RČ/dát.nar., adresa, typ kontroly, overené z, dátum.

### 3.4 NOO — neobvyklá obchodná operácia (§ 4, §17)
- záznam: dôvod podozrenia, kto zistil, dátum, ohlásené FSJ áno/nie, dátum/spôsob ohlásenia
- **interné only** — zákaz tippingu (§ 18): klient sa NESMIE dozvedieť. RLS: prístup len AML officer + štatutár.

### 3.5 Stav AML na obchode (enum)
```
nezacate | prebieha | cakajuce_overenie | zvysena_schvalenie | hotove_clean | match_blokovane
```

## 4. Navrhovaná schéma (migrácie)

```sql
-- aml_profil: 1 profil na (klient × obchod). Klient môže mať viac obchodov.
create table aml_profil (
  id uuid pk, company_id uuid, obchod_id uuid, klient_id uuid null,
  rola text,                       -- predavajuci | kupujuci
  osoba_typ text,                  -- FO | PO
  -- FO:
  meno, priezvisko, rodne_cislo, datum_narodenia, statna_prislusnost,
  adresa, doklad_typ, doklad_cislo, doklad_platnost_do,
  -- PO:
  po_nazov, po_sidlo, po_ico, po_register,
  -- overenie:
  overenie_sposob text, overil_user_id uuid, overene_at timestamptz,
  fyzicka_pritomnost boolean,
  -- starostlivosť:
  uroven text,                     -- zakladna | zvysena
  povod_prostriedkov text, zvysena_schvalil_user_id uuid, zvysena_schvalene_at,
  -- PEP + sankcie:
  pep_status boolean, pep_dovod text, pep_datum date,
  sankcie_vysledok text, sankcie_zoznam_verzia text, sankcie_datum date,
  -- stav:
  aml_status text,                 -- enum vyššie
  retention_do date,               -- dátum + 5/10 r. 🔶
  created_at, updated_at
);
create table aml_kuv (        -- len pre PO
  id uuid pk, aml_profil_id uuid, meno, priezvisko, rodne_cislo, datum_narodenia,
  adresa, statna_prislusnost, typ_kontroly text, overene_z text, datum date
);
create table aml_noo (        -- interné, RLS len AML officer + štatutár
  id uuid pk, company_id uuid, obchod_id uuid, dovod text,
  zistil_user_id uuid, datum_zistenia, ohlasene_fsj boolean,
  datum_ohlasenia, sposob text, interne_only boolean default true
);
```
- RLS: `aml_profil`/`aml_kuv` — company scope; `aml_noo` — len AML officer/štatutár (zákaz tippingu).
- AML doklady v `klient_dokumenty` → pridať flag `aml_retention boolean` → **vyňať z GDPR erasure cascade**.

## 5. Logika vynútenia (blockery)

### 5.1 Oprava `computeObchodStatus` (bug)
`.every()` na prázdnom poli → `false`, keď AML reálne nie je doložené. Status sa NEsmie posunúť na `pred_podpisom_kz`/`podpisane` kým AML nie je `hotove_clean` pre **všetkých účastníkov**.

### 5.2 Hard blocker na KZ
KZ (kúpna zmluva) sa **nesmie vystaviť/podpísať**, ak ktorýkoľvek účastník (predávajúci aj kupujúci) nemá `aml_status = hotove_clean`. Miesto: tam kde sa generuje/podpisuje KZ (over v `obchody`/`vyhradna-zmluva`/podpis flow).

### 5.3 Soft warning na RZ
Rezervačná zmluva → upozornenie ak AML neukončená (rezervačný depozit je tiež finančný tok).

### 5.4 Sankčný match
`sankcie_vysledok = match` → `aml_status = match_blokovane` → obchod stop + interný alert AML officer.

## 6. GDPR interakcia (kritické)
AML dokumentácia má retention **5–10 r.** (§19) a **nepodlieha** právu na výmaz (čl.17 ods.3 písm.b). → GDPR erasure (F5) musí AML profil + AML doklady **vyňať z cascade delete** (rovnako ako faktúry). Doplniť do `gdpr/erasure` guard: nemazať `aml_profil`, `aml_kuv`, ani `klient_dokumenty` s `aml_retention=true`.

## 7. UI (čo treba)
- AML panel na obchode/klientovi: formulár identifikácie (FO/PO), upload skenu OP, checkboxy PEP/sankcie, stav AML.
- Vizuálny indikátor stavu na obchode (červená kým nie `hotove_clean`).
- KZ akcia disabled + hláška keď AML nie hotová.
- AML NOO — samostatný interný formulár (skrytý pred klientom).

## 8. Fázovanie (odporúčam MVP najprv)
**Fáza 1 (MVP — pokrýva 80 % rizika):**
- `aml_profil` tabuľka (FO + základné PO polia), oprava `computeObchodStatus` bugu, **hard blocker na KZ**, manuálny PEP + sankčný checkbox (realiťák overí ručne voči EÚ zoznamu), AML doklady vyňaté z erasure.
**Fáza 2:**
- KUV pre PO, NOO modul + RLS (zákaz tippingu), automatizovaný sankčný skríning (API voči EÚ konsolidovanému zoznamu), zvýšená starostlivosť workflow.

## 9. Otvorené právne otázky (🔶 pred kódom overiť u právnika)
1. Prah pri **nájme** (10 000 €/mes.?).
2. Spôsob overenia **bez fyzickej prítomnosti**.
3. Retention **5 vs 10 rokov**.
4. Lehoty **zdržania NOO**.
5. **Novela 2026 + registračný deadline** (31.8.2026?) — najväčšia neistota, NEDÁVAŤ do kódu na základe neistého dátumu.
6. Aktuálna výška **pokút**.

## 10. Biznis kroky (mimo kódu — pre Aleša)
- Registrácia Vianema ako povinná osoba 🔶 (over deadline u právnika).
- Písomný **program vlastnej činnosti** (§ 20) — interný dokument.
- Určiť **zodpovednú osobu (AML officer)** ohlasujúcu FSJ.
- Školenie.

---

## Odporúčaný prvý krok po schválení
Implementovať **Fázu 1 MVP** v poradí: (1) migrácia `aml_profil` + `aml_retention` flag, (2) oprava `computeObchodStatus` bugu (rýchle, izolované — môže ísť hneď), (3) KZ hard blocker, (4) erasure guard, (5) AML panel UI. Body 9 (právne) bežia paralelne — kód nepustíme do PROD bez ich uzavretia.
