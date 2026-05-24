-- 072_revoke_anon_rls_p0.sql
-- 🚨 P0 SECURITY FIX (Adam Vrabec, 2026-05-20)
--
-- Audit zachytil že 4+ tabuľky mali `FOR ALL USING (true)` policies dostupné anon role.
-- Útočník s verejným NEXT_PUBLIC_SUPABASE_ANON_KEY (visible v JS bundle) vedel:
--   - SELECT/INSERT/UPDATE/DELETE na `obchody` (deals s cenou + províziou)
--   - SELECT/INSERT/UPDATE/DELETE na `obhliadky` (klient kontakty, podpisy)
--   - SELECT/INSERT/DELETE na `klient_udalosti` (komunikačné history)
--   - SELECT/INSERT na `volni_klienti` (free leads)
--
-- Fix: DROP všetky permissive policies + nahradiť service_role-only policies.
-- App používa service role cez API routes (server-side), anon access nie je potrebný.

-- ============================================================================
-- 1) OBCHODY
-- ============================================================================
DROP POLICY IF EXISTS "allow_all_obchody" ON obchody;
DROP POLICY IF EXISTS "read_obchody" ON obchody;
DROP POLICY IF EXISTS "write_obchody" ON obchody;
DROP POLICY IF EXISTS "anon_read_obchody" ON obchody;
DROP POLICY IF EXISTS "anon_write_obchody" ON obchody;

-- Pridaj service-role-only policy (uvedené pre clarity, fakticky service_role bypassuje RLS)
DROP POLICY IF EXISTS "service_role_all_obchody" ON obchody;
CREATE POLICY "service_role_all_obchody" ON obchody
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 2) OBCHOD_ULOHY
-- ============================================================================
DROP POLICY IF EXISTS "allow_all_obchod_ulohy" ON obchod_ulohy;
DROP POLICY IF EXISTS "read_obchod_ulohy" ON obchod_ulohy;
DROP POLICY IF EXISTS "write_obchod_ulohy" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_read_obchod_ulohy" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_write_obchod_ulohy" ON obchod_ulohy;

DROP POLICY IF EXISTS "service_role_all_obchod_ulohy" ON obchod_ulohy;
CREATE POLICY "service_role_all_obchod_ulohy" ON obchod_ulohy
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 3) KLIENT_UDALOSTI
-- ============================================================================
DROP POLICY IF EXISTS "allow_all_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "read_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "write_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "delete_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "anon_read_klient_udalosti" ON klient_udalosti;

DROP POLICY IF EXISTS "service_role_all_klient_udalosti" ON klient_udalosti;
CREATE POLICY "service_role_all_klient_udalosti" ON klient_udalosti
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 4) OBHLIADKY (existujúce policies sú permissive)
-- ============================================================================
DROP POLICY IF EXISTS "allow_all_obhliadky" ON obhliadky;
DROP POLICY IF EXISTS "read_obhliadky" ON obhliadky;
DROP POLICY IF EXISTS "write_obhliadky" ON obhliadky;
DROP POLICY IF EXISTS "update_obhliadky" ON obhliadky;

DROP POLICY IF EXISTS "service_role_all_obhliadky" ON obhliadky;
CREATE POLICY "service_role_all_obhliadky" ON obhliadky
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5) VOLNI_KLIENTI — tabuľka neexistuje na dev DB, skip
-- ============================================================================

-- ============================================================================
-- DOWN MIGRATION (ak treba revert):
-- ----------------------------------------------------------------------------
-- CREATE POLICY "allow_all_obchody" ON obchody FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "allow_all_obhliadky" ON obhliadky FOR ALL USING (true) WITH CHECK (true);
-- ... (NEROBIŤ — toto je security regression)
-- ============================================================================
