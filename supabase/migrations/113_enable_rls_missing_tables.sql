-- 113_enable_rls_missing_tables.sql
-- 🔴 SECURITY FIX: 3 tabuľky mali RLS VYPNUTÚ + Supabase default anon/authenticated
-- granty (ALL) → anonymne čitateľné/zapisovateľné cez PostgREST bez prihlásenia.
--
-- Nájdené pri exhaustívnom DB Advisor sweepe 2026-06-08 (vektor ktorý route-skener
-- check-api-auth.mjs štrukturálne nezachytí — kontroluje route.ts, nie DB granty/RLS).
--
-- Root cause: migrácie 071_audit_runs, 076_qa_smoke_runs, 078_users_2fa_totp
-- vytvorili tabuľky ale ZABUDLI `ENABLE ROW LEVEL SECURITY`. Pri RLS-OFF tabuľke
-- Supabase default granty (anon/authenticated ALL) plne platia → leak.
--
-- Bezpečnosť opravy overená: VŠETKY tieto tabuľky appka číta/zapisuje LEN cez
-- getSupabaseAdmin() = service_role, ktorý RLS OBCHÁDZA. ENABLE RLS bez policy =
-- service_role funguje ďalej, anon/authenticated default-deny. Nič sa nerozbije.
--
--   auth_2fa_challenges → 2FA challenge tokeny (login/2fa/verify/google-match/invite)
--   audit_runs          → forenzný history audit behov (cron daily-audit)
--   qa_smoke_runs        → log denných smoke testov (cron qa-smoke)

ALTER TABLE public.auth_2fa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_smoke_runs       ENABLE ROW LEVEL SECURITY;

-- Žiadne policies zámerne: prístup len service_role (obchádza RLS). anon/authenticated
-- = default deny. Ak by niekedy nejaký flow potreboval authenticated read → doplniť
-- cielenú policy, NIE vypínať RLS.
