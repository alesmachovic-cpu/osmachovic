# Brand System — Vianema × AMGD

This CRM is operated by **Vianema Real** (the realitka) and powered by **AMGD** (the system platform). Branding follows a strict three-tier hierarchy. **Vianema is the operator, AMGD is the system.**

## Components

All brand components live in `src/components/brand/`:

```
Logo, Wordmark, Monogram         ← Tier 3: AMGD-only
VianemaBranded, PoweredByAMGD    ← Tier 1: klient-facing
PartnershipLockup                ← Tier 2: B2B partnership
```

Import via barrel:

```tsx
import { VianemaBranded, PoweredByAMGD, PartnershipLockup, Logo } from "@/components/brand";
```

## Three-tier hierarchy

### Tier 1 — Klient-facing (Vianema dominates, AMGD whispers)

| Surface | Component |
|---|---|
| Login screen (`AuthProvider.tsx`) | `<VianemaBranded />` + `<PoweredByAMGD size="sm" />` patička |
| Sidebar header (`Sidebar.tsx`) | VIANEMA / REAL inline + `<PoweredByAMGD size="sm" />` |
| Browser tab title (`layout.tsx`) | `VIANEMA Real — Realitný Systém` |
| Email **Obhliadkový list** (`api/obhliadky/pdf`) | VIANEMA hlavička + `POWERED BY AMGD` patička |
| Email **Náberový list** (`api/naber-pdf`) | VIANEMA hlavička + `POWERED BY AMGD` patička |
| Email **Reset hesla** (`api/auth/forgot`) | VIANEMA hlavička + `POWERED BY AMGD` patička |
| PDF **Obhliadkový list** | `Powered by AMGD` text v patičke |

**Rule:** Vianema je dominantná, AMGD je whisper (~55–60 % opacity, 3–4× menší).

### Tier 2 — Partnership (equal lockup)

`<PartnershipLockup />` — VIANEMA | AMGD ako rovnocenné. **Nepoužívať na žiadnej klient-facing ploche.** Vyhradené pre:

- Pitch decky pre iné realitky
- Case studies, blog posts o systéme
- Joint webináre, partnership stránky
- Press materiály

(Aktuálne v projekte nie je žiadny Tier 2 surface — pridajú sa keď bude potreba.)

### Tier 3 — AMGD only

`<Logo />`, `<Wordmark />`, `<Monogram />` — bez Vianemy. Vyhradené pre:

- amgd.sk landing
- Pricing / sales decky pre nové realitky
- Demo prostredia
- AMGD vlastný marketing

(Aktuálne v projekte nie sú žiadne Tier 3 plochy — projekt je výhradne operatívny CRM Vianemy.)

## Pravidlá (non-negotiable)

1. **AMGD nikdy nedominuje nad Vianema v klient-facing kontextoch.**
2. **Tier 2 lockup sa nikdy neobjavuje v Tier 1 plochách.** Klient by si myslel, že komunikuje s dvoma firmami.
3. **AMGD vlastné plochy (Tier 3) nikdy neuvádzajú Vianema ako co-presenter** — Vianema je tam zákazník, nie partner.
4. **Farby:** `#0A0A0A` a `#FAFAF7` only. Žiadne accent farby v logu/wordmarku.
5. **Vianema branding má prednosť** pred AMGD pravidlami pri konflikte na Tier 1 plochách.

## Vianema oficiálne logo — TODO

Súbor `public/brand/vianema-wordmark.svg` je **placeholder** (Inter typografia). Pred produkciou:

1. Získať oficiálne SVG z `https://www.vianemareal.eu/images/main_logo.svg` alebo priamo od Vianemy
2. Nahradiť placeholder
3. Aktualizovať `<VianemaBranded />` a `<PartnershipLockup />` aby renderovali oficiálne SVG namiesto inline typografie
