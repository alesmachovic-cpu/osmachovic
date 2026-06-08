-- 095_klienti_zaujem_nehnutelnost.sql
-- Per Aleš (2026-05-24): keď kupujúci dostane status "Záujem — naša nehnuteľnosť"
-- alebo "Záujem — v inej RK", treba evidovať O KTORÚ konkrétne ide.
--
-- - zaujem_nehnutelnost_id → FK na našu nehnuteľnosť z portfólia.
--   ON DELETE SET NULL — keď sa naša nehnuteľnosť zmaže, status klienta ostane
--   ale link zhasne (lepšie ako kaskádové mazanie klienta).
-- - zaujem_ina_rk → voľný text (URL inzerátu / adresa) pre nehnuteľnosti v cudzej RK.

BEGIN;

ALTER TABLE public.klienti
  ADD COLUMN IF NOT EXISTS zaujem_nehnutelnost_id UUID
    REFERENCES public.nehnutelnosti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zaujem_ina_rk TEXT;

CREATE INDEX IF NOT EXISTS klienti_zaujem_nehnutelnost_id_idx
  ON public.klienti(zaujem_nehnutelnost_id)
  WHERE zaujem_nehnutelnost_id IS NOT NULL;

COMMENT ON COLUMN public.klienti.zaujem_nehnutelnost_id IS
  'Pri statuse zaujem_konkretna_nasa — FK na konkrétnu nehnuteľnosť z nášho portfólia.';
COMMENT ON COLUMN public.klienti.zaujem_ina_rk IS
  'Pri statuse zaujem_konkretna_ina_rk — voľný text (URL inzerátu alebo adresa) o nehnuteľnosti v cudzej RK.';

COMMIT;
