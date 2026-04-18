-- ============================================================================
-- MIGRATION 013: Password reset tokens
-- ============================================================================
-- Tabuľka na uloženie reset tokenov posielaných emailom.
-- Token je SHA-256 hash reálneho stringu ktorý ide do URL.
-- Expirácia: 1 hodina od vytvorenia.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  email_sent_to TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwreset_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwreset_expires ON password_reset_tokens (expires_at);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pwreset_service_only" ON password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE password_reset_tokens IS 'Tokeny na reset hesla, platnosť 1h. Spravovaní cez /api/auth/forgot + /api/auth/reset.';
