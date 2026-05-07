# ANALYSIS.md — VIANEMA Real CRM: Architektúra, Gap analýza, Plán rozšírenia

> **Fáza 0 — výstup pre review pred implementáciou**  
> Dátum: 2026-05-07 | Autor: Claude (Sonnet 4.6) | Verzia: 1.0

---

## 1. Tech Stack

| Vrstva | Technológia | Verzia |
|--------|-------------|--------|
| Framework | Next.js (App Router) | 16.1.7 |
| UI runtime | React + React DOM | 19.2.3 |
| Jazyk | TypeScript (strict) | 5.x |
| Databáza | PostgreSQL cez Supabase | 2.99.3 |
| AI | Anthropic Claude (Sonnet 4.5/4.6) | SDK 0.80.0 |
| Šifrovanie | AES-256-GCM (aplikačná vrstva) | Node.js crypto |
| Hashovanie hesiel | bcryptjs | 3.0.3 |
| PDF | jsPDF + pdf-parse + pdfjs-dist | — |
| Testovanie | Vitest | 2.1.9 |
| Nasadenie | Vercel (Node.js runtime) | — |
| CI/CD | GitHub → Vercel auto-deploy | — |

**Dôležité:** Všetky API routes majú `export const runtime = "nodejs"` — žiadny Edge runtime. Umožňuje `crypto`, file I/O, bcrypt.

---

## 2. Architektúra & Auth

### 2.1 Autentifikácia

- **POST /api/auth/login** — identifier (email/meno/telefón) + bcrypt heslo
- **Session:** HMAC-signed httponly cookie (nie JWT zasielaný klientovi)
- **Rate limiting:** max 5 failed/15 min na IP aj identifier — tabuľka `login_attempts`
- **Ochrana:** dummy bcrypt call pre neexistujúcich userov (timing-attack resistant)
- **Google OAuth:** `/api/auth/google/callback` — tokeny v `users.google_{access,refresh}_token`
- **Password reset:** token_hash v `password_reset_tokens`

### 2.2 RBAC (Role-Based Access Control)

```
super_admin  →  plný prístup, všetky pobočky
majitel      →  všetky pobočky, nie interné admin operácie
manazer      →  len vlastná pobočka + podriadení makléri
makler       →  len vlastní klienti/nehnuteľnosti
```

Implementované cez `src/lib/scope.ts`:
- `getUserScope(userId)` — načíta rolu, pobočku, makler_id (cache 30s)
- `canEditRecord(scope, recordMaklerId)` — ownership check
- `getReadFilter(scope)` — vracia zoznam `makler_ids` pre filtrovanie

### 2.3 Databázové tabuľky (kompletný zoznam)

| Tabuľka | Účel | GDPR kategória |
|---------|------|----------------|
| `klienti` | Klienti (kupujúci/predávajúci/nájomcovia) | `personal` |
| `nehnutelnosti` | Nehnuteľnosti v portfóliu | `none` (ak bez mena) |
| `naberove_listy` | Náberové listy s podpisom | `personal` + `financial` |
| `obhliadky` | Prehliadky nehnuteľností | `personal` |
| `klient_dokumenty` | Dokumenty (šifrované) | `personal` + `financial` + `identification` |
| `users` | Systémoví používatelia | `personal` |
| `pobocky` | Pobočky RK | `none` |
| `makleri` | Profily maklérov | `personal` |
| `faktury` | Faktúry | `financial` |
| `logy` | Activity logy (legacy) | `personal` (referencie) |
| `audit_log` | Compliance audit trail | `personal` (metadata) |
| `login_attempts` | Auth forensics | `personal` (IP) |
| `password_reset_tokens` | Reset hesiel | `personal` |
| `monitor_inzeraty` | Scrapované inzeráty z portálov | `personal` (predajca) |
| `monitor_filtre` | Sledovacie filtre | `none` |
| `monitor_notifikacie` | Notifikačný log | `none` |
| `monitor_inzeraty_snapshots` | Denné cenové snímky | `none` |
| `monitor_inzeraty_disappearances` | Detekcia predajov | `none` |
| `motivation_signals` | Motivačné signály predajcov | `none` |
| `market_sentiments` | Trhové sentimenty | `none` |
| `pricing_estimates` | Cenové odhady (AI cache) | `none` |
| `property_stories` | AI popisy nehnuteľností | `none` |
| `klienti_history` | Audit trail voľných klientov | `personal` (referencie) |
| `push_subscriptions` | Web push subscriptions | `personal` (device token) |
| `signature_otps` | OTP pre podpisy | `personal` |
| `ulohy` | Jednoduché úlohy | `none` |

---

## 3. Existujúce GDPR opatrenia

### ✅ Čo už existuje

| Opatrenie | Implementácia | Kvalita |
|-----------|---------------|---------|
| **Consent pri nabere** | `naberove_listy.gdpr_consent` + `gdpr_consent_at` + `podpis_meta` (IP/UA/verzia) | Dobrá |
| **Consent pri obhliadke** | `obhliadky.gdpr_consent` + `gdpr_consent_at` + `podpis_meta` | Dobrá |
| **Právo na výmaz** | `/api/klienti/anonymize` — pseudonymizácia mena/emailu/telefónu | Čiastočná |
| **Šifrovanie at-rest** | AES-256-GCM pre `klient_dokumenty.text_content` + `data_base64` | Dobrá |
| **Audit log** | Tabuľka `audit_log` (user, action, entity, IP, timestamp) | Dobrá |
| **Auth ochrana** | Rate limiting, bcrypt, HMAC cookies, timing-resistant | Výborná |
| **RLS** | Všetky tabuľky majú RLS enabled | Čiastočná (politiky sú lib allow_all) |
| **Anonymizácia flag** | `klienti.anonymized_at` timestamptz | Dobrá |
| **HTTP security headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options | Dobrá |

### ❌ GDPR Gaps (chýba)

| Gap | Popis | Riziko | Priorita |
|-----|-------|--------|----------|
| **Register spracovateľských činností (RoPA)** | Žiadny modul pre čl. 30 GDPR | Pokuta ÚOOÚ | KRITICKÁ |
| **Consent management entita** | Súhlasy evidované len v podpisoch, nie v standalone tabuľke | Strata dôkazov | VYSOKÁ |
| **Retention policy cron** | Žiadne automatické mazanie po uplynutí lehoty | Právne riziko | VYSOKÁ |
| **AML/KYC modul** | Zákon č. 297/2008 vyžaduje identifikáciu pri obchodoch >10 000 € | Regulačné riziko | VYSOKÁ |
| **Data Subject Rights panel** | Žiadny admin panel pre žiadosti podľa čl. 15-21 | GDPR porušenie | VYSOKÁ |
| **DPIA dokumentácia** | Žiadna šablóna ani evidencia DPIA | Audit riziko | STREDNÁ |
| **DPA register** | Žiadny zoznam sprostredkovateľov (Vercel, Supabase, Anthropic, Resend...) | Čl. 28 GDPR | STREDNÁ |
| **Striktné RLS politiky** | Všetky tabuľky majú `allow_all` — ochrana len na app vrstvei | DB breach riziko | STREDNÁ |
| **Retention na audit_log** | Audit log nemá cleanup cron (GDPR: max 2 roky) | Zbytočné uchovávanie | NÍZKA |
| **Cookie banner** | Žiadny granular cookie consent pre web | ePrivacy riziko | NÍZKA |
| **2FA** | Povinná 2FA pre admin role chýba | Bezpečnostné riziko | STREDNÁ |

---

## 4. Existujúce moduly — stav

| Modul | Stav | Silné stránky | Chýba |
|-------|------|---------------|-------|
| **Klienti** | ✅ Plný | Status tracking (13 stavov), anonymizácia, docs, history | Interaction log, GDPR tab, právny základ spracovania |
| **Nehnuteľnosti** | ✅ Plný | AI scoring, multi-portal export, AI popis | Fázové workflow transakcie |
| **Náber** | ✅ Plný | Digitálny podpis, PDF, GDPR consent audit, calendar sync | Bulk intake, task automation |
| **Obhliadky** | ✅ Plný | Podpis, PDF, email, Google Calendar, GDPR consent | Interaction notes, follow-up automation |
| **Inzerát** | ✅ Plný | Tvorba, publikácia, médiá, status tracking, AI | — |
| **Faktúry** | ✅ Čiastočný | Per-makler číslovanie, PDF | Platby, overdue tracking, väzba na transakcie |
| **Monitor** | ✅ Plný | 3-portálový scraper, 9 signálov, cenové snímky, detekcia predajov | — |
| **Štatistiky** | ✅ Plný | Obrat, KPI, period filter, pobočky/makléri | Export, prognózy |
| **Tím** | ✅ Plný | RBAC, pobočky | — |
| **Voľní klienti** | ✅ Plný | SLA eskalácia (24h→48h→72h) | — |
| **Ulohy** | ⚠️ Základný | Jednoduchý zoznam | Kanban, priradenie, deadline, prepojenie na entity |
| **Lead pipeline** | ❌ Chýba | — | Dedikovaná entita, vizualizácia, scoring |
| **Interakcie klienta** | ❌ Chýba | Audit log existuje | Call/email/meeting log, timeline |
| **Transakčné fázy** | ❌ Chýba | — | Workflow predaja/kúpy po krokoch |
| **Knowledge base** | ❌ Chýba | — | Trhové reporty, šablóny, porovnateľné predaje |
| **AML/KYC** | ❌ Chýba | — | PEP kontrola, sankčné zoznamy, identifikácia |
| **GDPR admin panel** | ❌ Chýba | Anonymize endpoint existuje | Žiadosti čl. 15-21, RoPA, súhlasy |
| **Consent entita** | ❌ Chýba | Súhlas v podpisoch | Standalone `consents` tabuľka |

---

## 5. Adaptácia modulov na realitnú činnosť

Prompt bol inšpirovaný architektonickým CRM (Hi Architecture Detail). Tu je mapovanie na realitné procesy VIANEMA Real:

### Fáza 1 — Rozšírenie Klientov
**Adaptácia:** Klienti sú v systéme, ale chýba štruktúrovaný log interakcií.
- Nová entita `client_interactions` (hovor/email/stretnutie/poznámka) — plne relevantné
- Rozšírenie klienta o `acquisition_source` (odporúčanie/portál/OLX/priamy kontakt), `segment` (developer/investor/prvý kupujúci/výmenný), `legal_basis` (zmluva/oprávnený záujem/súhlas/zákonná povinnosť)
- GDPR tab na karte klienta (súhlasy, export, výmaz, obmedzenie)

### Fáza 2 — Transakčné fázy (Projekty)
**Adaptácia pre realitku** — namiesto architektonických fáz (DUR/DSP/DRS) používame fázy predaja/kúpy nehnuteľnosti:

**Workflow predaj (predávajúci):**
`Naber → Príprava → Aktívna ponuka → Obhliadky → Prijatá ponuka → Rezervácia → KK/Zmluva → Notárska zápisnica → Odovzdanie → Ukončený`

**Workflow kúpa (kupujúci):**
`Dopyt → Kvalifikácia → Obhliadky → Výber → Ponuka → Schválenie hypotéky → KK → Notár → Odovzdanie → Ukončený`

Entita: `transactions` (nie `projects`) — prepojenie na `nehnutelnosti.id` + `klienti.id` (predávajúci aj kupujúci)

### Fáza 3 — Úlohy a tímová spolupráca
- Existujúca tabuľka `ulohy` je jednoduchý zoznam — rozšírenie na Kanban s väzbou na `transactions`, `klienti`, `nehnutelnosti`
- Komentáre s @mentions → notifikácia cez existujúci push-notification systém

### Fáza 4 — Financie a ziskovosť transakcie
- Existujúce `faktury` → doplniť väzbu na `transactions.id`
- Nová entita `transaction_costs` (náklady: fotografia, homestaging, právnik, kolok)
- Dashboard: obrat, provízia, náklady, čistý zisk per transakcia/makler/obdobie

### Fáza 5 — Lead pipeline
- Existuje `klienti.status` s hodnotami novy/novy_kontakt/... — formalizovať ako lead pipeline
- Nová vizualizácia pipeline (Kanban): Nový lead → Kontaktovaný → Kvalifikovaný → Aktívny → Ponuka → Vyhratý/Prehratý
- Konverzia lead → klient → transakcia

### Fáza 6 — Knowledge base
**Adaptácia pre realitku:**
- Databáza porovnateľných predajov (CMA archív) — doplnenie k existujúcemu monitor modulu
- Šablóny dokumentov (rezervačná zmluva, mandátna zmluva, odovzdávací protokol)
- Trhové reporty (mesačné analýzy, cenové mapy)
- Karanténa vzorových inzerátov (existuje `makleri.vzorovy_inzerat`)

### Fáza 7 — GDPR & Bezpečnostný modul
- Všetky sub-moduly sú relevantné bez zmeny
- AML (zákon 297/2008) je pre VIANEMA povinný ako realitnú kanceláriu

---

## 6. Navrhované nové databázové entity

```sql
-- Fáza 1
client_interactions    -- hovor/email/stretnutie/poznámka pri klientovi
consents               -- standalone súhlas s históriou (čl. 7 GDPR)

-- Fáza 2  
transactions           -- predajný/kúpny prípad (nahrádza "project")
transaction_phases     -- fázy priebehu (naber→odovzdanie)
transaction_phase_log  -- história prechodov medzi fázami

-- Fáza 3
task_comments          -- komentáre k úlohám (@mentions)

-- Fáza 4
transaction_costs      -- náklady per transakcia

-- Fáza 5
lead_pipeline_events   -- logy zmien v pipeline

-- Fáza 6
kb_articles            -- knowledge base články
document_templates     -- šablóny dokumentov

-- Fáza 7
ropa_entries           -- Register spracovateľských činností (čl. 30)
dsr_requests           -- Data Subject Rights žiadosti (čl. 15-21)
aml_checks             -- AML/KYC záznamy (zákon 297/2008)
data_processors        -- Register sprostredkovateľov (DPA)
```

---

## 7. Prioritizovaný plán implementácie

| Fáza | Modul | Odhadovaný rozsah | Bloker |
|------|-------|-------------------|--------|
| **0** | Analýza + ANALYSIS.md | ✅ Hotovo | — |
| **7-základ** | Consent entita, striktné RLS, AML stub | M | Nutné paralelne s Fázou 1 |
| **1** | Klienti rozšírenie + client_interactions | M | — |
| **2** | Transakcie + fázové workflow | L | Vyžaduje Fázu 1 |
| **3** | Kanban úlohy | S | — |
| **4** | Financie per transakcia | M | Vyžaduje Fázu 2 |
| **5** | Lead pipeline vizualizácia | S | Čiastočne existuje |
| **6** | Knowledge base | M | — |
| **7-komplet** | RoPA, DSR panel, AML/KYC, DPIA | L | Vyžaduje všetky predchádzajúce |

**Legenda:** S = malý (1-2 dni), M = stredný (3-5 dní), L = veľký (1+ týždeň)

---

## 8. Technické rozhodnutia & konvencie

- **Nové migrácie:** číslovanie od `044_*` (aktuálne posledná: `043_statistiky_views.sql`)
- **API routes:** vzor `src/app/api/<entita>/route.ts`, vždy `requireUser()` check
- **RLS:** nové tabuľky dostanú striktné politiky (`authenticated` čítanie, `service_role` zápis cez API)
- **Šifrovanie:** citlivé polia (rodné číslo, čísla dokladov) → rovnaký AES-256-GCM ako `klient_dokumenty`
- **Audit:** každá mutácia nových entít → `audit_log` insert cez `getSupabaseAdmin()`
- **Jazyky:** UI texty po slovensky, kód a DB identifikátory po anglicky
- **Testy:** Vitest, minimálne pokrytie auth + GDPR flow

---

## 9. Otvorené otázky pred implementáciou

1. **Transakcie vs Projekty** — Entita `transactions` alebo `projects`? Odporúčam `transactions` pre realitný kontext.
2. **Existujúce `ulohy`** — Migrate to enhanced schema or create `tasks` parallel table? Odporúčam migráciu (rename + extend).
3. **AML prah** — Zákon hovorí >10 000 €. Má VIANEMA aj nižšie transakcie kde by AML check nebol povinný? (prenájmy?)
4. **DPO** — Má VIANEMA ustanoveného DPO? Ak nie, treba kontakt na zodpovednú osobu pre GDPR modul.
5. **Zdroje leadov** — Aké kanály sa používajú? (web formulár, odporúčania, portály, OLX, sociálne siete?)

---

*Analýza pripravená pre Fázu 0 review. Po schválení pokračujem s Fázou 7-základ + Fázou 1 paralelne.*
