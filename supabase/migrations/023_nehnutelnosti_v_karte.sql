-- ============================================================
-- 023: Nehnuteľnosti v karte klienta — grupovanie + dodatky k náberákom
-- ============================================================
-- Umožní:
--  1. Klient má N nehnuteľností, každá vlastný náberák + inzerát
--  2. K existujúcemu náberáku (ktorý už má inzerát) sa nedá robiť edit,
--     iba pripojiť "dodatok" cez parent_naberak_id
--  3. Dokumenty klienta sa dajú priradiť ku konkrétnej nehnuteľnosti
-- ============================================================

-- 1. Parent pre dodatky k náberákom (NULL = originál, inak → id originálu)
ALTER TABLE naberove_listy
  ADD COLUMN IF NOT EXISTS parent_naberak_id UUID
    REFERENCES naberove_listy(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS naberove_listy_parent_idx
  ON naberove_listy(parent_naberak_id) WHERE parent_naberak_id IS NOT NULL;

-- 2. Prepojenie dokumentov na konkrétnu nehnuteľnosť (NULL = klient-level dokument)
ALTER TABLE klient_dokumenty
  ADD COLUMN IF NOT EXISTS nehnutelnost_id UUID
    REFERENCES nehnutelnosti(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS klient_dokumenty_nehnutelnost_idx
  ON klient_dokumenty(nehnutelnost_id) WHERE nehnutelnost_id IS NOT NULL;

-- 3. Prepojenie náberáka na inzerát — uľahčuje lookup "má tento náberák
-- publikovaný inzerát?"
ALTER TABLE nehnutelnosti
  ADD COLUMN IF NOT EXISTS naberak_id UUID
    REFERENCES naberove_listy(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS nehnutelnosti_naberak_idx
  ON nehnutelnosti(naberak_id) WHERE naberak_id IS NOT NULL;
