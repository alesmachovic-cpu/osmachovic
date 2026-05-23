# Plán: Kupujúci workflow

## Cieľ
Postaviť plnohodnotný workflow pre kupujúceho — od kontaktu po kúpu. Aktuálne CRM má len status dropdown, žiadnu pipeline, žiadne hypo poradcov, žiadne rezervácie ako samostatnú entitu.

## Business model (od Aleša 2026-05-23)
- Kupujúci **nemá náber** (to robí len predávajúci)
- Kupujúci **chodí na obhliadky**
- Pred kúpou **stretnutie s hypo poradcom** — zistiť kapacitu (koľko mu banka schváli)
- Po nájdení bytu → **rezervácia (RZ)** → schválenie hypo → KZ → vklad → kúpil
- Vianema má **viacero vlastných hypo poradcov**. Snaha aby kupujúci išiel cez nášho. Klient môže mať aj svojho.
- Klient typu **"oboje"** môže predávať cez jedného makléra a kupovať cez iného. Obaja vidia oba pipeline-y, ale editujú LEN svoju stranu.

## Návrh: Kupujúci pipeline (8 krokov)

| # | Krok | Status (DB) | Akcia |
|---|---|---|---|
| 1 | **Kontakt** | `aktivny` | Klient zaregistrovaný, vyplnená objednávka (čo hľadá) |
| 2 | **Hypo poradca** | `hypo_konzultacia` | Dohodnuté stretnutie s hypo poradcom |
| 3 | **Schválená kapacita** | `kapacita_schvalena` | Banka vyhodnotila bonitu → vieš rozpočet |
| 4 | **Hľadá / obhliadky** | `aktivny` | Chodí na obhliadky podľa matching |
| 5 | **Záujem o konkrétnu** | `zaujem_konkretna_nasa` / `_ina_rk` | Vyhliadol jednu |
| 6 | **Rezervácia (RZ)** | `rezervacia` | Podpísaná rezervačná zmluva |
| 7 | **Podpis KZ** | `podpis_kz` | Kúpna zmluva u notára |
| 8 | **Vklad / Kúpil** | `uz_kupil` | Kataster + odovzdanie kľúčov |

## Fázy implementácie

### F1: Pipeline graf pre kupujúceho (UI only, bez DB zmien) — 1-2 h
- `KUPUJUCI_PIPELINE_STEPS` array v komponente
- V klient detail strane: ak `klient.typ === "kupujuci"` → zobraziť kupujúcu pipeline namiesto predávajúcej
- Kroky 1, 4, 5, 8 sa odvodia z existujúceho `klient.status` + počtu objednávok/obhliadok
- Kroky 2, 3, 6, 7 zatiaľ "neaktívne / TODO" (placeholders kým nie sú entity)
- Pridanie statusov `hypo_konzultacia`, `kapacita_schvalena`, `rezervacia`, `podpis_kz` do DB constraint

### F2: Hypo poradcovia entita — 2-3 h
- Migrácia: tabuľka `hypo_poradcovia(id, meno, telefon, email, je_interny BOOLEAN, makler_id NULLABLE, company_id, aktivny)`
- API CRUD `/api/hypo-poradcovia` (list/create/update/delete)
- UI: Nastavenia → Hypo poradcovia (zoznam + add/edit/delete)
- Migrácia: `klienti.hypo_poradca_id NULLABLE` (priradenie) + `klienti.hypo_poradca_je_klientov BOOLEAN` (klient si priviedol svojho?)
- UI v karte klienta: select hypo poradcu (interné z dropdown / "klient má vlastného" → otvor inline form)
- Aktivuje krok 2 pipeline

### F3: Rezervácia entita — 4-6 h
- Migrácia: tabuľka `rezervacie(id, klient_id, nehnutelnost_id, makler_id, datum_rz, suma_zalohy, termin_schvalenia_hypo, termin_kz, status, dovod_zrusenia, company_id)`
- Status: `aktivna | hypo_schvaluje | hypo_zamietnuta | kz_podpisana | zrusena`
- API CRUD `/api/rezervacie`
- UI: tlačidlo "+ Rezervácia" v karte kupujúceho (otvorí modal: výber nehnuteľnosti, datum_rz, suma, deadlines)
- Tab "Rezervácie" v karte kupujúceho
- Cron `/api/cron/rezervacie-deadlines` — upozornenia 3 dni pred deadline schválenia/KZ
- Aktivuje kroky 6, 7

### F4: "Oboje" pipeline split — 3-4 h
- Migrácia: `klienti.kupna_makler_id NULLABLE` (kto rieši kúpu, ak je iný od `makler_id` čo rieši predaj)
- Scope update: pre 'oboje' klienta `canEditRecord` zohľadňuje SEPARATNE predávajúcu a kupujúcu časť
- UI: v karte 'oboje' klienta zobraziť **2 pipeline grafy pod sebou** (predávajúca + kupujúca), každá so svojím makler badge
- Pre cudzieho na predávajúcej strane: predaj read-only, kúpa editovateľná (ak je kupna_makler)
- Pre cudzieho na kupujúcej strane: opačne

### F5: Cron auto-warnings + finálne testovanie — 1 h
- Cron beží denne: kupujúci v statuse `aktivny` viac ako 30 dní bez obhliadky → pripomienka makléra
- Manuálne otestovať všetky 4 roly × 3 typy klientov

## Odporúčaný postup
**F1 prvé** — najrýchlejší vizuálny efekt. Pipeline graf uvidíš okamžite, aj keď kroky 2/3/6/7 sú "placeholders". To ti dá pocit či to dáva zmysel skôr než stratíme čas na DB schémy.

Po F1 schválení → F2 (hypo poradcovia) → F3 (rezervácie) → F4 (oboje split) → F5 (cron + test).

Celkový odhad: **2-3 dni práce** (rozloženo cez viacero session).

## Otvorené otázky pred F2-F4
- [ ] Kde priraďovať hypo poradcu — pri vytváraní klienta, pri prvej obhliadke, alebo neskôr?
- [ ] Aké banky preferujete (SLSP, VÚB, Tatra, mBank, …)? Pre report-y aby bolo viditeľné koho preferujete.
- [ ] Rezervácia: má sa vznikať z karty klienta, alebo z karty nehnuteľnosti, alebo z obhliadky?
- [ ] Kupujúci čo má svojho hypo poradcu (externý) — zaznamenať len meno/tel, alebo vytvoriť aj záznam v `hypo_poradcovia` (s `je_interny=false`)?

## Mimo scope tohto plánu
- Backend gating cez `canEditRecord` (už máme z plan-pristupove-prava.md)
- Matching (geo-aware) — `plan-matching.md`
