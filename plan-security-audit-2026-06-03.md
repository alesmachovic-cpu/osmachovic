# Security audit triage — 2026-06-03

Externý audit (20 nálezov) overený proti reálnemu kódu. **Polovica je false-positive / už opravené.**

## Kritické

| ID | Nález | Verdikt | Akcia |
|---|---|---|---|
| CRIT-1 | 2FA vypnuté pre super_admin | ⚪ POLICY, nie bug — `login/route.ts:264` gate je role-agnostický, 2FA je opt-in pre všetkých. Vynútiť = riziko zamknutia CEO | DECISION |
| CRIT-2 | /api/firma-info bez auth | 🔴 REAL — `GET` (route.ts:23) nemá `requireUser`, leakuje IČO/DIČ/konateľ/email | **FIX** |
| CRIT-3 | /api/odberatelia bez auth | 🔴 REAL — `GET` (route.ts:8) berie `user_id` z URL, bez auth, IDOR + leak IČO/DIČ/email/tel | **FIX** |
| CRIT-4 | Cookie bez HttpOnly | ✅ FALSE — `session.ts:83` má `HttpOnly; SameSite=Lax; Secure` | žiadna |
| CRIT-5 | Chýba CSRF | 🟡 MOSTLY FALSE — `SameSite=Lax` = CSRF mitigácia. Explicitný token = nice-to-have | backlog |

## Bonus (našiel som pri overovaní, NIE v reporte)
| X | klienti/export bez company_id scope | 🔴 REAL — `export/route.ts:24` `select("*").eq("id")` bez tenant filtra → cross-tenant IDOR (manažér exportuje cudziu firmu) | **FIX** |

## High
| HIGH-1 | user_id injection notifications | ✅ FALSE / už opravené — `notifications/route.ts` má requireUser + IDOR fix |
| HIGH-2 | user enumeration Google status | ✅ FALSE — má requireUser + super_admin guard (403) |
| HIGH-3 | LV dáta v bulk API | 🟡 čiastočne — klienti list `select("*")` over-fetch (authed+scoped) |
| HIGH-4 | CSP unsafe-inline | ⚪ KNOWN GAP (CSP nonce) |
| HIGH-5 | dev.amgd.sk bez password | ⚪ KNOWN GAP |

## Medium / Low
- MED-1/MED-4 (datum_narodenia, hypo v bulk): over-fetch `select("*")` na klienti liste — minor, column allowlist
- MED-2 HSTS: KNOWN GAP
- MED-3 referrer policy / MED-5 error messages / LOW-*: backlog, overiť jednotlivo

## Fix teraz (root-cause, bez side-efektov)
1. CRIT-2 — firma-info GET: `requireUser`
2. CRIT-3 — odberatelia GET: `requireUser` + user_id zo session (super_admin override), nie z URL
3. Bonus — klienti/export: doplniť `company_id` scope
