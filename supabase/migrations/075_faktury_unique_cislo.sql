-- ============================================================================
-- 075_faktury_unique_cislo.sql
-- ============================================================================
-- P1 race-condition fix (2026-05-20):
--   POST /api/faktury používa retry loop pri 23505 (unique violation), ale
--   v DB chýbal samotný UNIQUE index. To znamená že pri paralelných POSToch
--   sa mohli vygenerovať DVE faktúry s rovnakým číslom (race window medzi
--   nextNumber() a insert).
--
-- Riešenie: UNIQUE (company_id, cislo_faktury) — číslo unikátne v rámci firmy.
-- A pre VS rovnaký constraint.
--
-- Pred vytvorením indexu deduplikujeme existujúce kolízie (ak by nejaké boli)
-- pripočítaním sufixu k duplicitám.
-- ============================================================================

-- 1) Bezpečnostná deduplikácia ak by nejaké duplikáty existovali.
WITH dups AS (
  SELECT id, cislo_faktury, company_id,
         ROW_NUMBER() OVER (PARTITION BY company_id, cislo_faktury ORDER BY created_at) AS rn
  FROM faktury
  WHERE cislo_faktury IS NOT NULL
)
UPDATE faktury f
SET cislo_faktury = f.cislo_faktury || '-DUP' || d.rn
FROM dups d
WHERE f.id = d.id AND d.rn > 1;

WITH dups_vs AS (
  SELECT id, variabilny_symbol, company_id,
         ROW_NUMBER() OVER (PARTITION BY company_id, variabilny_symbol ORDER BY created_at) AS rn
  FROM faktury
  WHERE variabilny_symbol IS NOT NULL
)
UPDATE faktury f
SET variabilny_symbol = f.variabilny_symbol || '-DUP' || d.rn
FROM dups_vs d
WHERE f.id = d.id AND d.rn > 1;

-- 2) UNIQUE indexy.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_faktury_company_cislo
  ON faktury (company_id, cislo_faktury)
  WHERE cislo_faktury IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_faktury_company_vs
  ON faktury (company_id, variabilny_symbol)
  WHERE variabilny_symbol IS NOT NULL;

COMMENT ON INDEX uniq_faktury_company_cislo IS
  'P1 race-fix: predchádza duplikátnym číslam faktúr pri paralelných POSToch.';
