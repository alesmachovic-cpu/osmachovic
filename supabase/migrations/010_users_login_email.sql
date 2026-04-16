-- Pridá stĺpec login_email do users tabuľky
-- login_email = Gmail alebo iný Google email na prihlásenie cez OAuth
-- email = pôvodný business email (napr. @vianema.eu) na faktúry a komunikáciu

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_login_email ON users (lower(login_email));

COMMENT ON COLUMN users.login_email IS 'Google email (Gmail) pre OAuth login. Môže byť rôzny od email (ktorý je business/vianema email).';
