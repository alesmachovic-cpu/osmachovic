-- 093_zaujem_nasa_ina.sql
-- Per Aleš (2026-05-23): "rozlíš či má záujem o konkrétnu u nás alebo v inej RK".
-- Distinkcia má business hodnotu — pre našu nehnuteľnosť ide o priamu províziu,
-- pre cudziu len o nákupný agent (alebo nič).
--
-- Pridávame 2 nové statusy. Pôvodný 'zaujem_o_konkretnu' zachovávame pre
-- prípadné legacy (žiadny klient ho zatiaľ ešte nepoužil, ale safety first).

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
    'zaujem_konkretna_nasa'::text,
    'zaujem_konkretna_ina_rk'::text,
    'odlozene'::text, 'nereaguje'::text,
    'turista'::text
  ]));

COMMIT;
