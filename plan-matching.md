# Plán: Matching (nehnuteľnosť ↔ objednávka)

## Cieľ
Zlepšiť pairovanie nehnuteľností s objednávkami kupujúcich tak aby maklér dostal **použiteľný** zoznam — nie zoznam kde Senec sedí rovnako vysoko ako susedná ulica.

## Stav (2026-05-22)

### ✅ Hotové
1. **DB migrácia `086_geo_coords.sql`** — pridané `lat` a `lng` do tabuľky `nehnutelnosti`.
2. **`src/lib/geocode.ts`** — helper cez OpenStreetMap Nominatim:
   - `geocodeAddress(query)` vráti GPS pre slovenskú adresu
   - `distanceKm(lat1,lng1,lat2,lng2)` — vzdialenosť v km (haversine)
   - SK bbox filter (odmietne výsledky mimo Slovenska)
3. **Auto-geocoding v save** (`src/app/api/inzerat/save/route.ts`):
   - Pri insert aj edit sa pokúsi doplniť lat/lng z adresy (ulica + obec + okres + kraj)
   - Ak GPS už je vyplnené, neprepíše (idempotentné)
   - Ak adresa nie je geokódovateľná, ostane NULL — matching padne na text-based fallback
4. **`src/lib/matching.ts`** — geo-aware scoring:
   - <1 km: +25 bodov ("Presne v lokalite")
   - <3 km: +18 bodov ("Blízko")
   - <7 km: +10 bodov ("V okolí")
   - <15 km: +2 body ("V meste/okrese")
   - <50 km: **-30 bodov** ("Mimo mesta")
   - >50 km: ešte negatívnejšie

### 🧪 Čo treba otestovať
1. Otvor kupujúceho s konkrétnou lokalitou v objednávke (napr. Petržalka)
2. Pozri jeho matching → blízke musia byť hore, vzdialené dole
3. Otvor kupujúceho čo má len kraj/okres bez lokality → matching musí stále fungovať
4. Stará nehnuteľnosť bez GPS — otvor a ulož → auto-doplní GPS

### ⏳ TODO (po teste)
- [ ] **Refaktor:** `matching.ts:96-102` má inline haversine, mal by používať `distanceKm` z `geocode.ts` (DRY, -8 riadkov).
- [ ] **Bulk backfill:** Skript ktorý prebehne existujúce nehnuteľnosti bez GPS a doplní ich (rate-limit 1 req/s kvôli Nominatim).
- [ ] **Logging:** Keď geocoding zlyhá, `console.warn` aby maklér v logu videl ktoré adresy nesedia.

## Mimo scope tohto plánu
- Akékoľvek zmeny v kupujúcom / objednávke samotnej → patrí do `plan-kupujuci.md`.
