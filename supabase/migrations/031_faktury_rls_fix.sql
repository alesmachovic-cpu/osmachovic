-- ============================================================
-- 031: RLS policies pre faktury + faktura_polozky
-- ============================================================
-- Tabuľky `faktury` a `faktura_polozky` boli vytvorené s RLS enabled,
-- ale bez policies → anon SELECT/INSERT/UPDATE padá s
--   ❌ new row violates row-level security policy for table "faktury"
-- Tu pridávame štandardné policies (rovnaký pattern ako klienti, obhliadky):
--   service_role plný prístup, anon read+write+update.
-- ============================================================

-- FAKTURY
ALTER TABLE faktury ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_faktury ON faktury;
CREATE POLICY service_role_all_faktury ON faktury
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_read_faktury ON faktury;
CREATE POLICY anon_read_faktury ON faktury
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_write_faktury ON faktury;
CREATE POLICY anon_write_faktury ON faktury
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS anon_update_faktury ON faktury;
CREATE POLICY anon_update_faktury ON faktury
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_delete_faktury ON faktury;
CREATE POLICY anon_delete_faktury ON faktury
  FOR DELETE TO anon USING (true);

-- FAKTURA_POLOZKY
ALTER TABLE faktura_polozky ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_faktura_polozky ON faktura_polozky;
CREATE POLICY service_role_all_faktura_polozky ON faktura_polozky
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_read_faktura_polozky ON faktura_polozky;
CREATE POLICY anon_read_faktura_polozky ON faktura_polozky
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_write_faktura_polozky ON faktura_polozky;
CREATE POLICY anon_write_faktura_polozky ON faktura_polozky
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS anon_update_faktura_polozky ON faktura_polozky;
CREATE POLICY anon_update_faktura_polozky ON faktura_polozky
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_delete_faktura_polozky ON faktura_polozky;
CREATE POLICY anon_delete_faktura_polozky ON faktura_polozky
  FOR DELETE TO anon USING (true);
