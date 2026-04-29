-- ============================================================
-- 028: Faktury per-makler — vlastný nezávislý rad pre každého
-- ============================================================
-- Účel:
--   Doteraz boli faktúry zdieľané medzi všetkými maklérmi (jeden
--   globálny rad), takže Aleš mal FA20260001 a Slavomír FA20260002.
--   Každý maklér je samostatná jednotka (nie spoločná firma) → vlastný
--   nezávislý rad od FA-RRRR-0001.
--
--   1) Pridaj `user_id` do `faktury` (FK → users.id).
--   2) Backfill: existujúcu Slavovu FA20260002 priraď jemu a prečísluj
--      na FA20260001 (jeho prvá v jeho rade).
--   3) Cleanup: existujúcu Alešovu FA20260001 (test) zmaž — pri spätnej
--      identifikácii zostane po backfille s user_id IS NULL.
-- ============================================================

-- 1) Stĺpec + index
ALTER TABLE faktury ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_faktury_user_id ON faktury(user_id);

-- 2) Backfill Slavomír Kollár — FA20260002 → jeho FA20260001
DO $$
DECLARE
  v_slavo uuid;
  v_faktura_id uuid;
BEGIN
  SELECT id INTO v_slavo FROM users WHERE lower(email) = 'kollar@vianema.eu' LIMIT 1;
  IF v_slavo IS NULL THEN
    RAISE EXCEPTION 'User kollar@vianema.eu nenájdený v users';
  END IF;

  SELECT id INTO v_faktura_id FROM faktury WHERE cislo_faktury = 'FA20260002' LIMIT 1;
  IF v_faktura_id IS NULL THEN
    RAISE NOTICE 'Faktura FA20260002 neexistuje — preskakujem Slavov backfill';
  ELSE
    UPDATE faktury
       SET user_id = v_slavo,
           cislo_faktury = 'FA20260001',
           variabilny_symbol = 'VS20260001'
     WHERE id = v_faktura_id;

    UPDATE prehlad_zaznamy
       SET popis = 'Faktúra FA20260001'
     WHERE faktura_id = v_faktura_id;
  END IF;
END $$;

-- 3) Cleanup — zmaž zvyšné faktúry bez user_id (Alešova testovacia FA20260001)
DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM faktury WHERE user_id IS NULL LOOP
    DELETE FROM prehlad_zaznamy WHERE faktura_id = v_id;
    DELETE FROM faktura_polozky WHERE faktura_id = v_id;
    DELETE FROM faktury WHERE id = v_id;
  END LOOP;
END $$;
