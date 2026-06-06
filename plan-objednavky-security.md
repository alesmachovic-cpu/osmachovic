# Plán — Security/GDPR fix modulu objednávok kupujúcich (/api/objednavky)

**Typ:** čisto security/GDPR. Nič iné nemeniť.
**Stav:** ✅ IMPLEMENTOVANÉ 2026-06-06 (cesta a, schválené CEO). Migr. 109 (company_id), route B1-B4 fixnuté, objednavky v TIER1. Overené: tsc, api-auth-guard ✓, audit-all 20=20 (baseline). Live smoke-test po deployi.

## Overené nálezy (potvrdené v kóde + DB 2026-06-06)
- **B1 (P0):** `GET` nemá `requireUser()` → ktokoľvek bez session stiahne všetky objednávky (PII kupujúcich: rozpočet, lokalita, požiadavky, klient_id). Porušuje API Security Rule 1.
- **B2:** `objednavky` **nemá `company_id`** (overené: stĺpce id, klient_id, druh, poziadavky, lokalita, cena_od/do, … — žiadny company_id; 061 pridalo company_id len `produkcia_objednavky`). RLS je *zapnuté* ale appka číta service-role (obchádza RLS) → multi-tenant scope NEEXISTUJE na app úrovni.
- **B3:** `PATCH`/`DELETE` majú `requireUser`, ale `.eq("id", id)` bez ownership/company kontroly + bez `logAudit` → IDOR + žiadna stopa.
- **B4:** `POST` robí `insert(body)` bez nastavenia vlastníka + bez overenia že `klient_id` patrí do firmy callera + bez auditu.
- **Procesná príčina:** `check-api-auth.mjs` má objednavky len v TIER 2 (warning) → chýbajúci GET auth CI nezachytil.

## Konzumenti (nesmie sa rozbiť)
GET bez filtra: `matching`, `manazer`, `notifikacie`, `kupujuci` (chcú objednávky svojej firmy). GET `?klient_id=`: `klienti/[id]`. DELETE `?id=`: `kupujuci`. POST/PATCH: `ObjednavkaForm`. → Scope podľa company vráti firme jej objednávky = rovnaké správanie ako dnes (single-tenant Vianema).

## Scope — dve cesty (čaká na rozhodnutie CEO)

### (a) Migrácia: `objednavky.company_id` + RLS — ODPORÚČAM
- Migrácia: `ADD COLUMN company_id uuid`; backfill z `klienti.company_id` cez `klient_id`; pre orphany default `a0000000-…001` (vzor 061); `SET NOT NULL`; index; RLS policy pre `authenticated`.
- GET/POST/PATCH/DELETE scopujú `.eq("company_id", scope.company_id)`.
- **Pre:** konzistentné s ostatnými tabuľkami (klienti/faktury/obhliadky… všetky majú company_id), rýchle (indexovaný filter), robustné (self-contained na riadku), prejde `audit-cross-tenant`. 
- **Proti:** mení schému → potrebuje súhlas CEO.

### (b) Bez migrácie: scope cez join na klient_id
- GET: načítať povolené `klient_id` firmy zo `klienti` (.eq company_id) → `objednavky.in("klient_id", allowedIds)`.
- POST/PATCH/DELETE: načítať objednávku → klient → overiť `klient.company_id == scope.company_id`.
- **Pre:** nemení schému.
- **Proti:** pomalšie (veľký IN list), krehké (každý nový konzument to musí pamätať — tak vznikla táto diera), neprejde cez company_id audit.

## Kroky (PO súhlase)
1. (ak a) Migrácia → aplikovať do test DB cez `supabase db query --linked`. Po ADD COLUMN grepnúť všetky insert/upsert objekty (Supabase padá ticho).
2. GET: `requireUser` + scope filter.
3. POST: `requireUser` (už je) + nastaviť company_id (a) / overiť klient (b) + `logAudit("objednavka.create")`.
4. PATCH: ownership/company check + `logAudit("objednavka.update")`.
5. DELETE: ownership/company check + `logAudit("objednavka.delete")` + zvážiť `requireReAuth` (nezvratné).
6. Procesná oprava: pridať `src/app/api/objednavky/route.ts` do `TIER1_MUST_HAVE_AUTH` v `check-api-auth.mjs`.
7. (nice-to-have) rozšíriť guard o kontrolu logAudit na POST/PATCH/DELETE.

## Verifikácia (pred commitom)
- `./scripts/audit-all.sh` + `node scripts/check-api-auth.mjs` — žiadny nový ✗ (baseline vs current).
- curl: GET bez session → 401; PATCH/DELETE s cudzím id → 403/404.
- Over že konzumenti (kupujuci, matching, manazer, notifikacie) fungujú.
