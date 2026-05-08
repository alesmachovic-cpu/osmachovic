## description: Zachytí lekciu z práve dokončenej úlohy do tasks/lessons.md

Práve sme dokončili úlohu (alebo sme narazili na problém, ktorý sme vyriešili).

Spravíš toto:

## 1. Spýtaj sa ma stručne
- Čo bolo nečakané?
- Čo by si nabudúce spravil inak?
- Existuje pravidlo, ktoré by tomu predišlo?

## 2. Zapíš lekciu
Otvor (alebo vytvor) `tasks/lessons.md` a pridaj záznam v tomto formáte:

```
## YYYY-MM-DD — Krátky title lekcie

**Kontext:** Čo sme robili (1 veta).
**Problém:** Čo zlyhalo alebo nás prekvapilo (1-2 vety).
**Lekcia:** Pravidlo do budúcna (1 veta, imperatív).
**Pridané do CLAUDE.md?** Áno/Nie + sekcia.
```

## 3. Rozhodni o CLAUDE.md
Ak je lekcia univerzálna (platí pre celý projekt) → pridaj ju do `CLAUDE.md`.
Ak je lokálna (špecifická pre jeden modul) → nech ostane len v `lessons.md`.

Boris Cherny: "Anytime we see Claude do something incorrectly, we add it to CLAUDE.md so it doesn't repeat next time."
