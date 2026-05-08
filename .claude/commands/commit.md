## description: Commit, push, PR — tri slová, plne automatizované

Spravíš toto v poradí, bez pýtania medzi krokmi:

## 1. Skontroluj zmeny
```bash
git status
git diff
```

## 2. Vytvor commit message
- Krátky title (max 72 znakov), v imperatíve ("Add", "Fix", "Refactor")
- Body: 2-3 vety **prečo** to robíš, nie čo (čo vidno z diffu)
- Bez emoji, bez "🤖 Generated with Claude"
- Slovenčina alebo angličtina podľa zvyšku gitu (skontroluj `git log --oneline -10`)

## 3. Commit + push
```bash
git add -A
git commit -m "..."
git push
```

## 4. Vytvor PR (ak existuje `gh` CLI)
```bash
gh pr create --title "..." --body "..."
```

PR body obsahuje:
- **Čo** — 1 veta
- **Prečo** — 2 vety
- **Ako otestovať** — bullet pointy konkrétnych krokov
- **Risks** — čo by mohlo zlyhať (ak nič, napíš "Žiadne známe riziká")

## Pravidlá
- Ak `git status` ukáže že nie sú zmeny — povedz to a skonči.
- Ak sú v zmenách súbory ktoré nepatria do tohto PR (napr. `.env`, IDE configy) — zastav sa a opýtaj sa.
- Ak `npm run build` alebo `npm run test` existujú, **najprv ich spusti**. Ak zlyhajú, nepushuj.
