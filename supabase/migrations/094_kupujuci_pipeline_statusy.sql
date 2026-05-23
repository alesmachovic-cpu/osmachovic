-- 094_kupujuci_pipeline_statusy.sql
-- Per Aleš (2026-05-23) plan-kupujuci F1: 4 nové statusy pre pipeline kupujúceho.
--   hypo_konzultacia   — dohodnuté stretnutie s hypo poradcom
--   kapacita_schvalena — banka schválila bonitu, vieme rozpočet
--   rezervacia         — podpísaná rezervačná zmluva
--   podpis_kz          — kúpna zmluva u notára

BEGIN;

ALTER TABLE public.klienti DROP CONSTRAINT IF EXISTS klienti_status_check;

ALTER TABLE public.klienti ADD CONSTRAINT klienti_status_check
  CHECK (status = ANY (ARRAY[
    'novy'::text, 'novy_kontakt'::text, 'aktivny'::text,
    'dohodnuty_naber'::text, 'nabrany'::text, 'pasivny'::text,
    'volat_neskor'::text, 'nedovolal'::text, 'nechce_rk'::text,
    'uz_predal'::text, 'uz_kupil'::text,
    'realitna_kancelaria'::text, 'uzavrety'::text,
    'caka_na_schvalenie'::text, 'caka_na_hypoteku'::text,
    'zaujem_o_konkretnu'::text,
    'zaujem_konkretna_nasa'::text, 'zaujem_konkretna_ina_rk'::text,
    'odlozene'::text, 'nereaguje'::text, 'turista'::text,
    -- F1 kupujuci pipeline:
    'hypo_konzultacia'::text, 'kapacita_schvalena'::text,
    'rezervacia'::text, 'podpis_kz'::text
  ]));

COMMIT;
