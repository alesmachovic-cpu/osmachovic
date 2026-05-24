-- 082_makler_provizie_makler_id.sql
-- Pridáva makler_id column do makler_provizie_pct + trim existing meno.
-- Pôvodne sa lookup robil cez `p.meno === acc.name` strict equality, ale v DB
-- bol trailing whitespace ("Silvia Hurová ") → match zlyhal → form ukázal 0%
-- → POST vytvoril duplikát s neexistujúcim makler_id stĺpcom → silent fail.

ALTER TABLE public.makler_provizie_pct
  ADD COLUMN IF NOT EXISTS makler_id TEXT;

-- Vyčisti trailing whitespace v existujúcich riadkoch.
UPDATE public.makler_provizie_pct SET meno = TRIM(meno) WHERE meno <> TRIM(meno);

-- Backfill makler_id z users tabuľky podľa trim/lowercase meno match.
UPDATE public.makler_provizie_pct mpp
   SET makler_id = u.id
  FROM public.users u
 WHERE mpp.makler_id IS NULL
   AND LOWER(TRIM(mpp.meno)) = LOWER(TRIM(u.name));

COMMENT ON COLUMN public.makler_provizie_pct.makler_id IS 'FK na users.id. Spoľahlivý lookup namiesto matching cez meno (whitespace/case issues).';
