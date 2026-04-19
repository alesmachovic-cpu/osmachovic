-- ============================================================
-- 016: Per-user notifikacne preferencie
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"monitor":true,"odklik":true,"lv":true,"naklady":true}'::jsonb;
