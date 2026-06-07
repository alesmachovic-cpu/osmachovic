# plan-release.md — Veľký update: dev → vianema (ostrá prevádzka)

**Cieľ:** nasadiť aktuálny `dev` na `vianema.amgd.sk` a prejsť do prevádzky s **reálnymi klientmi** (makléri).
**Dátum:** 2026-06-07 (plánované dnes).
**Koordinuje:** MD okno (hub-and-spoke). Každá vrstva má vlastníka.

---

## 🔴 KONSOLIDOVANÝ STAV (2026-06-07) — Bezpecnost + Pravo = NO-GO, podmienečne GO

**KOREŇOVÝ PROBLÉM (overené git + curl):** `main` je **91 commitov ZA `dev`**, merge dev→main NEPREBEHOL. Všetky security/GDPR fixy (S3, S7, F1, F2, F3, F4, F10, breach register) sú LEN na `dev`. `vianema.amgd.sk` beží zo starého `main` → **S3 a S7 sú ŽIVÉ diery na prode TERAZ** (curl 200 bez auth). Kým dáta fiktívne = len zraniteľnosť; **prvý reálny klient = reálny GDPR breach (ÚOOÚ 72h).**

### TVRDÉ BLOKERY pred prvým reálnym klientom (všetky musia byť ✅)
1. ❌ **Merge `dev`→`main`** — bez neho nepôjde ANI JEDEN fix. ⚠️ 91 commitov vrátane cudzích workstreamov → Bezpecnost+MD dohľad na obsah diffu (build/lint/audit-all.sh).
2. ❌ **S3 + S7 po deploy vrátia 401/403** (teraz 200) — overiť curl-om priamo na vianeme.
3. ❌ **F1 IDOR `klient-dokumenty`** — na main bez company_id guardu.
4. ❌ **Erasure UI** — tlačidlo „Anonymizovať (GDPR)" volá `/api/klienti/anonymize` → zmaže VŠETKY dokumenty vrátane AML (porušenie § 20 zák. 297/2008) + bez cross-tenant guardu. Zladiť na `/api/gdpr/erasure` ALEBO doplniť AML výnimku + company_id guard. → **Klienti + Bezpecnost.**
5. ❌ **Migrácie 103+104+108** na vianema DB po ZÁLOHE (presný set potvrdí Bezpecnost z overovacích SQL).
6. ❌ **Post-deploy curl verifikácia** priamo na vianeme (klient-udalosti=401, cron?key=__internal__=401/403).

### GDPR stav (Pravo)
- Zásady OÚ: ⚠️ v2.0 live, **v2.1 odklepnutá CEO** → commitnúť do merge (Pravo robí).
- Súhlasy: ⚠️ nefunkčné (banner off, consents API len dev) — NEBLOKUJE (core na zmluve čl.6/1/b), ale **žiadny marketing reálnym kontaktom** kým nie je wired.
- Retention F11: ⚠️ manuálne (Vercel cron Hobby off) — akceptovateľné, zdokumentovať.
- RoPA: ❌ neexistuje → Pravo dorobí do go-live (1–2 h).
- AML/KYC: ⚠️ neúplný — neblokuje zadávanie, ale **reálny obchod nedotiahnuť ku KZ** bez ručnej AML evidencie (gate do 31.8.2026).

### Security stav (Bezpecnost)
- ✅ App vrstva (kód na dev) pripravená, audit clean (8 pre-existing fail).
- ✅ CRON_SECRET + kľúčové secrety na prode.
- ✅ Turnstile captcha na prode FUNGUJE (overené CEO).
- ❌ Vianema DB stav (RLS/migrácie/company_id) — čaká na 4 overovacie SQL (CEO spúšťa).

---

> 🔴 PRAH: po tomto update sú na vianeme **reálne osobné údaje reálnych ľudí** → GDPR platí naplno, security baseline musí byť 100 %. Jeden breach = reálny incident.

---

## 4 vrstvy (nič nepreskočiť)

### Vrstva 1 — KÓD  (vlastník: MD/DevOps deploy gate)
- [ ] `dev` (`origin/dev = acde951` + novšie) zlúčiť do `main`.
- [ ] Over, že S3–S7 + matching auth sú v `main` (boli na dev — pôjdu s merge).
- [ ] `vercel deploy --prod` z fresh clone `main` do `funny-stonebraker`. **NIKDY alias-swap** (lekcia z výpadku).
- [ ] Po deploy: `dev.amgd.sk` aj `vianema.amgd.sk` načítané, žiadny biely JS.

### Vrstva 2 — DATABÁZA  (vlastník: Security/DB + dotknuté okná) ⚠️ NAJRIZIKOVEJŠIE
- [ ] **ZÁLOHA vianema DB (`hokymscytscsewrpwdjf`) PRED migráciami.** (Supabase → Database → Backups / `pg_dump`.)
- [ ] Zoznam migrácií, ktoré `vianema` DB ešte nemá (dev DB ≠ vianema DB — samostatné).
- [ ] Aplikovať migrácie na vianema DB **po zálohe**, jednu po druhej, skontrolovať že nič nepadlo (Supabase untyped → DROP COLUMN padá ticho).
- [ ] RLS policies na nových tabuľkách (`authenticated` rola).

### Vrstva 3 — ENV PREMENNÉ  (vlastník: MD/DevOps)
- [ ] Porovnať env vars `dev` vs `funny-stonebraker` — doplniť chýbajúce (nové z dev).
- [ ] Skontrolovať `CRON_SECRET` nastavený na prode (S7 fix naň spolieha).
- [ ] Server-only kľúče (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`, VAPID…) sú na prode.

### Vrstva 4 — BEZPEČNOSŤ + GDPR  (vlastníci: Bezpecnost + Pravo) — BLOKUJE GO-LIVE
**Bezpečnosť (Bezpecnost):**
- [ ] `./scripts/audit-all.sh` na `main` = žiadne nové `✗` oproti baseline.
- [ ] `node scripts/check-api-auth.mjs` pass (TIER1 routes chránené).
- [ ] Žiadna známa P0 diera otvorená (S3–S7 potvrdene zavreté na prode po deploy).

**GDPR/Pravo — MUSÍ byť živé PRED prvým reálnym klientom:**
- [ ] Zásady ochrany OÚ (privacy policy) publikované + aktuálne.
- [ ] Cookie/marketing súhlasy funkčné.
- [ ] Retention cron (F11 — mazanie/anonymizácia) zapnutý (pozn.: Vercel cron na Hobby vypnutý → riešiť po Pro upgrade alebo manuálne).
- [ ] RoPA (čl. 30 záznam) aktuálny — vrátane novej kategórie „dokumenty k nehnuteľnosti / LV".
- [ ] AML/KYC flow funkčný.

---

## Poradie (riadené, nie big-bang)
1. Príprava: záloha DB → audit clean → GDPR artefakty hotové → env skontrolované.
2. Nasadenie: migrácie (po zálohe) → deploy kódu → doplniť env.
3. Verifikácia: smoke test kritických flow (login, klient, náber, faktúra) → security re-check → diery zavreté.
4. **GO-LIVE (pustiť reálnych klientov): až keď Vrstva 4 je celá ✅.**

## Rollback
- Kód: redeploy predošlého `main` commitu (Vercel → Deployments → Promote).
- DB: obnoviť zo zálohy z kroku 1. (Preto je záloha podmienka, nie odporúčanie.)

## Rozdelenie okien (cez MD)
- **Bezpecnost** — Vrstva 4 security + Vrstva 2 DB migrácie/RLS.
- **Pravo** — Vrstva 4 GDPR artefakty (zásady, súhlasy, RoPA, retention).
- **Klienti / doménové okná** — overiť migrácie + smoke test svojej domény.
- **MD** — Vrstva 1 deploy + Vrstva 3 env + koordinácia poradia + rollback dohľad.
