# Brand System — AMGD × Vianema

CRM operuje **Vianema Real** (realitka), beží na **AMGD** (systémová platforma).

## Komponenty

Importuj cez barrel `@/components/brand`:

```tsx
import {
  Logo,                // Tier 3 — primary AMGD lockup s tagline
  Wordmark,            // Tier 3 — AMGD wordmark bez tagline
  Monogram,            // App icon, avatar, watermark
  VianemaBranded,      // Tier 1 — Vianema dominuje, AMGD šepká
  PoweredByAMGD,       // Tier 1 — tichá AMGD signatúra
  PartnershipLockup,   // Tier 2 — VIANEMA | AMGD rovnocenné
} from "@/components/brand";
```

| Komponent | Tier | Použitie |
|-----------|------|----------|
| `<Logo />` | 3 | AMGD samostatne — amgd.sk hero, pricing, sales decks, vizitky |
| `<Wordmark />` | 3 | AMGD app header keď nie je Vianema, mobile bar, embedded UI |
| `<Monogram />` | — | App icon, avatar, watermark (self-contained — nepoužíva currentColor) |
| `<VianemaBranded />` | 1 | Login screen, klient-facing kompletný blok |
| `<PoweredByAMGD />` | 1 | Tichá AMGD signatúra pod Vianemou (login footer, email patička, navbar) |
| `<PartnershipLockup />` | 2 | B2B pitch decky, case studies, partnership stránky |

## Pravidlá (non-negotiable)

1. **Tier 1** — AMGD nikdy nedominuje nad Vianemou v klient-facing kontextoch.
2. **Tier 2 lockup** sa nikdy neobjavuje v Tier 1 kontextoch (mätie klienta — myslí si, že komunikuje s dvoma firmami).
3. **Tier 3** — AMGD vlastné povrchy nemajú Vianemu ako co-presenter (na amgd.sk je Vianema *zákazník*, nie partner).
4. **Farby:** len `#0A0A0A` a `#FAFAF7`. Žiadne accent farby v logu/wordmarku, **NIKDY**.
5. **Vianema wordmark** v cobrand komponentoch je teraz **typografický placeholder** (Inter font, vizuálne podobný). Pred produkciou:
   - Stiahni oficiálne SVG z `https://www.vianemareal.eu/images/main_logo.svg`
   - Ulož do `public/brand/vianema-wordmark.svg`
   - Uprav `<VianemaBranded />` a `<PartnershipLockup />` aby renderovali toto SVG namiesto inline typografie.

## Aplikácia v projekte

### Tier 1 (klient-facing)
| Plocha | Komponent |
|---|---|
| Login screen (`AuthProvider.tsx`) | `<VianemaBranded />` na `bg-[#0A0A0A]` text-white + footer `<PoweredByAMGD size="sm" />` |
| Sidebar header (`Sidebar.tsx`) | VIANEMA / REAL inline + `<PoweredByAMGD size="sm" />` |
| Navbar (`Navbar.tsx`) | `<PoweredByAMGD size="sm" />` pred user avatarom (skryté na mobile) |
| Browser tab title (`layout.tsx`) | `VIANEMA Real — Realitný Systém` |
| Email Obhliadkový list (`api/obhliadky/pdf`) | VIANEMA hlavička + `POWERED BY AMGD` patička |
| Email Náberový list (`api/naber-pdf`) | rovnako |
| Email Reset hesla (`api/auth/forgot`) | rovnako |
| PDF Obhliadkový list | `Powered by AMGD` text v patičke |

### Tier 2/3
Aktuálne v projekte nie sú žiadne Tier 2 (B2B partnership) ani Tier 3 (AMGD vlastné plochy). Komponenty sú pripravené pre keď budú potrebné.

## Favicony

- `src/app/icon.svg` (32×32) — auto-detekované Next.js App Routerom ako favicon
- `src/app/apple-icon.svg` (180×180) — auto-detekované ako iOS touch icon
Žiadne `<link rel="icon">` v `<head>` netreba.

## Inter font

Loadovaný cez `next/font/google` v `app/layout.tsx` so subsetmi `["latin", "latin-ext"]` (potrebné pre slovenské diakritiky č š ž ľ ť á í é). Tailwind v4 mapuje `--font-inter` na `--font-sans` v `globals.css` `@theme inline`.

Brand komponenty v `style` hardcodujú `Inter, system-ui, -apple-system, sans-serif` ako fallback chain — fungujú aj keby font nebol loadovaný, ale s loadovaným Interom vyzerajú konzistentne.
