-- Pridaj medziprovizia stĺpec do makler_provizie_pct
-- Medziprovizia = časť provizie delená medzi manažéra a firmu (nie maklerova časť)
ALTER TABLE makler_provizie_pct ADD COLUMN IF NOT EXISTS medziprovizia numeric DEFAULT 0;
