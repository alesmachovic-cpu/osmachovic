-- ============================================================================
-- 080_audit_log_immutable.sql
-- ============================================================================
-- 🔒 PEN-TEST C2 FIX (2026-05-20):
--   Pôvodne `audit_log` bola normálna tabuľka — service_role aj authenticated
--   role mohli UPDATE / DELETE riadky. To znamená:
--     - Kompromitovaný admin mohol zamietnúť stopy po svojich akciách
--     - Kompromis SUPABASE_SERVICE_ROLE_KEY = vymazanie všetkého forenzného
--       dôkazu (čistá DB pre auditora Finančnej správy / GDPR DPA)
--
-- Compliance breach:
--   - GDPR čl. 5 ods. 2 (accountability) — musíme vedieť dokázať kto, kedy,
--     čo robil s osobnými údajmi
--   - Zák. 297/2008 § 11 (AML retention) — 5 rokov immutable
--   - Zák. 222/2004 § 76 (DPH) — 10 rokov accounting trail
--
-- Riešenie:
--   Postgres BEFORE UPDATE / BEFORE DELETE trigger ktorý RAISE EXCEPTION.
--   audit_log je teraz APPEND-ONLY (insert OK, ostatné zablokované).
--
-- Limitácia:
--   Service role môže stále DROP TABLE alebo TRUNCATE (DDL nepokrývam triggerom).
--   To by mal riešiť asynchronný backup do S3 s WORM lock (samostatná migrácia
--   P2 — TODO Q3).
-- ============================================================================

-- Najprv overím že audit_log existuje (nemali by sme padnúť ak DB nemá tabuľku).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    RAISE NOTICE 'audit_log tabuľka neexistuje — preskakujem migráciu 080';
    RETURN;
  END IF;
END $$;

-- Trigger function ktorá blokuje UPDATE a DELETE.
CREATE OR REPLACE FUNCTION block_audit_mutations()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. UPDATE/DELETE prohibited for compliance (GDPR čl. 5 ods. 2, zák. 297/2008 § 11). Operation by % attempted on row id=%', current_user, OLD.id;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger ak by tam náhodou bol (idempotent migrácia).
DROP TRIGGER IF EXISTS audit_log_block_update ON audit_log;
DROP TRIGGER IF EXISTS audit_log_block_delete ON audit_log;

-- BEFORE UPDATE — zablokuje akúkoľvek zmenu.
CREATE TRIGGER audit_log_block_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION block_audit_mutations();

-- BEFORE DELETE — zablokuje vymazanie.
CREATE TRIGGER audit_log_block_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION block_audit_mutations();

-- Note: TRUNCATE nepokrýva BEFORE DELETE FOR EACH ROW trigger.
-- Pridáme BEFORE TRUNCATE statement-level trigger pre úplnosť.
CREATE OR REPLACE FUNCTION block_audit_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log TRUNCATE prohibited for compliance retention.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_block_truncate ON audit_log;
CREATE TRIGGER audit_log_block_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION block_audit_truncate();

COMMENT ON FUNCTION block_audit_mutations() IS
  'Pen-test C2 fix 2026-05-20: audit_log je append-only pre forenzný dôkaz.';
