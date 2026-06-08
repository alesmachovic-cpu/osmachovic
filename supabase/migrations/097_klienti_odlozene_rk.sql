-- 097_klienti_odlozene_rk.sql
-- Per Aleš (2026-05-24):
--   - Status "Odložené" → kedy klient začne znova hľadať (dátum)
--   - Status "Realitná kancelária" → názov RK ktorej klient patrí

BEGIN;

ALTER TABLE public.klienti
  ADD COLUMN IF NOT EXISTS odlozene_do DATE,
  ADD COLUMN IF NOT EXISTS rk_nazov TEXT;

COMMENT ON COLUMN public.klienti.odlozene_do IS
  'Pri statuse "odlozene" — orientačný dátum kedy klient začne znova hľadať byt.';
COMMENT ON COLUMN public.klienti.rk_nazov IS
  'Pri statuse "realitna_kancelaria" — názov realitnej kancelárie (klient nepôjde k nám).';

COMMIT;
