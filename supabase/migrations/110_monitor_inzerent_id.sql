-- ============================================================
-- 110: Monitor — inzerent_id (anonymné ID účtu predajcu) pre RK detekciu
-- ============================================================
-- COMPLIANCE POZNÁMKA (vedomé rozhodnutie CEO, 2026-06-04):
-- Po data-minimizácii (migr. 106) sme prestali ukladať telefón/meno predajcu,
-- čím zomrel najsilnejší signál na odhalenie skrytého RK makléra na bazose
-- ("ten istý inzerent má veľa inzerátov"). Vraciame ho v menej citlivej forme:
--   inzerent_id = ANONYMNÉ ID účtu predajcu na portáli (napr. "bazos:12345"),
--   NIE meno, NIE telefón, NIE kontakt. Nezobrazuje sa v UI. Slúži výlučne na
--   interný agregovaný počet "koľko aktívnych inzerátov má tento účet za 30 dní"
--   → vysoký počet = realitná kancelária.
-- Právny základ: oprávnený záujem (filtrovanie RK šumu z leadov + trhová analýza).
-- Menej citlivé než telefón; účet-handle, nie priamy identifikátor osoby.
-- ============================================================

ALTER TABLE monitor_inzeraty
  ADD COLUMN IF NOT EXISTS inzerent_id text;

CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_inzerent
  ON monitor_inzeraty(inzerent_id) WHERE inzerent_id IS NOT NULL;
