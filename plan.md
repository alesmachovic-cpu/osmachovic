# Plán: Bug sweep 2026-05-21 (Aleš nahlásil 7 vecí)

## Cieľ
Vyriešiť všetky bugy z dnešnej session, postupne, root-cause. Žiadne band-aidy.

## Stav projektov
- **DEV** = `os-machovic` (`ntdjsmqzzvqqammmiqye`) → `dev.amgd.sk` → tu robím všetko.
- **PROD** = `uctovnictvo` (`hokymscytscsewrpwdjf`) → `vianema.amgd.sk` → bez explicit OK ani jeden write.

## Issue list

### #1 Toast pri kopírovaní pozvánky — trivial
Klik na "Kopírovať pozvánku" nedá feedback. Pridať toast "Skopírované ✓".

### #2 Úprava makléra (Nastavenia → Profil makléra) — detail chýba
Reprodukovať cez Playwright + DevTools network, identifikovať endpoint.

### #3 `null value in column "company_id"` pri Poznámke — backend bug ✅ HOTOVO
- `src/app/api/klient-udalosti/route.ts` POST: pridané `company_id: auth.user.company_id` do insert.
- `src/components/NaberyForm.tsx`: priame supabase insert nahradené API call (POST `/api/klient-udalosti`).
- Procesná lekcia: vytvorený `scripts/audit-tenant-id-required.sh` — odhalil ďalších **16 podobných bugov** v iných moduloch (mimo Alešovho dnešného reportu). Tieto sú v KNOWN_TODO_PATTERNS a treba ich opraviť v ďalšej session.

### #3.x KNOWN_TODO: insert do tenant tabuliek bez company_id (16 súborov)
Tieto súbory robia INSERT do tabuľky s NOT NULL `company_id` ale neposielajú ho. Manifestuje sa to ako "null value in column company_id" pri pokuse o použitie príslušnej features:
- `src/app/api/naber-analyza/route.ts` — `analyzy_trhu` (auto-uloženie analýzy)
- `src/app/api/faktury/route.ts` — `faktura_polozky` (nová faktúra)
- `src/app/api/klient-dokumenty/route.ts` — `klient_dokumenty` (upload dokumentu)
- `src/app/api/obhliadky/route.ts` — `klienti` + `obhliadky` (vytvorenie obhliadky)
- `src/app/api/volni-klienti/route.ts` — `klienti_history` (uvoľnenie)
- `src/app/api/manazer/sla/route.ts` — `klienti_history` (SLA flow)
- `src/app/klienti/[id]/page.tsx:1102` — `klienti_history` (frontend)
- `src/app/api/monitor/filtre/route.ts` — `monitor_filtre`
- `src/app/api/nabery/route.ts` — `naberove_listy`
- `src/app/api/inzerat/save/route.ts` — `nehnutelnosti`
- `src/app/api/obchody/route.ts` — `obchody` + `obchod_ulohy`
- `src/app/api/obchody/[id]/ulohy/route.ts` — `obchod_ulohy`
- `src/app/api/odberatelia/route.ts` — `odberatelia`
- `src/app/api/pricing/estimate/route.ts` — `pricing_estimates`
- `src/app/api/produkcia-objednavky/route.ts` — `produkcia_objednavky`
- `src/app/api/property-story/route.ts` — `property_stories`

Pre každý: pridať `company_id: auth.user.company_id` do insert payload + odstrániť z `KNOWN_TODO_PATTERNS` v `scripts/audit-tenant-id-required.sh`.

### #4 Reset hesla — maklér sa pod novým heslom neprihlási
- Hypotéza A: `\n` v `.env.local` v Turnstile site key.
- Hypotéza B: Reset endpoint neuloží správny hash.

### #5 Anonymizácia klienta → flicker na login stránku
M1 re-auth gate vracia 401, frontend redirectne na `/login` namiesto modálu.
Fix: centralizovaný handler + global ReAuthModal.

### #6 2FA UX pre maklérov — koncepčný redesign, POTREBUJE DISKUSIU
WebAuthn / SMS OTP / Email magic link / Remember device 30d — Aleš musí zvoliť pred kódom.

### #7 GDPR admin panel — new feature
DB má `consents`, `dsr_requests`. UI panel neexistuje. Treba vytvoriť.

## Poradie vykonávania
1. ✅ Turnstile `\n` v `.env.local` (4 env vars) + odhalený širší bug: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` označený ako "Sensitive" na Vercel → encrypted blob v JS bundle. Opravené na **dev** (vianema-dev). PROD (funny-stonebraker) zatiaľ nedotknutá — potrebuje OK od Aleša.
2. ✅ #3 `company_id` v `klient_udalosti`. Backend INSERT + frontend NaberyForm fixnuté. Vytvorený `scripts/audit-tenant-id-required.sh`, ktorý odhalil **16 ďalších podobných bugov** (KNOWN_TODO).
3. ✅ #1 Toast "✓ Skopírované" pri kopírovaní pozvánky v `/manazer`.
4. ✅ #2 Úprava makléra — fundamentálny bug: profile sa ukladal iba do localStorage. Pridaná migrácia `081_users_telefon.sql`, API PATCH /api/users teraz akceptuje `telefon` + povolené self-update pre vlastné polia, frontend `handleSaveMakler` volá API.
5. ✅ #5 M1 re-auth flicker — Anonymizácia a Uvoľnenie klienta robili `window.location.reload()` → full app reboot → flash na LoginScreen počas re-bootstrap session. Nahradené in-place state update + `loadAll()`.
6. ⏳ #4 reset password — Turnstile fix na dev pofixoval captcha widget. Reset flow samotný treba ešte otestovať cez Playwright. Aleš screenshot ukazoval captcha error nie reset error → primárny bug bol Turnstile, ten je opravený. (Sekundárne overenie: zostáva.)
7. ⏳ #6 2FA UX zjednodušenie — POTREBUJE design rozhovor s Alešom (WebAuthn vs SMS vs magic link vs remember device).
8. ⏳ #7 GDPR admin panel — POTREBUJE plánovanie a sign-off od Aleša pred kódom.

## Otvorené veci k diskusii
- **PROD Turnstile fix** (vianema.amgd.sk): rovnaký bug ako na dev, ale produkcia → potrebuje Alešov OK. Postup: zmazať `NEXT_PUBLIC_TURNSTILE_SITE_KEY` Sensitive verziu z `funny-stonebraker` projektu, znova pridať ako plain text s rovnakou hodnotou (`0x4AAAAAADNt2x_biTBxcJDO`), redeploy. Rollback: ak by sa niečo pokazilo, návrat na predchádzajúci deploy.
- **Cloudflare Turnstile domain allowlist**: Aleš musí v Cloudflare dashboarde overiť že site key `0x4AAAAAADNt2x_biTBxcJDO` má v allowlist domény `dev.amgd.sk` aj `vianema.amgd.sk`. (Po opravení env vars sa widget teraz aspoň načítava, ale Cloudflare ešte ukazuje "Nedá sa pripojiť" — preto allowlist.)
- **2FA UX** + **GDPR admin** — diskusia.

## Pravidlá pre túto session
- Po každom fixe: stručná správa "Hotové X, idem na Y".
- Pred commitom: `./scripts/audit-all.sh` (CLAUDE.md pravidlo 8).
- Auth zmeny: `./scripts/audit-auth-paths.sh` (CLAUDE.md pravidlo 6).
- WRITE proti prod (`hokymscytscsewrpwdjf`) **nikdy**.
- Po skončení: commit s referenciou na všetky issues.
