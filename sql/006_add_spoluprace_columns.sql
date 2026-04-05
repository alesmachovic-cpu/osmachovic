-- Add collaboration columns to klienti table
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS spolupracujuci_makler_id uuid REFERENCES makleri(id);
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS spolupracujuci_provizia_pct integer DEFAULT NULL;
