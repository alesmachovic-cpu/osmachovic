-- ============================================================
-- 027: Fix klienti_history.by_user_id — UUID → TEXT
-- ============================================================
-- users.id je TEXT (napr. 'ales', 'silvia-hurov'), nie UUID. Migrácia 026
-- mala by_user_id UUID čo by spôsobilo INSERT zlyhanie pri ukladaní akcie
-- z UI. Tu to opravujeme.

ALTER TABLE klienti_history ALTER COLUMN by_user_id TYPE TEXT;
