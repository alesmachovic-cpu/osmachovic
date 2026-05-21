# Doména: Security & Auth

> **Owner**: každý kto mení súbory v `src/lib/auth/`, `src/middleware.ts`, `src/app/api/auth/`,
> `src/lib/audit.ts`, alebo akúkoľvek RLS policy v `supabase/migrations/`. **Pred zmenou
> prečítaj tento dokument celý. Po zmene spusti `scripts/audit-security.sh`.**

---

## 🔒 PRIORITY DIRECTIVE — Regression Guardian Mode (2026-05-21)

**Aktivované CEO (Aleš).** Platí do odvolania.

CEO sa sústredí na nové features. Existujúci security baseline (8/10 B+) **nesmie regresnúť**. Detaily v `memory/role-security-auditor.md` (sekcia "PRIORITY DIRECTIVE").

**TL;DR pre každého kto píše kód:**
1. Pred merge spusti `scripts/audit-security.sh` a porovnaj výstup s `security-audit/baseline-2026-05-21.txt`.
2. Nová `WARN` alebo `FAIL` v scripte = BLOCK merge.
3. 3 known gaps (HSTS, dev access, CSP unsafe-inline) sú v backlogu — netriešiť aktívne, neutláčať CEO.
4. Známe pen-test fixy z minulého týždňa (C1+C2+C4+M1+M2) sú TABU — žiadna zmena nesmie ich oslabiť.

---

## Účel domény
Chráni autentifikáciu, autorizáciu a integritu citlivých operácií. Ak sa táto doména rozbije,
útočník môže prevziať konto makléra, vidieť dáta cudzej firmy, alebo manipulovať audit log.

---

## ✓ INVARIANTS — toto **MUSÍ** platiť za každú cenu

### Auth flow
- **Login**: `src/app/api/auth/login/route.ts`
  - **Rate limit aktívny**: max 5 pokusov / 15 min na (IP, identifier). Tabuľka `login_attempts`.
  - Heslá overené cez `validatePasswordStrength()` z `src/lib/auth/password.ts` (min. 12 znakov, mix).
  - Po úspešnom login → HMAC podpísaná session cookie `crm_session` (SESSION_SECRET).
- **Logout**: `src/app/api/auth/logout/route.ts` mažé cookie + cleanup.
- **Reset**: token expirácia ≤ 1h, single-use, hash uložený v DB (nie plain).
- **Register**: len admin môže vytvoriť účet (`isSuperAdmin(role)` check).

### Session
- HMAC podpis cez `SESSION_SECRET` env (nie verejný kľúč).
- `readSessionUserId(req)` v `src/lib/auth/requireUser.ts` overuje podpis. **Nepoužívaj `req.cookies` priamo na user_id**.
- Cookie: `httpOnly`, `Secure` (prod), `SameSite=Lax`.

### Middleware (`src/middleware.ts`)
- **Host whitelist**: len `vianema.amgd.sk`, `dev.amgd.sk`, `localhost:3000-3001`. Žiadne `*.vercel.app` priame URL.
- **Billing guard**: ak cookie `crm_billing=suspended` → redirect na `/nastavenia?tab=billing` (okrem `BILLING_EXEMPT` cesto).
- **CSP**: `'unsafe-inline'` bez nonce (Next.js bootstrap to vyžaduje). NEpridávaj nonce — rozbije hydratáciu.

### Autorizácia (per-request)
- `requireUser(req)` na všetkých chránených API → vracia { user } alebo error response.
- `isSuperAdmin(role)` len pre admin/owner endpointy (POST /api/users, DELETE pravidelné náklady, atď.).
- `getUserScope(userId)` → `{ company_id, makler_id, isAdmin, role }`. **Vždy filtruj DB queries cez `scope.company_id`** (multi-tenancy).
- `canEditRecord(scope, ownerMaklerId)` overuje vlastníctvo. NEpoužívaj raw `===` na makler_id.

### RLS
- 19 migrácií so `ENABLE ROW LEVEL SECURITY`. Aktuálne policies sú **prevažne `USING (true)`** = permisívne. App layer je primary defense.
- **NIKDY nepridávaj `anon` policy s `USING (true)`** — anon API kľúč je verejný. Ak chceš anon access, pridaj explicitné WHERE filtre.
- Service role kľúč (SUPABASE_SERVICE_ROLE_KEY) je server-only, nikdy v klientovom kóde.

### Audit log (`src/lib/audit.ts`)
- Aktuálne logované: login, password reset, GDPR export/erasure, user CRUD, náber edit.
- **Mali by aj**: zmena company settings, mazanie klienta, vypnutie 2FA (keď bude), zmena RLS, role change.

### GDPR
- Consent flag v `klienti.gdpr_consent` + timestamp `gdpr_consent_at` (audit dôkaz).
- `obhliadky.podpis_meta` obsahuje user_agent, IP, screen, timezone — audit pre podpis.
- Export: `/api/gdpr/export` (logované cez audit_log).
- Erasure: `/api/gdpr/erasure` (logované, kaskádové mazanie).

---

## ⚠ GAPS — čo by malo existovať ale NEEXISTUJE

### 1. **30-day device verification** ❌ chýba
**Požiadavka**: každý maklér by mal každých 30 dní znova overiť identitu (re-login + možno email confirm) na **každom zariadení** kde používa CRM. Slúži ako ochrana pri ukradnutom laptope / cudzom prístupe.

**Implementačný plán** (keď bude treba):
- Tabuľka `user_devices(user_id, device_fingerprint, last_verified_at, expires_at)`
- Middleware: ak `expires_at < NOW()` → redirect na `/auth/verify-device`
- Pri prvom login po expirácii: posli verification mail s OTP
- Po potvrdení: update `last_verified_at = NOW(), expires_at = NOW() + 30 days`

**Status**: NEnaplánované do žiadneho sprintu. Pripomienka v audit scripte.

### 2. **2FA / TOTP** ❌ chýba
**Riziko**: ak je heslo unikne (phishing), útočník má plný prístup.
**Plán**: TOTP cez `otplib`, QR setup v `/nastavenia`, optional pre maklérov, mandatory pre adminov.

### 3. **Komplexný audit log coverage** ⚠ čiastočné
Aktuálne 8 routes logujú do audit_log. Mali by aj všetky write operácie (POST/PATCH/DELETE) na:
- klienti, nehnuteľnosti, obhliadky, naberove_listy, faktury, provizia, users, company settings

### 4. **RLS sprísnenie** ⚠ permissive
Súčasné `USING (true)` je technický dlh. Defense-in-depth chce ozajstné policies:
- `klienti`: `USING (auth.uid() IN (SELECT user_id FROM users WHERE company_id = klienti.company_id))`
- Podobne pre ostatné tabuľky.

### 5. **Anon RLS audit** ⚠ neúplné
Po fix-e `naber-pdf` (anon role nemala SELECT na naberove_listy) podozrievam že iné endpointy môžu mať podobný problém. Treba systematický scan: pre každú tabuľku, čo vidí anon role?

### 6. **Session rotation** ⚠ neimplementované
Po zmene hesla, password reset, role change → invalidovať všetky existujúce sessions usera.

### 7. **Automated security tests** ❌ chýba
Žiadne Vitest testy pre auth flows. Treba aspoň: login rate limit, session HMAC, scope leak prevention.

---

## 🔥 HOT FILES — pred zmenou v týchto súboroch dvakrát premysli

| Súbor | Prečo kritický |
|---|---|
| `src/middleware.ts` | Každý request prejde cez to. Chyba = celá appka padá alebo otvorená |
| `src/lib/auth/session.ts` | HMAC sign/verify. Bug = útočník vie vytvoriť falošnú session |
| `src/lib/auth/requireUser.ts` | Authorization root. Bypass = každý je admin |
| `src/lib/auth/companyScope.ts` | Multi-tenancy. Chyba = užívateľ A vidí dáta firmy B |
| `src/lib/auth/password.ts` | Hash + verify. Chyba = heslá v plain texte alebo always-pass |
| `src/app/api/auth/login/route.ts` | Rate limit + credential check. Bug = brute force open |
| `src/lib/audit.ts` | Audit trail. Chyba = útok je neviditeľný |
| `src/lib/scope.ts` | `canEditRecord`, ownership. Bug = zmeniť cudzie dáta |

---

## 🧪 Pravidelný audit

Po každej zmene v doméne (alebo aspoň raz týždenne):
```bash
./scripts/audit-security.sh
```
Output: zelené = OK, červené = treba fix.

---

## 📌 Otvorené tickety / TODO (z minulých debriefov)

- [ ] 30-day device verification (P1)
- [ ] 2FA (P2)
- [ ] Audit log na všetky write operácie (P2)
- [ ] RLS sprísnenie z USING(true) na ozajstné policies (P3, big project)
- [ ] Anon RLS systematický scan (P2)
- [ ] Vitest auth flow testy (P3)

---

## História významných incidentov

- **2026-05-18** Aleš nahlásil že Rastislav nevidel klientov v náber pickeri. Príčina: RLS na `users` a `makleri` nemá `anon` policy + frontend volal anon supabase priamo. Fix: `maklerMap.ts` prepísané na `/api/users` a `/api/makleri` (service role). Commit `25d02d2` (main), `55136c7` (dev). → **Pridať do gaps**: anon RLS systematický scan.
- **2026-05-17** naber-pdf vracal "Naber not found" pre všetkých. Príčina: route používala anon kľúč na naberove_listy ktorá nemá anon RLS policy. Fix: service role + scope check. Commit `7afe9f3`.
