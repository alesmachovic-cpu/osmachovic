# Plán: Vynútenie 2FA pre admin roly (CRIT-1) + CSP single-source

## Cieľ
Admin (super_admin/majitel/platform_admin) bez zapnutej 2FA → po logine presmerovaný
na povinný setup `/nastavenia/security`. **Nikdy nezamknutý** — vždy sa dostane na
setup page + logout. Bežní makléri nedotknutí (2FA ostáva opt-in pre nich).

## Vzor
Mirror billing guardu: Edge middleware nevie rolu zo session (HMAC userId only),
preto separátna non-httponly cookie `crm_2fa` (ako `crm_billing`).

## Zmeny
1. **session.ts** — `buildTwoFactorCookieValue(setupRequired)`: `crm_2fa=setup` (1 deň)
   alebo zmazať (Max-Age=0).
2. **requireUser.ts** — helper `isAdminTier(role)`.
3. **login/route.ts** — na session-issuing ceste (no-totp): ak `isAdminTier && !totp_enabled_at`
   → append `crm_2fa=setup`, inak zmazať.
4. **google/match/route.ts** — to isté na ceste vystavenia session.
5. **middleware.ts** — ak `crm_2fa=setup` + ne-API + nie už `/nastavenia/security` + nie `/auth`
   → redirect na `/nastavenia/security`. (API prechádza — sú chránené requireUser.)
6. **2fa/enable/route.ts** — po úspechu append `crm_2fa` clear.
7. **logout/route.ts** — append `crm_2fa` clear.

## Tradeoff (vedomý)
Cookie nie je httponly → user ju vie zmazať a obísť redirect. Ale stále nemá 2FA
(= stav ako dnešný opt-in) a session je aj tak za requireUser. Je to UX funnel +
defense-in-depth, konzistentné s billing patternom. Hard enforcement = DB lookup
per request (Edge), zámerne sa nerobí (rovnako ako billing).

## CSP single-source (hotové)
next.config.ts CSP odstránené → middleware.ts je jediný zdroj. Žiadna divergencia.

## Verifikácia
- `./scripts/audit-auth-paths.sh` (session emittery)
- `./scripts/audit-all.sh` baseline porovnanie
- tsc + check-api-auth.mjs
