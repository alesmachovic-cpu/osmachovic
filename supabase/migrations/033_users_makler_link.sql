-- 033_users_makler_link.sql
--
-- Prepojí users (login účet, text id) na makleri (provízie, vlastníctvo,
-- text id). Doteraz mapping existoval iba implicitne cez email. Pridáme
-- explicitný FK aby ownership check v API endpointoch nemusel pri každom
-- requeste robiť email lookup.
--
-- Tiež: Slavo (mgr-slavomr-kollr) mal user account ale chýbal mu záznam
-- v makleri — bez neho by nemohol vlastniť klientov a inzeráty. Pridáme.
-- Aleš má v users.email "machovic@vianema.eu" ale v makleri.email
-- "ales@vianema.sk" — namatchujeme cez meno.

BEGIN;

-- 1) Vytvor chýbajúci makleri záznam pre Slavov
INSERT INTO makleri (meno, email, firma, aktivny)
SELECT 'Mgr. Slavomír Kollár', 'kollar@vianema.eu', 'Vianema Real', true
WHERE NOT EXISTS (SELECT 1 FROM makleri WHERE lower(email) = 'kollar@vianema.eu');

-- 2) FK stĺpec users.makler_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS makler_id uuid REFERENCES makleri(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_makler_id ON users(makler_id);

-- 3) Auto-mapping by-email
UPDATE users u SET makler_id = m.id
FROM makleri m
WHERE lower(coalesce(m.email,'')) = lower(coalesce(u.email,''))
  AND u.email IS NOT NULL
  AND u.makler_id IS NULL;

-- 4) Aleš special case (rôzne emaily medzi tabuľkami) — match by meno
UPDATE users SET makler_id = (
  SELECT id FROM makleri WHERE meno = 'Aleš Machovič' LIMIT 1
)
WHERE id = 'ales' AND makler_id IS NULL;

COMMIT;
