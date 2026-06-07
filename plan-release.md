# plan-release.md — Veľký update: dev → vianema (ostrá prevádzka)

**Cieľ:** nasadiť aktuálny `dev` na `vianema.amgd.sk` a prejsť do prevádzky s **reálnymi klientmi** (makléri).
**Dátum:** 2026-06-07 (plánované dnes).
**Koordinuje:** MD okno (hub-and-spoke). Každá vrstva má vlastníka.

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
