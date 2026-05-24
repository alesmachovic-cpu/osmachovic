# Doména: Klienti & Pipeline

> **Owner**: Ing. Petra Suchá (E006) — Tech Lead. Backup: Mgr. Zuzana Novosadová (E022) — Customer Success.
> Pred zmenou v scope tejto domény prečítaj tento dokument. Po zmene spusti `scripts/audit-klienti.sh`.

## Účel domény
Klient je core entity celého CRM. Pipeline (kontakt → dohodnutý → nabraný → aktívny → inzerovaný → obhliadky → rezervácia → podpis KZ → vklad → predaný) musí byť konzistentná. Ownership (`makler_id`) určuje kto má prístup. GDPR/AML compliance je law.

Ak sa táto doména rozbije: stratíš predaj, dáta klienta sú v zlej ruke, alebo prídeš o GDPR pokutu.

---

## ✓ INVARIANTS

### Pipeline statusov
Klient má `status` z definovaného enum-u v `STATUS_LABELS` (`src/lib/database.types.ts`). Tranzície:
- `novy_kontakt` → `dohodnuty_naber` (cez naber UI, dátum náberu set)
- `dohodnuty_naber` → `nabrany` (po podpísaní náberového listu)
- `nabrany` → `aktivny` (inzerát publikovaný)
- `aktivny` → `rezervovany` (po RZ podpise)
- `rezervovany` → `podpis_kz` → `vklad` → `predany`
- Aj `volat_neskor`, `nezaujem` (terminal)
- `uvolneny` (po 24h dropoff bez aktivity, cez cron)

**Žiadne skoky cez statusy** — vždy through legitimate flow. Override len adminom + audit log.

### Ownership & scope
- Každý klient má `company_id` (multi-tenancy) + `makler_id` (primary owner).
- Voliteľne `spolupracujuci_makler_id` (collaborator pri provizii split).
- Scope check: `canEditRecord(scope, klient.makler_id)` — pre POST/PATCH/DELETE.
- Read scope: `getReadFilter(scope)` vracia povolené makler_ids (admin → null = all; manažér → pobočka peers; maklér → len vlastné).
- **Telefón unique per company** — pri novom kliente check duplicit.

### GDPR
- `gdpr_consent` boolean + `gdpr_consent_at` timestamp — audit dôkaz.
- `/api/gdpr/export` exportuje všetky dáta klienta (klient + nábery + obhliadky + dokumenty).
- `/api/gdpr/erasure` cascade-mažú: klient → nábery → obhliadky → klient_dokumenty.
- Po erasure: log v `audit_log` (kto, kedy, ID anonymized).
- **NIKDY nemažem prv ako uplynie retention** (default 10 rokov pre faktúry, špeciálne pre náberáky).

### Klientská zóna
- `/klientska-zona/[token]` — public-facing portal pre klienta.
- **Token** = signed UUID, NIE sequential ID (anti-enumeration).
- Klient vidí len SVOJE dáta (timeline predaja, dokumenty, fotky).
- Read-only z DB perspektívy (klient nemení dáta).

### Uvoľnenie (24h dropoff)
- Cron `/api/cron/volni-klienti` o 05:00 UTC: klient bez aktivity >24h od `novy_kontakt` → `uvolneny`.
- Notifikácia push/email maklérovi.
- Uvoľnený klient v `/volni-klienti` UI, iný maklér ho môže prevziať.

### AML
- Pred podpisom KZ musí byť `aml_check_at` vyplnený (=admin/maklér potvrdil identitu).
- `aml_dokument_id` link na OP/pas sken v Drive.

---

## ⚠ GAPS

### 1. Klientská zóna token security ⚠ overiť
Predpoklad: signed UUID. Treba overiť `src/app/klientska-zona/[token]/page.tsx` že naozaj nie sequential ID exposed.

### 2. Telefón dedup ⚠ slabé
`NewKlientModal.tsx` má fuzzy check (last 9 digits) ale nie hard constraint v DB. Treba `UNIQUE INDEX ON klienti(company_id, normalized_phone)`.

### 3. AML enforcement ⚠ chýba blocker
Aktuálne AML check je odporúčaný, nie blocking. Pred KZ podpis by mal byť hard blocker.

### 4. Uvoľnenie race conditions ⚠
Ak maklér aktualizuje klienta presne pri cron behu, klient sa môže "uvoľniť" napriek active práci. Treba advisory lock alebo trigger-based logic.

### 5. Cross-makler delegate audit ⚠
Keď admin reassign-ne klienta inému maklérovi, treba audit log entry. Aktuálne nie je garantované.

---

## 🔥 HOT FILES

| Súbor | Prečo kritický |
|---|---|
| `src/lib/scope.ts` | Ownership logic — bug = vidíš cudzieho klienta |
| `src/lib/maklerMap.ts` | UUID mapping (FIXED 2026-05-18, nesmie regression) |
| `src/app/api/klienti/route.ts` | CRUD endpoint, makler_id derivation |
| `src/components/NewKlientModal.tsx` | Creation flow, dedup, validations |
| `src/app/klienti/[id]/page.tsx` | Detail page (canFillNaber check) |
| `src/app/api/cron/volni-klienti/route.ts` | 24h dropoff logic |
| `src/app/api/gdpr/erasure/route.ts` | Permanent delete, audit critical |
| `src/app/klientska-zona/[token]/page.tsx` | Public-facing, security sensitive |

---

## 🧪 Audit

```bash
./scripts/audit-klienti.sh
```

Kontroluje:
1. Žiadny klient bez `company_id`
2. Status hodnoty v enum (sample check)
3. Telefón format (digits + length)
4. GDPR consent flag pre nabraný+ klientov
5. Cron `volni-klienti` posledný úspešný beh < 36h

---

## 📌 TODO

- [ ] DB constraint pre telefón unique per company (P2)
- [ ] AML hard blocker pred KZ (P1)
- [ ] Cross-makler reassign audit log (P2)
- [ ] Klientská zóna token security review (P1)
- [ ] Volni-klienti cron race condition fix (P3)

---

## História incidentov

- **2026-05-18** (Rastislav bug) — non-admin maklér nevidel klientov v náber pickeri. Príčina: `maklerMap.ts` použival anon kľúč, RLS blokoval. Fix: použiť `/api/users` a `/api/makleri` server-side. Commits `55136c7` (dev), `25d02d2` (main).
