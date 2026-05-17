-- 070_naberove_makler_id_and_perf_indexes.sql
-- Účel:
--   1) Pridať makler_id stĺpec do naberove_listy — denormalized owner pre rýchle
--      filtrovanie (route /api/nabery?mine=1 dnes padá so 500 lebo stĺpec chýba).
--   2) Backfill existujúcich riadkov z klienti (vlastník náberu = vlastník klienta).
--   3) Composite indexy pre časté dashboard queries.
--
-- Reverzibilné: down migration na konci v komentári.
-- Bezpečné: aditívna zmena. Existujúci kód stĺpec nepozná => ignoruje ho.
-- Dopad na dáta: žiadne riadky sa nemenia okrem populovania nového stĺpca.

-- ============================================================================
-- 1) Pridaj stĺpec
-- ============================================================================
-- Bez FK constraintu — public.users.id je text, makler_id je samostatný uuid
-- identifier (nie PK). Klienti.makler_id má rovnaký pattern (plain uuid bez FK).
-- App-layer drží integritu cez scope.makler_id pri INSERT/UPDATE.
ALTER TABLE naberove_listy
  ADD COLUMN IF NOT EXISTS makler_id uuid;

COMMENT ON COLUMN naberove_listy.makler_id IS
  'Denormalized owner — vlastník náberu odvodený od klient.makler_id. Synced v API vrstve pri INSERT a pri zmene klienta. Bez FK (rovnaký pattern ako klienti.makler_id).';

-- ============================================================================
-- 2) Backfill: vlastník náberu = vlastník klienta (ak je klient priradený)
-- ============================================================================
UPDATE naberove_listy nl
SET makler_id = k.makler_id
FROM klienti k
WHERE k.id = nl.klient_id
  AND k.makler_id IS NOT NULL
  AND nl.makler_id IS NULL;

-- ============================================================================
-- 3) Composite indexy pre časté dashboard queries
-- ============================================================================
-- /api/nabery?mine=1 — vlastníkov filter v rámci firmy
CREATE INDEX IF NOT EXISTS idx_naberove_listy_company_makler_created
  ON naberove_listy(company_id, makler_id, created_at DESC);

-- /api/nabery?klient_id=X — náberové listy konkrétneho klienta
CREATE INDEX IF NOT EXISTS idx_naberove_listy_company_klient
  ON naberove_listy(company_id, klient_id);

-- /api/obhliadky — kalendár obhliadok firmy zoradený podľa dátumu
CREATE INDEX IF NOT EXISTS idx_obhliadky_company_datum
  ON obhliadky(company_id, datum DESC);

-- /api/klienti?mine=1 — klienti makléra v rámci firmy
CREATE INDEX IF NOT EXISTS idx_klienti_company_makler
  ON klienti(company_id, makler_id);

-- ============================================================================
-- DOWN MIGRATION (manuálne, ak treba revert):
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_klienti_company_makler;
-- DROP INDEX IF EXISTS idx_obhliadky_company_datum;
-- DROP INDEX IF EXISTS idx_naberove_listy_company_klient;
-- DROP INDEX IF EXISTS idx_naberove_listy_company_makler_created;
-- ALTER TABLE naberove_listy DROP COLUMN IF EXISTS makler_id;
-- ============================================================================
