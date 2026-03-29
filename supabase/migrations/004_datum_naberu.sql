-- Dátum náberu a calendar event ID na klientovi
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS datum_naberu TIMESTAMPTZ;
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Dátum náberu na naberovom liste
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS datum_naberu TIMESTAMPTZ;
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
