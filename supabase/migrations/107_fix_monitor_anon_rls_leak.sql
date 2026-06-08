-- 106_fix_monitor_anon_rls_leak.sql
-- G2 fix: monitor_inzeraty_snapshots a _disappearances mali
--   CREATE POLICY ... FOR SELECT TO anon USING (true)
-- Snapshot JSONB obsahuje predajca_meno/predajca_telefon (PII súkromných
-- predajcov) → bolo čitateľné ANONYMNÝM (neprihláseným) kľúčom. Porušuje
-- CLAUDE.md (Security Regression Guardian: žiadny USING(true) FOR anon).
--
-- Čítanie týchto tabuliek ide výhradne cez API routy (service_role, obchádza
-- RLS) — overené: PriceSparkline.tsx číta cez /api/monitor/[id]/snapshots,
-- žiadny priamy anon read neexistuje. Anon policy je teda zbytočná → DROP.

DROP POLICY IF EXISTS anon_read_monitor_snapshots ON monitor_inzeraty_snapshots;
DROP POLICY IF EXISTS anon_read_monitor_disap ON monitor_inzeraty_disappearances;
