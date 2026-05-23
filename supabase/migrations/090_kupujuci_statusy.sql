-- 090_kupujuci_statusy.sql
-- 4 nové statusy pre kupujúcich (per Aleš 2026-05-23):
--   caka_na_hypoteku     — vyhliadol konkrétnu, čaká na schválenie banky
--   zaujem_o_konkretnu   — vyhliadol jednu, ide na rezerváciu (vypne bulk matching)
--   odlozene             — záujem trvá ale teraz nemá kapacitu
--   nereaguje            — dlhšie ticho, kandidát na cold-call alebo uvoľnenie

BEGIN;

ALTER TABLE public.klienti DROP CONSTRAINT IF EXISTS klienti_status_check;

ALTER TABLE public.klienti ADD CONSTRAINT klienti_status_check
  CHECK (status = ANY (ARRAY[
    'novy'::text,
    'novy_kontakt'::text,
    'aktivny'::text,
    'dohodnuty_naber'::text,
    'nabrany'::text,
    'pasivny'::text,
    'volat_neskor'::text,
    'nedovolal'::text,
    'nechce_rk'::text,
    'uz_predal'::text,
    'realitna_kancelaria'::text,
    'uzavrety'::text,
    'caka_na_schvalenie'::text,
    'caka_na_hypoteku'::text,
    'zaujem_o_konkretnu'::text,
    'odlozene'::text,
    'nereaguje'::text
  ]));

COMMIT;
