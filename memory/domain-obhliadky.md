# Doména: Obhliadky & Kalendár

> **Owner**: Ing. Jozef Kollár (E009) — Tech Lead. Backup: Ing. Roman Krištof (E011) — Google integrácia.
> Pred zmenou prečítaj. Po zmene spusti `scripts/audit-obhliadky.sh`.

## Účel
Obhliadka = stretnutie maklér + predávajúci + kupujúci na konkrétnom mieste/čase. CRM ich plánuje, deteguje kolízie (maklér nemôže mať 2 naraz), posiela pozvánky email/Google Calendar, eviduje podpis (s GDPR consent), generuje PDF.

Ak rozbité: klient nedostane termín, 2 obhliadky paralelne, podpis sa stratí → strata dôvery.

---

## ✓ INVARIANTS

### Scheduling & kolízie
- Pred uloženie obhliadky: `useKoliziaCheck` hook overí či nie je iná obhliadka pre rovnaký `makler_id` v rovnakom čase ±15 min.
- Ak kolízia → UI warning, ale maklér môže overdrive (free will).
- Calendar sync: po uloženie → POST `/api/google/calendar` vytvorí event v Google Calendar makléra.

### Detail vs List endpointy
- `/api/obhliadky` GET (list) = **bez `podpis_data`** (90% bandwidth reduction, fixed 2026-05-18).
- `/api/obhliadky/[id]` GET (detail) = vrátane `podpis_data` (pre display v `<img>`).
- Detail page `/obhliadky/[id]` musí volať detail endpoint, NIE list (fixed 2026-05-18).

### Podpis
- `podpis_data` = base64 PNG (canvas signature). `podpis_meta` = audit JSON (IP, UA, timezone, screen).
- GDPR consent flag + timestamp povinné pred podpisom.
- Po podpise: `status = "prebehla"`, immutable.

### Pozvánka emailom
- Po vytvorení obhliadky: optional email kupujúcemu cez `/api/obhliadky/pdf` POST (Resend).
- Email obsahuje PDF prílohu (obhliadkový list).

### Auto-detect z Google Calendar
- `/api/obhliadky/auto-detect` (cron 1×/day) scanuje Google Calendar makléra na eventy ktoré vyzerajú ako obhliadky (kľúčové slová, lokácia).
- Maklér potvrdí v Dashboard banneri "Možné obhliadky".
- **Skip ak `useGoogleConnected = false`** (fixed 2026-05-18, predtým spamoval 401).

### Calendar event lifecycle
- Pri vytvorení obhliadky: vytvor `calendar_event_id`.
- Pri zmene času: PATCH Google event (nie create new).
- Pri delete obhliadky: maker_id na delete Google event (cleanup).

---

## ⚠ GAPS

### 1. Kolízia check je len upozornenie ⚠
Maklér môže overdrive. Niekedy treba hard blocker (admin override only).

### 2. Email pozvánka idempotencia ⚠
Ak maklér klikne "odoslať email" 3x rýchlo, klient dostane 3 emaily. Treba dedup window.

### 3. Calendar sync error handling ⚠
Ak Google API zlyhá, obhliadka sa uloží ale calendar event nie. Maklér si nevšimne. Treba notification.

### 4. Token expirácia (Google) ⚠
Pri vyprošli refresh tokenu auto-detect zlyhá. Frontend gating (`useGoogleConnected`) pomáha ale user musí re-OAuth.

---

## 🔥 HOT FILES

| Súbor | Prečo |
|---|---|
| `src/app/api/obhliadky/route.ts` | List endpoint, podpis_data excluded (fixed) |
| `src/app/api/obhliadky/[id]/route.ts` | Detail endpoint, NEW 2026-05-18 |
| `src/hooks/useKoliziaCheck.ts` | Conflict detection |
| `src/app/api/obhliadky/auto-detect/route.ts` | Google scan, gated po fix |
| `src/app/api/obhliadky/pdf/route.ts` | PDF + email |
| `src/app/kalendar/page.tsx` | Calendar UI, gated po fix |

---

## 🧪 Audit

```bash
./scripts/audit-obhliadky.sh
```

1. Detail endpoint `/api/obhliadky/[id]` existuje
2. List endpoint NEVRACIA `podpis_data` (perf invariant)
3. Detail endpoint VRACIA `podpis_data`
4. `useGoogleConnected` gating v `/kalendar` aj dashboard
5. Žiadna obhliadka bez `company_id`/`makler_id`

---

## 📌 TODO

- [ ] Kolízia hard blocker (admin override) — P2
- [ ] Email dedup window pre invites — P2
- [ ] Calendar sync error notification — P1
- [ ] Token refresh recovery UX (delegate Google integrácia) — P1

---

## História incidentov

- **2026-05-18** /api/obhliadky vracal 177 KB / 16 obhliadok (91% podpis_data). Fix: SELECT explicit columns, nový detail endpoint /api/obhliadky/[id]. Commit `c389469`.
- **2026-05-18** /api/google/calendar a /api/obhliadky/auto-detect spamoval 401 keď user nemá Google connected. Fix: gating cez `useGoogleConnected` v dashboard a kalendar. Commit `345d832`.
