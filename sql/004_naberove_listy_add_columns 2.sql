-- Pridanie stĺpcov pre typ inzercie a dokumenty do naberove_listy
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS typ_inzercie TEXT DEFAULT 'online';
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS dokumenty JSONB DEFAULT '{}';
