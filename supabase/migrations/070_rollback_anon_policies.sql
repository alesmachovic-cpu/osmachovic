-- ROLLBACK migrácie 070 — pripravený na pohotovosť, NESPÚŠŤAJ ak migrácia 070 funguje
-- Vytvorené: 2026-05-24
--
-- Spustiť IBA ak po nasadení 070 niektorá route vráti "permission denied for table X"
-- alebo iné RLS-súvisiace chyby v Vercel logoch.

-- monitor_filtre
CREATE POLICY "monitor_filtre_select" ON monitor_filtre FOR SELECT USING (true);
CREATE POLICY "monitor_filtre_insert" ON monitor_filtre FOR INSERT WITH CHECK (true);
CREATE POLICY "monitor_filtre_update" ON monitor_filtre FOR UPDATE USING (true);
CREATE POLICY "monitor_filtre_delete" ON monitor_filtre FOR DELETE USING (true);

-- obchody
CREATE POLICY "anon_obchody_select" ON obchody FOR SELECT TO anon USING (true);
CREATE POLICY "anon_obchody_insert" ON obchody FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_obchody_update" ON obchody FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_obchody_delete" ON obchody FOR DELETE TO anon USING (true);

-- obchod_ulohy
CREATE POLICY "anon_ulohy_select" ON obchod_ulohy FOR SELECT TO anon USING (true);
CREATE POLICY "anon_ulohy_insert" ON obchod_ulohy FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_ulohy_update" ON obchod_ulohy FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_ulohy_delete" ON obchod_ulohy FOR DELETE TO anon USING (true);

-- klient_udalosti, klienti_history
CREATE POLICY "anon_read_klient_udalosti" ON klient_udalosti FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_klient_udalosti" ON klient_udalosti FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_klient_udalosti" ON klient_udalosti FOR DELETE TO anon USING (true);
CREATE POLICY "anon_read_klienti_history" ON klienti_history FOR SELECT TO anon USING (true);

-- BI tabuľky
CREATE POLICY "anon_read_pricing_estimates" ON pricing_estimates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_property_stories" ON property_stories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_market_sentiments" ON market_sentiments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_motivation_signals" ON motivation_signals FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_rk_directory" ON rk_directory FOR SELECT TO anon USING (true);

-- audit_log
DROP POLICY IF EXISTS "audit_log_read_service" ON audit_log;
CREATE POLICY "audit_log_read_admin" ON audit_log FOR SELECT USING (true);

-- users
DROP POLICY IF EXISTS "read_users_service" ON users;
CREATE POLICY "read_users" ON users FOR SELECT USING (true);
