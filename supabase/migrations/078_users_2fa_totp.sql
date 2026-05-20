-- ============================================================================
-- 078_users_2fa_totp.sql
-- ============================================================================
-- 2FA TOTP (RFC 6238) backbone pre users.
--
-- Pre admin/majiteľ role je 2FA POVINNÉ (gateway na security best-practice +
-- compliance — zákon 297/2008 AML vyžaduje "robustné identifikačné prostriedky"
-- pre osoby s administrátorským prístupom k osobným údajom).
--
-- Schéma:
--   - totp_secret      base32 secret (16-32 chars, generated server-side)
--   - totp_enabled_at  timestamp kedy bolo 2FA potvrdené (NULL = nie je aktívne)
--   - totp_backup_codes JSONB array hashov backup codes (10 ks, single-use)
--
-- Backup codes pre prípad straty telefónu — bcrypt hash, plaintext sa
-- užívateľovi zobrazí RAZ pri zapnutí 2FA, potom sa stratí navždy.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret text NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS totp_backup_codes jsonb NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS totp_last_used_counter bigint NULL;

-- Tabuľka pre dočasné 2FA challenge pri login flow (medzi password OK a TOTP overeným).
CREATE TABLE IF NOT EXISTS auth_2fa_challenges (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge    text        NOT NULL,
  ip           text        NULL,
  user_agent   text        NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_2fa_challenges_user_active
  ON auth_2fa_challenges (user_id, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_2fa_challenges_challenge
  ON auth_2fa_challenges (challenge)
  WHERE used_at IS NULL;

-- Indexes pre lookup pri verify (totp_secret nesmie ísť cez logy / select default).
COMMENT ON COLUMN users.totp_secret IS
  '2FA TOTP secret v base32 formáte. NIKDY sa nevracia v API response (server-only).';
COMMENT ON COLUMN users.totp_enabled_at IS
  'NULL = 2FA nie je aktivované. Inak: timestamp zapnutia.';
COMMENT ON COLUMN users.totp_backup_codes IS
  'JSON array bcrypt hashov backup codes. Single-use — po použití odstránený.';
COMMENT ON COLUMN users.totp_last_used_counter IS
  'Posledný úspešne použitý TOTP counter (~30s window). Zabráni replay attacku.';
