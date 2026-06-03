-- 100_faktury_dodavatel_snapshot.sql
-- Uzamknutie údajov dodávateľa na faktúre (compliance 222/2004 § 71-76 + 431/2002).
--
-- Problém:
--   Detail faktúry a PDF route čítali údaje dodávateľa živo z `makler_dodavatel`.
--   Ak maklér zmenil IBAN / adresu / IČ DPH v Nastaveniach → historické faktúry
--   sa retroaktívne prekreslili s novými údajmi → nesúlad s kópiou u odberateľa
--   a porušenie nemennosti účtovného záznamu.
--
-- Riešenie:
--   Snapshot dodávateľa do `faktury.dodavatel_snapshot jsonb` pri vystavení.
--   Symetria s už existujúcim `odberatel_snapshot`.
--
-- Backfill:
--   Pre staré faktúry vezmeme aktuálne `makler_dodavatel` per `user_id` ako
--   "best effort" snapshot. Ak settings neexistujú, ostane NULL → fallback
--   v code reads aktuálne dáta (legacy compat).

BEGIN;

ALTER TABLE public.faktury
  ADD COLUMN IF NOT EXISTS dodavatel_snapshot jsonb;

UPDATE public.faktury f
SET dodavatel_snapshot = to_jsonb(md.*)
                        - 'user_id'
                        - 'created_at'
                        - 'updated_at'
FROM public.makler_dodavatel md
WHERE md.user_id = f.user_id
  AND f.dodavatel_snapshot IS NULL;

COMMENT ON COLUMN public.faktury.dodavatel_snapshot IS
  'Zamrznutý snapshot makler_dodavatel k dátumu vystavenia (compliance 222/2004 § 71-76). NULL pre legacy faktúry bez settings → fallback na live lookup.';

COMMIT;
