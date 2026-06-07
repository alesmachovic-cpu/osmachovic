# Plán: S3–S7 security fixy (handoff Klienti cez MD, 2026-06-07)

Worktree: /Users/alesmachovic/Code/os-machovic-security, branch security/klienti-obchody-leaks (z origin/dev).
Všetkých 5 overených reálne. S3+S7 POTVRDENÉ aj na PRODE (main) — GDPR relevantné (nahlásené MD/Pravo).

## Fixy
- [ ] **S3 [P0]** klient-udalosti GET: requireUser + over klient.company_id == auth.company_id (else 404)
- [ ] **S4 [P0]** volni-klienti POST: requireUser; by_user_id z auth.user.id; klient musí patriť firme; prebrať len ak makler_id===scope.makler_id (al. admin)
- [ ] **S5 [P1]** klienti PATCH (existing select) + DELETE: .eq('company_id', scope.company_id) do select+update+delete
- [ ] **S6 [P0]** obchody IDOR: company guard na PARENT obchod cez helper:
      - obchody GET (klient_id) — over klient/obchody firmy
      - obchody/[id]/ulohy GET+POST — over obchod.company_id; POST nastav company_id
      - obchody/[id]/ulohy/[ulohaId] PATCH+DELETE — over obchod.company_id
      vzor: obchody/[id] PATCH (správny scope guard)
- [ ] **S7 [P0]** cron/volni-klienti: odstrániť __internal__ bypass; manuálny trigger = requireUser+admin, scope per company; odstrániť z PUBLIC_WHITELIST ak už nie je čisto cron

## Root-cause (proces)
- [ ] scope helper v lib/scope.ts: obchodScopeById(id)→company_id, klientScopeById(id)→company_id
- [ ] check-api-auth.mjs: pridať fix-nuté routes do TIER1 (regression guard).
      POZN: NErobiť "všetky GET bez auth = hard fail" — rozbilo by CI na 57 legacy TIER2 routes.
      Namiesto toho explicitný TIER1 zoznam (ako doteraz).

## Cross-window závislosti (cez MD)
- S7: UI tlačidlo "Spustiť SLA cron" (volni-klienti page:93) volá ?key=__internal__.
      Po odstránení bypassu sa rozbije → potrebuje nový authed admin endpoint.
      page.tsx je Klienti doména → koordinovať cez MD (ja zavriem dieru, button fix = Klienti okno).

## Verifikácia
- node scripts/check-api-auth.mjs · ./scripts/audit-all.sh baseline · npx tsc --noEmit
- commit len svoje súbory · report MD (commit+files)
