-- 098_klienti_status_kupujuci.sql
-- Per Aleš (2026-05-24): pre OBOJE klienta (kupujúci + predávajúci) je
-- jeden zlúčený status nepresný — bežne má klient nezávislé stavy na
-- predajnej a nákupnej strane (napr. "Nabraný" + "Záujem o našu").
-- Pridávame samostatný stĺpec `status_kupujuci`; pôvodný `status`
-- ostáva pre predávajúcu pipeline.
--
-- Validné hodnoty kopírujú existujúci klienti_status_check constraint,
-- takže žiadny nový constraint nepotrebujeme. NULL = neaktívna kupujúca
-- strana (typické pre čisto predávajúceho klienta).

BEGIN;

ALTER TABLE public.klienti
  ADD COLUMN IF NOT EXISTS status_kupujuci TEXT;

-- Validné hodnoty pre kupujúcu pipeline. Mä rovnaký set ako klienti_status_check
-- aby sme nemuseli udržiavať dva enum-y; null je tiež OK.
ALTER TABLE public.klienti DROP CONSTRAINT IF EXISTS klienti_status_kupujuci_check;
ALTER TABLE public.klienti ADD CONSTRAINT klienti_status_kupujuci_check
  CHECK (status_kupujuci IS NULL OR status_kupujuci = ANY (ARRAY[
    'novy'::text, 'novy_kontakt'::text, 'aktivny'::text,
    'dohodnuty_naber'::text, 'nabrany'::text, 'pasivny'::text,
    'volat_neskor'::text, 'nedovolal'::text, 'nechce_rk'::text,
    'uz_predal'::text, 'uz_kupil'::text,
    'realitna_kancelaria'::text, 'uzavrety'::text,
    'caka_na_schvalenie'::text, 'caka_na_hypoteku'::text,
    'zaujem_o_konkretnu'::text,
    'zaujem_konkretna_nasa'::text,
    'zaujem_konkretna_ina_rk'::text,
    'odlozene'::text, 'nereaguje'::text,
    'turista'::text
  ]));

COMMENT ON COLUMN public.klienti.status_kupujuci IS
  'Status na kupujúcej strane pri OBOJE klientoch. NULL pre čistých predávajúcich a kupujúcich (tí používajú `status`).';

COMMIT;
