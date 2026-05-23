-- 092_backfill_uz_kupil.sql
-- Per Aleš (2026-05-23): existujúci kupujúci ktorí mali status='uz_predal'
-- (lebo to bol jediný "finálny" stav) sa premenujú na 'uz_kupil' — sémantika
-- predaja patrí predávajúcemu, kúpy kupujúcemu.
--
-- Týka sa LEN typu kupujuci. Pre 'oboje' nechávame uz_predal lebo predstavuje
-- predaj jeho strany (Aleš môže manuálne prepnúť na uz_kupil ak je relevantnejšie).
--
-- Audit trail: do klienti_history zapíše action='auto_status_rename' pre každý
-- záznam, aby bol pôvodný stav vyhľadateľný.

BEGIN;

-- 1. Audit záznamy (pred update, aby sme mali pôvodný stav)
INSERT INTO public.klienti_history (klient_id, action, from_makler_id, dovod, company_id)
SELECT id, 'auto_status_rename', makler_id,
       'Status uz_predal premenovaný na uz_kupil pre typ=kupujuci (per Aleš 2026-05-23)',
       company_id
FROM public.klienti
WHERE typ = 'kupujuci' AND status = 'uz_predal';

-- 2. Update samotný
UPDATE public.klienti
SET status = 'uz_kupil'
WHERE typ = 'kupujuci' AND status = 'uz_predal';

COMMIT;
