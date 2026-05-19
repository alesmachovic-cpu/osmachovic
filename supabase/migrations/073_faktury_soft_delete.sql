-- ============================================================================
-- 073_faktury_soft_delete.sql
-- ============================================================================
-- Compliance P0 (2026-05-20):
--   Zákon 222/2004 (DPH) § 76 — faktúry je povinný platiteľ DPH uchovávať
--   10 rokov od konca kalendárneho roka, v ktorom boli vystavené.
--
--   Zákon 431/2002 (o účtovníctve) § 35 — účtovné doklady 10 rokov.
--
--   Pôvodný DELETE handler fyzicky mazal faktúry → priame porušenie zákona,
--   pri kontrole Finančnej správy = pokuta + dorovnanie DPH + reputačné riziko.
--
-- Riešenie:
--   1. Pridáme `zrusena_at` (timestamp) + `zrusena_dovod` (text) + `zrusena_by` (uuid).
--   2. API DELETE bude robiť soft-delete (UPDATE zrusena_at = now()).
--   3. GET endpoints filtrujú zrusena_at IS NULL by default.
--   4. Po 10 rokoch od datum_vystavenia môže super-admin fyzicky zmazať
--      (samostatným explicit DELETE endpointom — TBD ak treba).
-- ============================================================================

ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS zrusena_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS zrusena_dovod text NULL,
  ADD COLUMN IF NOT EXISTS zrusena_by uuid NULL REFERENCES users(id) ON DELETE SET NULL;

-- Index pre rýchle filtrovanie aktívnych faktúr (zrusena_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_faktury_active
  ON faktury (user_id, datum_vystavenia DESC)
  WHERE zrusena_at IS NULL;

-- Komentár pre DBA / audit.
COMMENT ON COLUMN faktury.zrusena_at IS
  'Soft-delete timestamp. NULL = aktívna. Faktúra ostáva fyzicky v DB minimálne 10 rokov (DPH § 76 + ZoÚ § 35).';
COMMENT ON COLUMN faktury.zrusena_dovod IS 'Dôvod zrušenia (storno, oprava, duplikát, atď.) — povinné pri zrušení.';
COMMENT ON COLUMN faktury.zrusena_by IS 'Užívateľ ktorý zrušil faktúru (audit trail).';
