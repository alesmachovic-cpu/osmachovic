-- 063: naberove_listy — polia pre výhradnú/nevýhradnú zmluvu
-- zmluva:        či klient podpísal zmluvu
-- typ_zmluvy:    'exkluzivna' | 'neexkluzivna'
-- datum_podpisu: dátum podpisu zmluvy
-- zmluva_do:     platnosť zmluvy do

ALTER TABLE naberove_listy
  ADD COLUMN IF NOT EXISTS zmluva        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS typ_zmluvy    TEXT,
  ADD COLUMN IF NOT EXISTS datum_podpisu DATE,
  ADD COLUMN IF NOT EXISTS zmluva_do     DATE;
