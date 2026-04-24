-- ============================================================
-- 019: Add updated_at column to nehnutelnosti
-- ============================================================
-- Tabuľka `nehnutelnosti` má TRIGGER ktorý setuje NEW.updated_at,
-- ale column updated_at na tabuľke chýba — všetky UPDATE operácie
-- padajú s "record new has no field updated_at".
-- ============================================================

ALTER TABLE nehnutelnosti
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existujúcich riadkov
UPDATE nehnutelnosti SET updated_at = created_at WHERE updated_at IS NULL;
