-- Pridaj Google OAuth stĺpce do users tabuľky
-- Spustiť v Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expires_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email TEXT;
