## description: Paralelne zreviewuj zmenený kód — reuse, kvalita, CLAUDE.md compliance

Spusti **3 paralelných subagentov** pre práve zmenený kód. Každý dostane svoju doménu:

## Agent 1: Reuse Detective
Pozri zmenené súbory a hľadaj:
- Existuje už podobný helper/util v projekte? (skontroluj `lib/`, `utils/`, `helpers/`)
- Duplikujem niečo, čo sa už deje na inom mieste?
- Existuje shadcn/Radix komponent ktorý robí to isté?

Output: zoznam konkrétnych miest kde sa dá použiť existujúci kód.

## Agent 2: Quality Inspector
- Sú error states ošetrené? (loading, error, empty)
- Existujú edge cases? (prázdny array, null user, offline)
- TypeScript: žiadne `any`, žiadne `as unknown as X` hacky?
- Async funkcie majú try/catch alebo bubble up?

Output: zoznam quality issues s prioritou (high/medium/low).

## Agent 3: CLAUDE.md Compliance Officer
Prečítaj `CLAUDE.md` a over, či zmeny dodržiavajú:
- Style guide pre Property Stories (ak sa týka copy)
- Tech konvencie (`type` vs `interface`, žiadne `enum`)
- Slovenčina v UI cez prekladový súbor
- Žiadne nové npm packages bez súhlasu

Output: violations + odporúčania ako to napraviť.

## Finálny output
Sumár do `simplify-report.md`:
- 🔴 Musíš opraviť (blokuje merge)
- 🟡 Mal by si zvážiť
- 🟢 Bonus suggestions

**Neopravuj nič automaticky.** Len mi daj report — rozhodnem sám, čo aplikovať.
