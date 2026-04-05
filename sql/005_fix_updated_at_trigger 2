-- Fix: "record new has no field updated_at" error
-- Pridá updated_at stĺpec do tabuliek kde chýba a opraví/pridá trigger

-- Klienti - pridaj updated_at ak chýba
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Naberove listy - pridaj updated_at ak chýba
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Logy - pridaj updated_at ak chýba
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logy') THEN
    ALTER TABLE logy ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END$$;

-- Universálna funkcia pre automatický updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pre klienti
DROP TRIGGER IF EXISTS set_updated_at ON klienti;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON klienti
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pre naberove_listy
DROP TRIGGER IF EXISTS set_updated_at ON naberove_listy;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON naberove_listy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
