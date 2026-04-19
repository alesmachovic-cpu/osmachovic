-- ============================================================
-- 017: Vzorove inzeraty per user (cross-device)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vzorove_inzeraty JSONB DEFAULT '[]'::jsonb;
