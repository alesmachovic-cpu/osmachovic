# Doména: Finančný systém

> **Owner**: Ing. Mária Polakovičová (E010) — Tech Lead. Backup: JUDr. Katarína Bartošová (E018) — Compliance.
> Po zmene spusti `scripts/audit-financie.sh`. Pre právne otázky vždy konzultuj Compliance.

## Účel
Provízie (vlastné + maklerské + sub-makléri split), faktúry (vystavené pre odberateľov), prehľad financií, účtovný prehľad (daň 15% / 21%), pravidelné mesačné náklady. Toto je oblasť kde **chyba = právny / daňový problém**.

---

## ✓ INVARIANTS

### Faktúry
- **Číslovanie unique + sequential per rok** (zákon o účtovníctve).
- Formát: `YYYY-NNNN` (napr. `2026-0001`).
- IČO 8 numerických znakov; DIČ formát `SK` + 10 digits.
- Daňová sadzba 15% (do 49,790 EUR ročne) alebo 21% (nad / DPH platca).
- PDF generation cez `/api/faktury/pdf` (service role).
- **Audit log pre KAŽDÉ vystavenie**.
- Retention: **10 rokov** (zákon).

### Provízie
- Vlastná provízia: % z predajnej ceny dohodnutá v náberáku.
- Maklerska provízia: split medzi sales maklér a pobočku (default 70/30).
- Sub-maklér (spolupracujúci): ďalšie split.
- `/potvrdenie-provizii` flow: maklér potvrdí prijatie peňazí pred výplatou.
- Audit pred výplatou: total split = 100%.

### Pravidelné náklady
- Cron `/api/cron/pravidelne-naklady` o 01:00 UTC daily.
- Auto-pridá náklad do `naklady` tabuľky 0-2 dni pred splatnosťou.
- Idempotent (ak už existuje pre ten mesiac → skip).
- Frontend: `/pravidelne-naklady` (admin-only POST/PATCH/DELETE).

### Účtovný prehľad
- `/uctovny-prehlad` agreguje: príjmy z faktúr, výdavky, daň, čistý zisk.
- Per kvartál + ročne.
- Export do CSV pre účtovníka.

### Cost tracking (AI/Google/Vercel)
- AI calls (Anthropic/Gemini/OpenAI) — token usage + price per call → tabuľka `ai_usage_log`.
- Google API (Calendar/Drive) — request count.
- Vercel function invocations.
- Mesačná summary, alert pri > $X (TBD threshold).

---

## ⚠ GAPS

### 1. Faktúra číslo race condition ⚠
Ak 2 účtovníci vystavia faktúru naraz → môžu dostať rovnaké číslo. Treba advisory lock alebo atomic generation cez DB sequence.

### 2. Pravidelné náklady defensive return (fix 2026-05-18) ✓
Frontend `/pravidelne-naklady` mal bug `e.filter is not a function`. Fix: `Array.isArray() ? data : []`. Verified.

### 3. AI cost tracking ⚠ neexistuje
Žiadny `ai_usage_log` tabuľku. Cost prekročený = nikto nevie kde sa peniaze utrácajú. Treba pridať.

### 4. Daňová zmena (legislativa SK) ⚠
Treba year-aware threshold. Hardcoded 49,790 EUR môže byť neaktuálne v 2027.

### 5. Faktúra retention enforcement ⚠
Aktuálne sa nič nemažú. Treba archive po 10 rokoch, žiadne predčasné erasure (override GDPR).

---

## 🔥 HOT FILES

| Súbor | Prečo |
|---|---|
| `src/app/api/faktury/pdf/route.ts` | PDF gen, faktúra číslo logic |
| `src/app/api/maklerske-provizie/route.ts` | Split logic |
| `src/app/api/makler-provizie-pct/route.ts` | Percentage config |
| `src/app/api/cron/pravidelne-naklady/route.ts` | Daily cron |
| `src/app/pravidelne-naklady/page.tsx` | UI, FIXED 2026-05-18 (defensive coerce) |
| `src/app/uctovny-prehlad/page.tsx` | Agregácia, daň calculation |
| `src/app/api/odberatelia/route.ts` | Subscribers (IČO/DIČ validation) |

---

## 🧪 Audit

```bash
./scripts/audit-financie.sh
```

1. Faktúra číslo sequence (žiadny duplicit v current year)
2. Cron `pravidelne-naklady` posledný úspešný beh < 36h
3. Daň hodnoty v code = 15% / 21% (nie iné)
4. IČO validation regex existuje
5. Audit log pre faktúra POST

---

## 📌 TODO

- [ ] Faktúra číslo atomic generation (DB sequence) — P1
- [ ] AI usage tracking tabuľka — P1
- [ ] Year-aware daňový threshold — P3
- [ ] Faktúra archive after 10y — P3

---

## História incidentov

- **2026-05-18** Pravidelné náklady frontend crash `e.filter is not a function`. Fix: defensive `Array.isArray()` coerce. Commit `5ecc967`.
