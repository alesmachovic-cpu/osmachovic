## description: Spusti paralelnú kontrolu kódu — staff engineer review pred mergom

Práve som dokončil zmenu kódu. Pred PR ju potrebujem zreviewovať tvrdo.

Spusti **3 paralelné checky** (použi subagentov pre každý):

## 1. Staff Engineer Review
Pozri zmenené súbory očami senior developera:
- Je tu duplicitný kód? Niečo už v projekte existuje?
- Je riešenie príliš zložité? Dalo by sa to spraviť jednoduchšie?
- Sú edge cases pokryté?
- Sú error states ošetrené?

## 2. Style & Consistency Check
- Dodržiavame patterny z `CLAUDE.md`?
- Konvencie pomenovávania súhlasia s zvyškom projektu?
- TypeScript typy sú prísne (žiadne `any`)?

## 3. Verification Plan
Daj mi konkrétny postup ako toto otestovať:
- Aký user flow mám prejsť
- Aké hodnoty mám zadať
- Čo má byť výsledok

## Output
Sumarizuj všetko do `review.md` s:
- 🔴 Blockers (treba opraviť pred mergom)
- 🟡 Suggestions (mohlo by byť lepšie)
- 🟢 Funguje to dobre

Ak nájdeš blockery, **neopravuj ich automaticky** — povedz mi ich a nechaj ma rozhodnúť.
