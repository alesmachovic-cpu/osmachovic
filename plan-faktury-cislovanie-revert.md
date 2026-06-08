# Plán: Revert faktúrneho číslovania na per-maklér (dev go-live fix)

**Rozhodnutie CEO+Pravo (commity G31, b1dfe73/b92307b):** číslovanie faktúr je
PER MAKLÉR/DODÁVATEĽ. Každý maklér = vlastné IČO = samostatný dodávateľský rad.
3× FA20260001 od 3 maklérov = NIE duplicita. Dev migrácia 075 (per-company) = regresia.

## Skutočný stav DB (overené 2026-06-09, test DB ntdjsmqzzvqqammmiqye)
Tri unique indexy na `faktury`:
1. `faktury_user_cislo_uniq` `(user_id, cislo_faktury)` — z 032 — SPRÁVNY, ponechať
2. `uniq_faktury_company_cislo` `(company_id, cislo_faktury)` — z 075 — REGRESIA, drop
3. `uniq_faktury_company_vs` `(company_id, variabilny_symbol)` — z 075 — REGRESIA, drop
→ 075 použil `IF NOT EXISTS` s novým názvom, takže 032 index nikdy nedropol — bežia oba naraz.

**Poškodené dáta z 075 dedupu:** `nikoleta-szalayova` faktúra FA20260001/VS20260001
(vyst. 13.5.) bola dedupom z 075 premenovaná na `FA20260001-DUP2`/`VS20260001-DUP2`,
lebo `mgr-slavomr-kollr` má FA20260001 (vyst. 27.4.). Per-maklér má Nikoleta právo
na vlastný FA20260001. → zmena čísla faktúry = zákonná náležitosť = 🔴 protokol, čaká na CEO.

## Kroky
1. **Migrácia 114** — drop oboch company indexov; pridať per-user VS index
   (paralela k 032 cislo indexu, aby VS race guard ostal v per-user scope).
   `faktury_user_cislo_uniq` (032) sa nedotýkame. Aplikovať do test DB.
2. **route.ts** — generátor `nextNumber` scope `company_id` → `user_id` (riadok ~123);
   opraviť klamlivý komentár (riadok ~110-113) na per-user.
3. **-DUP2 data-fix** — 🔴 banner CEO, NEROBIŤ bez výslovného súhlasu.
4. audit-all.sh (žiadny nový ✗) → commit len svoje súbory → report MD.

## Race guard (bod 3 zadania)
Po oprave: generátor počíta max per-user → každý maklér vlastný rad (3× FA20260001 = OK).
Retry-on-23505 beží proti `faktury_user_cislo_uniq` → v rámci JEDNÉHO makléra žiadne
duplicity (paralelné POSTy toho istého makléra → druhý dostane 23505 → retry → +1).
