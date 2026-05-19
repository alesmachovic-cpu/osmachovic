# Doména: Náberáky, Zmluvy & Dokumenty

> **Owner**: Mgr. Lenka Mihalovičová (E008) — Tech Lead. Backup: JUDr. Katarína Bartošová (E018) — Compliance.
> Pred zmenou v scope tejto domény prečítaj. Po zmene spusti `scripts/audit-naberaky.sh`.

## Účel domény
Náberový list je legálny dokument medzi maklérom a klientom-predávajúcim. Definuje predaj, cenu, províziu, exkluzivitu. Z neho sa odvíjajú zmluvy: **ÚZ → RZ → KZ → ZZ → vklad do katastra**. Plus parsing LV (list vlastníctva) a znaleckého posudku.

Ak sa táto doména rozbije: nemôžeš uzatvoriť obchod, alebo právne neplatný dokument = súdny spor.

---

## ✓ INVARIANTS

### Náberový list
- Vytvorí ho len **vlastník klienta** alebo manažér pobočky alebo admin (`canEditRecord`).
- `klient_id` povinné (každý náber je viazaný na klienta).
- `company_id` automaticky z scope (NOT NULL).
- `makler_id` denormalizovaný z `klient.makler_id` (migrácia 070 z 2026-05-18).
- POST handler nastaví oba: `makler` text (legacy) + `makler_id` UUID.

### Podpis = nezmeniteľné
- Po podpise (`podpis_data` non-null) je náber **IMMUTABLE** — žiadna edit, žiadne delete (okrem admina, audit-logged).
- `podpis_meta` obsahuje audit dôkaz: IP, user_agent, timezone, screen, timestamp.
- GDPR consent flag + timestamp povinné pred podpisom.
- Výnimka: ak nový PATCH posiela explicit `podpis_data` (akcia "podpísať"), nezáleží na current state.

### Sled zmlúv
ÚZ (úschovná) → RZ (rezervačná) → KZ (kúpna) → ZZ (záložná) → vklad.
- Žiadne preskoky. KZ bez RZ je červený flag.
- Každá zmluva má svoj timestamp + scan v Google Drive.
- AML check pred KZ (požaduje Compliance).

### PDF generation
- `/api/naber-pdf` (GET = download, POST = email) **používa service role** (fixed 2026-05-18, predtým anon = 404 pre všetkých).
- Scope check: PDF stiahne len user z rovnakej firmy ako náber.
- Vyhradná zmluva: `/api/vyhradna-zmluva/pdf` — podobný pattern.
- Faktúra: `/api/faktury/pdf` — finančný systém domain.

### Parse-doc & Parse-pdf
- `/api/parse-doc` (max 300s timeout — Vercel výnimka): rasterized PDF + OCR + LLM parse.
- Klient-side PDF rasterization povinná (Vercel timeout limit).
- Podporované: LV, znalecký posudok, OP.
- Output: structured JSON, ktoré frontend predvyplní do formulára.
- **NIKDY nepošli surový PDF Anthropic API** (cost prohibition + privacy).

### Auto-vyplnené polia
- Frontend označuje polia ktoré boli auto-pripravené (z LV/posudok) vs user-entered.
- Po edit user-om: zaznač flag "modified" (audit-friendly).

---

## ⚠ GAPS

### 1. AML hard blocker pre KZ ❌
Aktuálne odporúčanie, treba blocker. Bez `aml_check_at` → POST KZ vráti 412.

### 2. Verzionovanie náberákov ⚠
Ak maklér edit-uje pred podpisom, nemáme history. Treba `naber_revisions` tabuľka.

### 3. PDF cache ⚠
Naber PDF generujeme on-demand, žiaden cache. Pri 100K náberov a opakovanej download = expensive. Treba CDN alebo memory cache.

### 4. Parse-doc retry ⚠
Ak Anthropic timeout, parse zlyháva tichotne. Treba retry s exponential backoff.

### 5. Zmluvy ÚZ/RZ/KZ chýbajú v UI? ⚠ overiť
Excel hovorí E008 owns "Náberáky, Zmluvy & Dokumenty" ale aktuálny audit nezistil samostatné endpointy pre ÚZ/RZ/KZ. Možno súčasťou náberového flow, treba potvrdiť.

---

## 🔥 HOT FILES

| Súbor | Prečo kritický |
|---|---|
| `src/app/api/nabery/route.ts` | CRUD náberákov. Po fix-e (070 + makler_id) pozor na regression |
| `src/app/api/naber-pdf/route.ts` | PDF gen, FIXED 2026-05-18 (anon → service role + scope) |
| `src/app/api/parse-doc/route.ts` | 300s timeout výnimka, LLM cost sensitive |
| `src/components/NaberyForm.tsx` | Hlavný formulár, validation rules |
| `src/components/VyhradnaZmluvaModal.tsx` | Vyhradná zmluva logika |
| `src/app/api/vyhradna-zmluva/pdf/route.ts` | Druhý PDF endpoint, podobný anon risk |
| `supabase/migrations/070_naberove_makler_id_and_perf_indexes.sql` | makler_id column + indexy |

---

## 🧪 Audit

```bash
./scripts/audit-naberaky.sh
```

Kontroluje:
1. Žiaden náber bez `company_id` ani `klient_id`
2. Náberáky s podpisom sú immutable (sample test: PATCH vracia 403)
3. `naberove_listy.makler_id` populated (migrácia 070 applied)
4. `/api/naber-pdf` vyžaduje session (curl bez cookie → 401)
5. Parse-doc Vercel timeout konfigurovaný na 300s

---

## 📌 TODO

- [ ] AML hard blocker pre KZ (P1)
- [ ] Verzionovanie náberákov (P2)
- [ ] PDF cache pre downloaded náberáky (P3)
- [ ] Parse-doc retry logic (P2)
- [ ] Audit ÚZ/RZ/KZ endpointov — existujú samostatne? (P2)

---

## História incidentov

- **2026-05-18** Naber-PDF vracal "Naber not found" pre VŠETKÝCH (anon RLS leak). Fix: service role + assertCanReadNaber. Commit `7afe9f3`.
- **2026-05-17** /api/nabery?mine=1 vracal 500 — chýbal stĺpec `makler_id` v `naberove_listy`. Fix: migrácia 070 + POST handler. Commits `34a1977`, `25d02d2`.
