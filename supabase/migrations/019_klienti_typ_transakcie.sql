-- ============================================================
-- 019: Typ transakcie (predaj / prenájom) na klientovi
-- ============================================================
-- Pri vytváraní klienta typu "predávajúci" alebo "oboje" maklér
-- vyberie či ide o predaj alebo prenájom. Údaj sa propaguje do
-- náberového listu a inzerátu ako default `kategoria`.
-- ============================================================

ALTER TABLE klienti
  ADD COLUMN IF NOT EXISTS typ_transakcie TEXT;

-- Voliteľný CHECK constraint (povolíme iba tieto hodnoty alebo NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'klienti_typ_transakcie_check'
  ) THEN
    ALTER TABLE klienti
      ADD CONSTRAINT klienti_typ_transakcie_check
      CHECK (typ_transakcie IS NULL OR typ_transakcie IN ('na-predaj', 'na-prenajom'));
  END IF;
END $$;
