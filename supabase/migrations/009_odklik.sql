-- ============================================================================
-- Odklik — automatický presun klientov po 24h bez akcie
-- ============================================================================
-- Pravidlá:
--   - status "novy" / "novy_kontakt" → 24h od updated_at bez akcie → odklik
--   - status "volat_neskor"          → 24h od datum_naberu bez akcie → odklik
--   - status "dohodnuty_naber"       → 24h od datum_naberu bez náberáka ani nového termínu → odklik
--   - status "nechce_rk"             → okamžite → odklik (manuálne nastavené maklérom)
-- ============================================================================

ALTER TABLE klienti
  ADD COLUMN IF NOT EXISTS je_v_odkliku BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS odklik_from_status VARCHAR(50),  -- pôvodný status pred odklikom
  ADD COLUMN IF NOT EXISTS odklik_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_klienti_odklik ON klienti (je_v_odkliku, odklik_at DESC);
CREATE INDEX IF NOT EXISTS idx_klienti_status_updated ON klienti (status, updated_at);

-- Pozn: RK marker využíva existujúci status 'realitna_kancelaria'.
-- Overovanie duplikátov v NewKlientModal skontroluje status klientov s rovnakým telefónom.

COMMENT ON COLUMN klienti.je_v_odkliku IS 'TRUE ak klient bol presunutý do Odkliku (24h bez akcie alebo nechce_rk)';
COMMENT ON COLUMN klienti.odklik_from_status IS 'Pôvodný status klienta pred presunom do Odkliku';
COMMENT ON COLUMN klienti.odklik_at IS 'Kedy bol klient presunutý do Odkliku';
