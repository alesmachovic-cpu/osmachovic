-- ============================================================================
-- 114_faktury_revert_per_makler_cislovanie.sql
-- ============================================================================
-- REVERT regresie z dev migrácie 075 (2026-06-09).
--
-- Rozhodnutie CEO + Pravo (commity G31 — b1dfe73, b92307b):
--   Faktúrne číslovanie je PER MAKLÉR / DODÁVATEĽ, nie per firma.
--   Každý maklér má vlastné IČO a fakturuje ako samostatný dodávateľ
--   (odberateľ = Vianema). Vlastný dodávateľský rad => 3× FA20260001 od
--   troch rôznych maklérov NIE je duplicita, ale tri samostatné rady.
--
-- Migrácia 075 omylom zaviedla UNIQUE (company_id, cislo_faktury) a
-- (company_id, variabilny_symbol) — to zlučuje maklérske rady do jedného
-- firemného radu (regresia). Použila CREATE ... IF NOT EXISTS s novým
-- názvom, takže pôvodný správny index `faktury_user_cislo_uniq` z migr. 032
-- ostal — v DB teda bežia oba naraz a company-level blokuje to, čo
-- per-maklér rad legitímne povoľuje.
--
-- Tento revert:
--   1) DROP oboch company-level indexov z 075.
--   2) Ponecháva `faktury_user_cislo_uniq` (032) ako per-maklér race guard
--      pre číslo faktúry (NEdotýkame sa ho).
--   3) Pridáva symetrický per-maklér race guard pre variabilný symbol
--      (075 ho mal na company úrovni; po dropnutí by VS ostal bez ochrany).
--
-- POZN.: Faktúra `nikoleta-szalayova` má číslo `FA20260001-DUP2` (artefakt
--   dedupu z 075). Vrátenie čísla = zmena zákonnej náležitosti účtovného
--   dokladu → rieši sa samostatne po výslovnom súhlase CEO (🔴 protokol),
--   NIE v tejto migrácii.
-- ============================================================================

-- 1) Drop company-level unique indexov z 075 (regresia).
DROP INDEX IF EXISTS uniq_faktury_company_cislo;
DROP INDEX IF EXISTS uniq_faktury_company_vs;

-- 2) Per-maklér race guard pre variabilný symbol (symetria k faktury_user_cislo_uniq).
--    Bez user_id v indexe by retry-on-23505 v POST /api/faktury nemal čo zachytiť
--    pri paralelných POSToch toho istého makléra.
CREATE UNIQUE INDEX IF NOT EXISTS faktury_user_vs_uniq
  ON faktury (user_id, variabilny_symbol)
  WHERE variabilny_symbol IS NOT NULL AND user_id IS NOT NULL;

COMMENT ON INDEX faktury_user_vs_uniq IS
  'Per-maklér race-fix pre VS (revert per-company z 075). Číslovanie je per dodávateľ/maklér.';
