-- Aktualizácia check constraintov pre tabuľku klienti
-- Spustiť v Supabase SQL Editor

-- Odstráň starý status constraint
ALTER TABLE klienti DROP CONSTRAINT IF EXISTS klienti_status_check;

-- Pridaj nový s rozšírenými statusmi
ALTER TABLE klienti ADD CONSTRAINT klienti_status_check
  CHECK (status IN (
    'novy', 'novy_kontakt', 'aktivny', 'dohodnuty_naber',
    'pasivny', 'volat_neskor', 'nedovolal', 'nechce_rk',
    'uz_predal', 'realitna_kancelaria', 'uzavrety', 'caka_na_schvalenie'
  ));

-- Odstráň starý typ constraint
ALTER TABLE klienti DROP CONSTRAINT IF EXISTS klienti_typ_check;

-- Pridaj nový s "oboje"
ALTER TABLE klienti ADD CONSTRAINT klienti_typ_check
  CHECK (typ IN ('kupujuci', 'predavajuci', 'oboje'));
