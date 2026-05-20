-- ============================================================================
-- 079_firma_info_platca_dph.sql
-- ============================================================================
-- DPH switch — od 1.1.2026 sa základná sadzba mení 20% → 23% (zákon 222/2004).
--
-- Pridáva firma_info.platca_dph (boolean) a platca_dph_od (date).
-- API faktúr použije getDphRate(date) na výpočet sadzby podľa dátumu vystavenia.
--
-- Defaultne FALSE pre VIANEMA (zatial neplatca). Aleš to môže zapnúť cez UI
-- keď bude pripravený.
-- ============================================================================

ALTER TABLE firma_info
  ADD COLUMN IF NOT EXISTS platca_dph boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platca_dph_od date NULL;

COMMENT ON COLUMN firma_info.platca_dph IS
  'TRUE = firma je platca DPH. API faktúr použije getDphRate(date) pre aktuálnu sadzbu.';
COMMENT ON COLUMN firma_info.platca_dph_od IS
  'Dátum od ktorého je firma platca DPH. Pre faktúry s datum_vystavenia < tohto je dph=0.';
