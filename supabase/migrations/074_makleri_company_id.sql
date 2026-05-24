-- ============================================================================
-- 074_makleri_company_id.sql
-- ============================================================================
-- P1 cross-tenant leak fix (2026-05-20):
--   Tabuľka `makleri` nemala company_id → GET /api/makleri vracal makléri
--   všetkých firiem. Multi-tenant breach.
--
-- Riešenie:
--   1. Pridáme makleri.company_id (NULL pre legacy, NOT NULL pre nové).
--   2. Backfill: pre každého maklera nájdime company_id cez users.makler_id
--      (každý maklér je linkovaný cez users row).
--   3. Default = Vianema (pre osamostatnené makleri záznamy bez user-a).
--   4. Index pre rýchle filtre.
-- ============================================================================

ALTER TABLE makleri
  ADD COLUMN IF NOT EXISTS company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL;

-- Backfill cez join s users.
UPDATE makleri m
SET company_id = u.company_id
FROM users u
WHERE u.makler_id = m.id
  AND m.company_id IS NULL
  AND u.company_id IS NOT NULL;

-- Fallback: zvyšné makleri (bez priradeného usera) → Vianema (default tenant).
UPDATE makleri
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_makleri_company ON makleri (company_id);

COMMENT ON COLUMN makleri.company_id IS
  'Multi-tenant scope. Každý maklér patrí presne do jednej firmy. Pre nové záznamy je NOT NULL pri inserte (handlované na API úrovni).';
