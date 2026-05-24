# Rola: UX / Visual Designer

> **Vedie**: Mgr. art. Šimon Tóth (E020). Reportuje COO.
> Pri každom novom UI komponente; a11y audit mesačne.

## Misia
Žiadne random UI patterny. Apple-style konzistencia. Accessibility ✓. Mobile responsive ✓. Dark mode coverage.

---

## Design system (z CLAUDE.md)

### Vizuálne princípy
- **Apple-style**: čisté biele karty na pozadí `#F5F5F7`, jemné tiene, žiadne zbytočnosti
- **Borderless feel**: minimum borders, max subtle shadows
- **Spacing**: konzistentne 4/8/12/16/24/32 px scale
- **Radius**: 8px (small), 12px (cards), 16px (modals)

### Farby (CSS premenné v globals.css)
- `--bg-base` / `--bg-surface` / `--bg-elevated`
- `--text-primary` / `--text-secondary` / `--text-muted`
- `--accent` (modrá #007AFF Apple)
- `--border`
- Dark mode = full coverage cez `data-theme="dark"`

### Typografia
- System font stack (-apple-system, BlinkMacSystemFont, "SF Pro", atď.)
- Sizes: 11px (label), 13px (body), 14px (input), 16px (heading sm), 20+ (heading)
- Weight: 400 (body), 600 (label/heading), 700 (titles)

### Komponenty
- **Button**: ghost / primary / danger, radius 10px, padding 10x16
- **Input**: border green ak filled, red ak error, default 1px var(--border)
- **Card**: bg white, shadow subtle, radius 12px
- **Modal**: backdrop blur, center, max-width
- **Toast/Notification**: top-right, auto-dismiss 5s

---

## Mobile-first

Komponenty `BottomTabs` (mobil) + `Sidebar` (desktop). Switch cez CSS media query.

Touch targets ≥ 44x44 px (Apple HIG).

Form fields nesmú byť pod fold (over scrollable).

---

## Accessibility (a11y) — WCAG 2.1 AA

- **Labels**: `<label htmlFor>` pre input, NIE `<div style={labelSt}>`. Bez toho screen reader nečíta. (Fix 2026-05-18 v NewKlientModal)
- **Aria-label** pre icon-only buttons
- **Keyboard navigation**: Tab order, Enter na submit, Esc na close modal
- **Focus visible**: 2px outline accent color
- **Color contrast** ≥ 4.5:1 pre text (testuj cez axe DevTools)
- **Alt text** pre obrázky, alebo `alt=""` ak decorative

---

## Dark mode

- Toggle v nastaveniach → `data-theme="dark"` na `<html>`
- CSS premenné v `globals.css` definujú obe varianty
- Komponenty musia respektovať premenné (nie hardcoded `#fff`)
- Test ALL pages pre dark mode coverage

---

## ✓ INVARIANTS

- **Žiadny hardcoded farba/spacing/font** v inline style (vždy cez CSS var alebo design tokens)
- **`<label htmlFor>`** pre inputs (a11y critical)
- **Touch targets ≥ 44px** mobile
- **Focus visible** na všetkých interactive
- **Dark mode podpora** všetkých nových komponentov

---

## ⚠ GAPS

### 1. Design system NEDOKUMENTOVANÝ ⚠
Žiadny Figma file, žiadny Storybook. Vývojári hádajú alebo copy-pastujú.

### 2. A11y audit nikdy spustený ⚠
Nevieme % WCAG compliance. Treba axe-core scan.

### 3. Dark mode coverage neúplný ⚠
Niektoré moduly možno nemajú dark variant.

### 4. Inline styles dominujú ⚠
Aktuálne `<div style={{...}}>` všade. Refaktor na CSS modules alebo Tailwind classes pre konzistenciu.

### 5. Mobile testing manuálne ⚠
Žiadny mobile device test v CI. Treba Playwright na rôzne viewporty.

---

## 🧪 Audit

```bash
./scripts/audit-ui.sh
```

1. Žiadne `<input>` bez `<label htmlFor>` alebo `aria-label`
2. Žiadne `<img>` bez `alt`
3. Žiadne hardcoded farby (`#FFF`, `#000`) v komponentoch — používaj CSS vars
4. Dark mode CSS vars použité v nových komponentoch
5. Touch target size ≥ 44px (manuálny check najprv)

---

## 📌 TODO

- [ ] Design system Figma file (P2)
- [ ] Storybook setup pre komponenty (P2)
- [ ] axe-core a11y audit v CI (P1)
- [ ] Inline style → CSS modules refaktor (P3, big)
- [ ] Mobile viewport tests v Playwright (P2)
