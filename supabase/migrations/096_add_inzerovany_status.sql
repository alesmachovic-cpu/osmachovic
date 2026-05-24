-- Migration 096 — pridať 'inzerovany' status do klienti
-- Vytvorené: 2026-05-24 (P0 hotfix po audite)
--
-- BUG: UI používa status 'inzerovany' (klienti/[id]/page.tsx:509 — auto-prechod
-- "nabraný + aktívny inzerát → inzerovaný"), ale DB constraint ho nepovoľoval
-- → PATCH /api/klienti vracal 500, a hneď nato sa vytvoril klamný audit log
-- "Nabraný → Inzerovaný" (status v DB ostal 'nabrany', timeline tvrdil opak).

BEGIN;

ALTER TABLE public.klienti DROP CONSTRAINT IF EXISTS klienti_status_check;

ALTER TABLE public.klienti ADD CONSTRAINT klienti_status_check
  CHECK (status = ANY (ARRAY[
    'novy'::text, 'novy_kontakt'::text, 'aktivny'::text,
    'dohodnuty_naber'::text, 'nabrany'::text, 'inzerovany'::text,
    'pasivny'::text, 'volat_neskor'::text, 'nedovolal'::text, 'nechce_rk'::text,
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
