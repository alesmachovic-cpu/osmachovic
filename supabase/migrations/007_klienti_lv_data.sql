-- Uloženie parsovaných údajov z LV priamo na klient
ALTER TABLE klienti
  ADD COLUMN IF NOT EXISTS lv_data JSONB;
