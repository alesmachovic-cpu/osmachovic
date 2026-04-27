-- ============================================================
-- 029: rozšírenie typ klienta o 'prenajimatel'
-- ============================================================
-- Aplikácia podporuje typ 'prenajimatel' (database.types.ts, UI),
-- ale DB constraint dovoľoval len 'kupujuci/predavajuci/oboje'.
-- Insert/update s typ='prenajimatel' padal s:
--   ❌ new row for relation "klienti" violates check constraint "klienti_typ_check"
-- Tu rozšírujeme constraint.
-- ============================================================

ALTER TABLE klienti DROP CONSTRAINT IF EXISTS klienti_typ_check;

ALTER TABLE klienti ADD CONSTRAINT klienti_typ_check
  CHECK (typ IN ('kupujuci', 'predavajuci', 'oboje', 'prenajimatel'));
