-- ============================================================================
-- 077_revoke_remaining_anon_rls.sql
-- ============================================================================
-- 🚨 P0 SECURITY (2026-05-20):
--   Audit zistil že migrácia 072 nepokryla VŠETKY anon policies — niektoré
--   mali iné názvy než predpokladala. Tieto stále otvorené:
--
--     obchody:        anon_obchody_(select|insert|update|delete)  ← 4 policies
--     obchod_ulohy:   anon_ulohy_(select|insert|update|delete)    ← 4 policies
--     klient_udalosti: anon_delete_klient_udalosti                 ← 1 policy
--     klienti_history: anon_write_klienti_history                  ← 1 policy
--     obhliadky:      anon_write_obhliadky, anon_update_obhliadky   ← 2 policies
--     ulohy:          anon_all_ulohy                                ← 1 policy
--
--   Anon má `NEXT_PUBLIC_SUPABASE_ANON_KEY` viditeľný v JS bundle → každý vie:
--     - SELECT všetkých klientov / obchodov (cross-tenant data leak)
--     - INSERT / DELETE klient_udalosti (audit trail corruption)
--     - INSERT obchody, ulohy (data integrity)
--
--   Ponechávame ANON SELECT len pre monitor_inzeraty_* (public-facing dashboard).
-- ============================================================================

-- obchody
DROP POLICY IF EXISTS "anon_obchody_select" ON obchody;
DROP POLICY IF EXISTS "anon_obchody_insert" ON obchody;
DROP POLICY IF EXISTS "anon_obchody_update" ON obchody;
DROP POLICY IF EXISTS "anon_obchody_delete" ON obchody;

-- obchod_ulohy
DROP POLICY IF EXISTS "anon_ulohy_select" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_ulohy_insert" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_ulohy_update" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_ulohy_delete" ON obchod_ulohy;

-- klient_udalosti
DROP POLICY IF EXISTS "anon_delete_klient_udalosti" ON klient_udalosti;

-- klienti_history
DROP POLICY IF EXISTS "anon_write_klienti_history" ON klienti_history;

-- obhliadky
DROP POLICY IF EXISTS "anon_write_obhliadky" ON obhliadky;
DROP POLICY IF EXISTS "anon_update_obhliadky" ON obhliadky;

-- ulohy
DROP POLICY IF EXISTS "anon_all_ulohy" ON ulohy;

-- client_interactions (audit trail — anon nesmie meniť)
DROP POLICY IF EXISTS "anon_read_interactions" ON client_interactions;
DROP POLICY IF EXISTS "anon_write_interactions" ON client_interactions;
DROP POLICY IF EXISTS "anon_update_interactions" ON client_interactions;
DROP POLICY IF EXISTS "anon_delete_interactions" ON client_interactions;

-- consents (GDPR — nesmie byť anon insertable)
DROP POLICY IF EXISTS "anon_insert_consents" ON consents;

-- klient_udalosti write (077 dropnul delete, ale write tiež musí ísť)
DROP POLICY IF EXISTS "anon_write_klient_udalosti" ON klient_udalosti;

-- Pre úplnú istotu: pridáme service_role-only policy kde nie je (app
-- používa service role cez API routes, anon access nie je potrebný).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['obchody','obchod_ulohy','klient_udalosti','klienti_history','obhliadky','ulohy','client_interactions','consents'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_all_%I ON %I', t, t);
    EXECUTE format('CREATE POLICY service_role_all_%I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
