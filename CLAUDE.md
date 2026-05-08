# Realitné CRM — Pravidlá projektu

## O projekte
Realitné CRM s AI copywriterom pre maklérov. Generuje "Property Stories" z bullet pointov a market dát.

## Jazyk a štýl komunikácie
- **Komunikuj so mnou v slovenčine.**
- Buď stručný, konkrétny, bez zbytočných úvodov.
- Keď nieco neviem alebo si neistý, povedz to priamo. Žiadne "isto budeš zvládať".

## Workflow — DÔLEŽITÉ
1. **Pri každej netriviálnej úlohe (3+ kroky) najprv vytvor plán** v `plan.md`.
1. Pred kódom prečítaj existujúci kód, aby si pochopil kontext.
1. Po napísaní kódu vždy spusti dev server alebo testy a over, že to funguje.
1. Nikdy neoznač úlohu ako hotovú bez verifikácie.

## Tri hlavné princípy (Boris Cherny)
1. **Jednoduchosť** — minimálny kód. Ak vieš niečo zmazať namiesto pridať, sprav to.
1. **Žiadne band-aidy** — hľadaj koreňovú príčinu, nie rýchle záplaty.
1. **Žiadne vedľajšie účinky** — meň len to, čo treba. Nepridávaj nové bugy pri opravovaní starých.

## Style guide pre Property Stories (NIKDY NEPORUŠIŤ)
Toto je copywriter brief pre celý projekt. Vždy keď generuješ inzerát alebo property story:
- **Žiadne klišé.** Zakázané: "exclusive opportunity", "dream home", "must see", "jedinečná príležitosť", "vysnívaný domov".
- **Pravidlo troch.** Presne 3 unique selling points. Nie 2, nie 5.
- **Neviditeľná technológia.** Nepopisuj features, popisuj pocit. Nie "south-facing windows" — "natural light that follows your morning coffee".
- **Data-driven.** Použi market sentiment dáta na zdôvodnenie ceny.

## Output format pre Property Story (striktne)
- **[The Hook]** — 1 veta, hlavička zachytávajúca esenciu
- **[The Lifestyle]** — 3 krátke odstavce
- **[The Investment Logic]** — 1 veta o tom, prečo má kúpa zmysel dnes
- **[Social Snippet]** — 2-vetová verzia pre IG/WhatsApp

## Tech stack
- Framework: Next.js 16.1.7 (App Router)
- Databáza: Supabase (@supabase/supabase-js)
- Styling: Tailwind CSS
- Hosting: Vercel

## Konvencie kódu
- TypeScript: preferuj `type` pred `interface`. Nikdy `enum` (radšej string literal unions).
- Slovenské stringy v UI patria do prekladového súboru, nie hardcoded.
- API routes vrátane error handling, žiadne `any` typy.

## Čo NIKDY nerob
- Nemeň schému databázy bez výslovného potvrdenia.
- Nepridávaj nové npm packages bez toho, aby si sa opýtal.
- Negeneruj copy s emoji, pokiaľ to nie je výslovne pre social media snippet.

## Self-improvement loop
Po každej oprave alebo nedorozumení sa ma opýtaj: "Mám to pridať do CLAUDE.md?"
Tento súbor je živý dokument — má sa zlepšovať každým týždňom.
