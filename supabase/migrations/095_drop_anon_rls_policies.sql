-- Migration 095 — DROP nedbalivé anon RLS polices
-- Vytvorené: 2026-05-24 (security hardening)
--
-- KONTEXT: Audit 2026-05-23 odhalil že 11 tabuliek malo `USING (true)` polices
-- pre `anon` rolu — t.j. ktokoľvek s NEXT_PUBLIC_SUPABASE_ANON_KEY (verejný kľúč)
-- mohol cez Supabase REST API priamo čítať/písať obchody, klient_udalosti,
-- audit_log, OAuth tokeny atď. — úplne mimo nášho API.
--
-- BEZPEČNOSŤ: Backend používa SUPABASE_SERVICE_ROLE_KEY (bypass RLS), takže
-- žiadna funkčná zmena. Frontend volá vždy len naše /api/* routes (nikdy
-- nečíta priamo z Supabase REST cez anon kľúč — overené greppom 2026-05-24).
--
-- ROLLBACK: viď supabase/migrations/095_rollback_anon_policies.sql

-- ═══ 1) monitor_filtre — bola plne otvorená pre všetky role ═══
DROP POLICY IF EXISTS "monitor_filtre_select" ON monitor_filtre;
DROP POLICY IF EXISTS "monitor_filtre_insert" ON monitor_filtre;
DROP POLICY IF EXISTS "monitor_filtre_update" ON monitor_filtre;
DROP POLICY IF EXISTS "monitor_filtre_delete" ON monitor_filtre;

-- ═══ 2) obchody + obchod_ulohy — full CRUD pre anon (migrácia 045) ═══
DROP POLICY IF EXISTS "anon_obchody_select" ON obchody;
DROP POLICY IF EXISTS "anon_obchody_insert" ON obchody;
DROP POLICY IF EXISTS "anon_obchody_update" ON obchody;
DROP POLICY IF EXISTS "anon_obchody_delete" ON obchody;

DROP POLICY IF EXISTS "anon_ulohy_select" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_ulohy_insert" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_ulohy_update" ON obchod_ulohy;
DROP POLICY IF EXISTS "anon_ulohy_delete" ON obchod_ulohy;

-- ═══ 3) klient_udalosti, klienti_history ═══
DROP POLICY IF EXISTS "anon_read_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "anon_write_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "anon_delete_klient_udalosti" ON klient_udalosti;
DROP POLICY IF EXISTS "anon_read_klienti_history" ON klienti_history;

-- ═══ 4) Biz intelligence tabuľky ═══
DROP POLICY IF EXISTS "anon_read_pricing_estimates" ON pricing_estimates;
DROP POLICY IF EXISTS "anon_read_property_stories" ON property_stories;
DROP POLICY IF EXISTS "anon_read_market_sentiments" ON market_sentiments;
DROP POLICY IF EXISTS "anon_read_motivation_signals" ON motivation_signals;
DROP POLICY IF EXISTS "anon_read_rk_directory" ON rk_directory;

-- ═══ 5) audit_log — len service_role číta ═══
DROP POLICY IF EXISTS "audit_log_read_admin" ON audit_log;
CREATE POLICY "audit_log_read_service" ON audit_log
  FOR SELECT USING (auth.role() = 'service_role');

-- ═══ 6) users — google_access_token musí byť service-only ═══
DROP POLICY IF EXISTS "read_users" ON users;
CREATE POLICY "read_users_service" ON users
  FOR SELECT USING (auth.role() = 'service_role');

-- Verifikácia po deployi:
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public' AND (policyname LIKE 'anon_%' OR roles @> '{anon}'::name[]);
-- Očakávaný výsledok: 0 riadkov.
