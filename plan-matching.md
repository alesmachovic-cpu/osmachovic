# Plán — Matching (vývoj)

Audit 2026-06-06. **Scope tohto okna: len vývoj.** Bezpečnosť (auth/scope) a právo (GDPR/PII) sú odovzdané do iných okien.

## Hotové (overené: vitest 11/11 + lint 0 errors)
- [x] **#1 Izby string/number bug** — normalizácia na `number[]` v `vypocitajSkore` + 2 regression testy. 3-izbový pre klienta čo chce 3-izbový už dostane +10, nie −30.
- [x] **#7 Farby** — jeden zdroj prahov `skoreUroven` (80/50) pre 5 komponentov. Opravená obrátená modrá/žltá na /matching; MatchingWidget prah 85→80.
- [x] **#5 Lokalita fallback** — `nehnutelnost/[id]` teraz posiela `klientForMatch` → skóre symetrické s ostatnými routes.
- [x] **#4 Cena postih** — stupňovaný postih za prekročenie rozpočtu: +10–25 % → −20, +25–50 % → −40, >50 % → −60.
- [x] **#6 rozpocet_max** — oživený fallback: keď objednávka nemá cena_do, použije sa rozpočet klienta. Načítané v 3 routes.
- [x] **Drobnosť** — zmazaný mŕtvy súbor `src/app/matching/page 2` (starý duplikát z 22. mája).

## Schválené Alešom 2026-06-06 — väčšie, po fázach

### #3 Geo — dotiahnuť (vzdialenosť v km namiesto textových názvov) — HOTOVÉ A1–A3 (vitest 13/13)
- [x] **A1** `lat,lng` v 3 matching routes + mapovanie pre monitor inzeráty.
- [x] **A2** Geokódovanie objednávok pri save (`/api/objednavky` POST/PATCH). Len jednoznačná lokalita (1 okres alebo 1 kraj bez okresov) → 1 GPS bod; viac okresov = null → text matching. PATCH pregeokóduje pri zmene lokality.
- [x] **A3** Refaktor inline haversine → `distanceKm` z `geocode.ts`.
- [ ] **A4** (voliteľné, neskôr) Backfill skript pre existujúce objednávky bez súradníc (Nominatim 1 req/s). Bez neho geo funguje len pre nové/editované objednávky; staré padajú na text fallback.

### #2 Zjednotiť výpočet — jeden zdroj pravdy + matching na každom kupujúcom
- [x] **B1** `page.tsx` volá `vypocitajSkore` (jeden zdroj pravdy). Mapovanie Nehnutelnost/Objednavka → *ForMatch (lat/lng cez cast). Klient bez objednávky → pseudo-objednávka z profilu (lokalita + rozpočet). Odstránený umelý bonus „+10 má objednávku". Vedľajší efekt: rešpektuje status → predané/archivované zmiznú z /matching.
- [x] **B2** Jemný štítok „z profilu — doplň objednávku" pri zhodách bez objednávky.
- [ ] **B3** (väčšie, na rozhodnutie) Widget na karte kupujúceho funguje aj bez objednávky — rozšíriť API/widget. /matching stránka už každého kupujúceho pokrýva, takže B3 je nice-to-have.

## Upozornenie (iná doména — nemením z tohto okna)
- `kupujuci/page.tsx:249` číta `poziadavky.pocet_izieb`, ale ObjednavkaForm ukladá `izby` → počet izieb sa na karte kupujúceho nezobrazí. Patrí do kupujuci domény (bolo rozrobené v inom okne).

## Mimo scope (handoff hotový)
- BEZPEČNOSŤ → requireUser + company_id scope na 3 matching routes.
- PRÁVO → GDPR posúdenie PII leaku (hlavne či je aj na prod).
