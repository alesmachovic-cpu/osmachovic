-- 089_klienti_created_by.sql
-- Aleš (2026-05-23): pri kupujúcich môže klienta editovať každý maklér, ale
-- musí byť jasné kto klienta založil. Preto pridávame created_by_makler_id
-- ktorý sa setne pri INSERT a NIKDY sa nemení (na rozdiel od makler_id ktorý
-- sa môže meniť pri prevode klienta medzi maklérmi).
--
-- Backfill: pre existujúcich klientov skopírujeme z makler_id (best effort).
-- Pre tých kde makler_id je null (voľní klienti), ostane created_by tiež null.

BEGIN;

ALTER TABLE public.klienti
  ADD COLUMN IF NOT EXISTS created_by_makler_id uuid REFERENCES public.makleri(id) ON DELETE SET NULL;

-- Backfill z aktuálneho makler_id (predpokladáme že väčšina klientov je u
-- pôvodného makléra ktorý ich aj založil).
UPDATE public.klienti
SET created_by_makler_id = makler_id
WHERE created_by_makler_id IS NULL AND makler_id IS NOT NULL;

-- Index pre rýchle "ktorých klientov založil maklér X"
CREATE INDEX IF NOT EXISTS idx_klienti_created_by ON public.klienti(created_by_makler_id) WHERE created_by_makler_id IS NOT NULL;

COMMENT ON COLUMN public.klienti.created_by_makler_id IS 'Pôvodný autor klienta. Immutable po INSERT. Pre kupujúcich slúži ako signál "tento klient je môj kontakt" aj keď ho môže editovať každý.';

COMMIT;
