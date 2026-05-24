-- 091_uz_kupil_turista.sql
-- Per Aleš (2026-05-23):
--   1. "nie už predal ale už kúpil" — pre kupujúceho sémanticky správnejší
--      status. Predaj patrí predávajúcemu, kúpa kupujúcemu.
--   2. "pridaj ešte položku turista" — kupujúci čo len pozerá, nie vážny záujem.

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
    'zaujem_o_konkretnu'::text, 'odlozene'::text, 'nereaguje'::text,
    'turista'::text
  ]));

COMMIT;
