# Doména: Nehnuteľnosti & Portfólio

> **Owner**: Mgr. Andrej Krištofík (E007) — Tech Lead. Backup: Ing. Petra Suchá (E006) — Klienti.
> Pred zmenou prečítaj. Po zmene spusti `scripts/audit-nehnutelnosti.sh`.

## Účel
Listings (nehnuteľnosti) sú "tovar" CRM. Maklér ich nabíra, fotografuje (Drive), publikuje na portáloch (Bazos, Reality, Nehnuteľnosti), matchuje s kupujúcimi. Portfólio view = personalizovaný zoznam pre makléra alebo admina.

Ak rozbité: nehnuteľnosti sa neukazujú, fotky sa stratia, matching nefunguje → maklér nezarobí.

---

## ✓ INVARIANTS

### Vlastníctvo
- Každá nehnuteľnosť má `company_id` (multi-tenant) + `makler_id` (vlastník).
- Inzerát ide pod menom makléra; pri delegate môže admin overdrive `makler_id`.
- Scope: maklér vidí len vlastné default; manažér pobočky peers; admin all.

### Fotky
- **NIKDY v DB** — vždy v **Google Drive** v priečinku klienta.
- DB má len Drive file ID + thumbnail URL.
- Pri delete nehnuteľnosti: Drive súbory ostávajú (audit dôvod, neskôr cleanup cron).
- Pri GDPR erasure klienta: Drive priečinok sa archiwuje, nie maže (faktúry).

### Portfolio view
- `/portfolio` → maklér: jeho ponuky. Admin: všetky ponuky firmy + filter per maklér.
- Sortable, filterovateľné (typ, kraj, cena range).
- Bulk akcie: publikovať, stiahnuť, archive.

### Matching
- `/matching` (alebo cez modal) = nájdi kupujúcich pre nehnuteľnosť (alebo opačne).
- Algoritmus: lokalita + typ + plocha + cena range.
- Idempotent: re-run s tými istými dátami = rovnaký výsledok.
- AI matching cez `/api/matching/*` — používa Claude/Gemini pre semantic match.

### Inzerát publish
- `/api/inzerat/save` POST = save draft. **MUSÍ** mať `company_id` (fixed 2026-05-18).
- Publish na portál (Bazos / Reality / Nehnuteľnosti) = external API call + retry/log.
- Bonus: AI Writer (Eva, E012) generuje Property Story pre publish.

---

## ⚠ GAPS

### 1. Drive link rot ⚠
Žiaden check že fotky v Drive stále existujú. Treba periodic audit.

### 2. Bulk publish error handling ⚠
Ak publish na Bazos zlyhá pre 1/10 inzerátov, ostatné prejdú ale nikto si nevšimne fail. Treba progress tracker.

### 3. Matching algoritmus dokumentácia ⚠
Algoritmus nikde nepopísaný. Maklér nevie prečo dostal X kupujúcich.

### 4. Inzerát validation pre portály ⚠
Každý portál má iné required fields (Bazos ≠ Reality). Pred publish musí byť validation aby sme nedostali 400.

### 5. Drive priečinok auto-create ⚠
Pri novej nehnuteľnosti by mal byť auto-vytvorený Drive priečinok. Aktuálne manuálne?

---

## 🔥 HOT FILES

| Súbor | Prečo |
|---|---|
| `src/app/api/nehnutelnosti/route.ts` | CRUD listings |
| `src/app/api/inzerat/save/route.ts` | Save draft + publish, FIXED 2026-05-18 (company_id) |
| `src/components/InzeratForm.tsx` | Hlavný formulár, validations |
| `src/app/portfolio/page.tsx` | View pre maklera/admina |
| `src/app/matching/page.tsx` | Matching UI |
| `src/lib/matching/*` | Algorithm |

---

## 🧪 Audit

```bash
./scripts/audit-nehnutelnosti.sh
```

1. Žiadna nehnuteľnosť bez `company_id`/`makler_id`
2. `inzerat/save` POST má scope derivation (fixed 2026-05-18)
3. Drive file IDs v DB nie sú duplicit
4. Matching test (ak existuje) prejde
5. Portfolio page sa renderuje bez TS errors

---

## 📌 TODO

- [ ] Drive link rot periodic audit (P2)
- [ ] Bulk publish progress tracker (P2)
- [ ] Matching algoritmus dokumentácia (P3)
- [ ] Portal-specific validation pre publish (P1)
- [ ] Drive priečinok auto-create cron (P3)

---

## História incidentov

- **2026-05-18** Inzerát save vracal "null value in column company_id" pre test user-a. Fix: derive `company_id` zo scope + VIANEMA fallback. Commit `5ecc967`.
