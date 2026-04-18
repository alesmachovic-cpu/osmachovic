-- ============================================================================
-- MIGRATION 012: Login attempts + Audit log
-- ============================================================================

-- ── 1) LOGIN ATTEMPTS — rate limiting + forenzika ──
-- Ukladá KAŽDÝ pokus o prihlásenie (úspešný aj nie) na 15 min.
-- Umožňuje:
--   - Rate limit (max 5 neúspechov za 15 min na IP)
--   - Detekciu útokov (mnoho pokusov za krátky čas)
--   - Audit stopy
CREATE TABLE IF NOT EXISTS login_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip          TEXT NOT NULL,
  identifier  TEXT NOT NULL,           -- email/meno/id čo user zadal
  success     BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
  ON login_attempts (ip, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time
  ON login_attempts (identifier, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success
  ON login_attempts (success, attempted_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- Iba service_role môže čítať/písať (anon neposiela sem direct)
CREATE POLICY "login_attempts_service_only" ON login_attempts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE login_attempts IS 'Rate limiting + audit login pokusov. Zapisované z /api/auth/login.';


-- ── 2) AUDIT LOG — forenzika kritických operácií ──
-- Ukladá KTO (user_id), ČO (akcia), KEDY (timestamp), KDE (tabuľka+id).
-- Príklady akcií:
--   - klient_delete, klient_update, dokument_delete, dokument_view
--   - user_update, user_delete, login, logout
--   - lv_upload, naber_save
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,                    -- crm_user id (napr. 'ales', 'silvia-hurov')
  action      TEXT NOT NULL,           -- napr. 'klient_delete', 'dokument_view'
  entity_type TEXT,                    -- napr. 'klient', 'dokument', 'naber'
  entity_id   TEXT,                    -- ID záznamu
  detail      JSONB,                   -- doplnkové info (changed fields, prípadne stále hodnoty)
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_time
  ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_time
  ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log (entity_type, entity_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_read_admin" ON audit_log
  FOR SELECT USING (true);  -- všetci vidia (UI pre admin stránku)
CREATE POLICY "audit_log_write_service" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE audit_log IS 'Audit stopy kritických operácií v systéme. Zapisované z API routes cez /api/audit.';
