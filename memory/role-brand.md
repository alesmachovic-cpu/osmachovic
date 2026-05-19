# Rola: Brand & Marketing Manager

> **Vedie**: Mgr. Veronika Kuchárová (E019). Reportuje COO.
> Pri každom UI copy; AI Writer output validation kontinuálne.

## Misia
Každý user-facing text dýcha rovnakou značkou. **Apple-style slovenčina**. Žiadne klišé. AI Writer output prejde brand check pred použitím.

---

## Brand voice (z CLAUDE.md)

### Hlas
- **Slovensky** (komunikácia s makléri, AI Writer output)
- **Stručne, konkrétne**, bez zbytočných úvodov
- **Honest** — žiadne marketingové superlatívy, žiadne nesplniteľné sľuby

### Apple-style princípy
- **Show, don't tell** — opíš pocit, nie features
- **Less is more** — vyrež nepotrebné slová
- **Predictable** — používateľ vie čo sa stane keď klikne
- **Klúčové info first** — najdôležitejšie na začiatok

### Zakázané frázy / klišé (blacklist)
- "vysnívaný domov" / "dream home"
- "jedinečná príležitosť" / "exclusive opportunity"
- "must see"
- "neopakovateľná ponuka"
- "raj na zemi"
- "luxusný" (ak neobjektívne kvalifikovaný)
- "moderne riešený interiér" (mlhavé)
- Nadmerné emoji (povolené iba v Social Snippet)

---

## Zodpovedná za

### Property Stories format (AI Writer)
4 časti, presný formát:
- `[The Hook]` — 1 veta, hlavička zachytávajúca esenciu
- `[The Lifestyle]` — 3 krátke odstavce o pocit z bývania
- `[The Investment Logic]` — 1 veta o ekonomike (market data + cena)
- `[Social Snippet]` — 2-vetová verzia pre IG/WhatsApp (emoji povolené)

### Pravidlo troch
Presne 3 unique selling points. Nie 2, nie 5.

### Neviditeľná technológia
"South-facing windows" → ZLE.
"Natural light that follows your morning coffee" → DOBRE.

### Data-driven
Použi market sentiment dáta na zdôvodnenie ceny. AI Writer má prístup k AI Analýza output.

### UI Copy
- Error messages: konkrétne, akčné. "Chyba" je zlé. "Heslo musí mať 12 znakov" je dobré.
- Empty states: nielen "Žiadne dáta". Vysvetli prečo + čo robiť ďalej.
- Tooltips: hint, nie redundancia label-u.
- Tlačidlá: imperatív (Uložiť, nie Uloženie).

### Email šablóny (Resend)
- Subject: konkrétny, žiadne emoji v subjecte (spam filter).
- Body: krátky + clear CTA.
- Personalizácia (meno, kontext).

---

## ✓ INVARIANTS

- **AI Writer output prejde brand check** pred zobrazením userovi (regex match: blacklist? formát?)
- **Property Stories** vždy 4 časti
- **Žiadne emoji v UI** okrem `[Social Snippet]`, `<Badge>` komponentov
- **Slovenský pravopis** — diacritics (ť, š, č, ž, ý, á, í, é, ú, ô, ä, ô) povinné
- **Konzistentná terminológia** (z CLAUDE.md doménový slovník: klient, nehnuteľnosť, náberáky, obhliadka, atď.)

---

## ⚠ GAPS

### 1. AI Writer brand validation ⚠
Aktuálne sa Property Story zobrazuje user-ovi bez automatic blacklist scan. Treba pre-display regex validation + regenerate ak match.

### 2. UI copy inventory ❌
Žiadny zdrojový zoznam všetkých user-facing textov. Pri jazykovej zmene = ručná oprava per súbor.

### 3. Email šablóny v code, nie v Resend ⚠
Aktuálne sú hardcoded v src/lib/email/templates/. Resend dashboard má nice editor — možno presunúť.

### 4. Slovenský pravopis check ⚠
Žiadny automated spell-check. Treba.

---

## 🧪 Audit

```bash
./scripts/audit-content.sh
```

1. AI Writer route obsahuje brand voice blacklist
2. Property Story formát templovaný (4 časti)
3. Žiadne anglické UI texty (zoznam zakázaných slov)
4. Žiadne emoji v UI mimo Social Snippet
5. Error messages konkrétne (pattern: "X musí mať Y" alebo "Chýba X")

---

## 📌 TODO

- [ ] AI Writer pre-display brand validation + retry (P1)
- [ ] UI copy inventory + i18n setup (P2)
- [ ] Slovak spell-check v CI (P3)
- [ ] Email šablóny migrácia do Resend dashboard (P3)
