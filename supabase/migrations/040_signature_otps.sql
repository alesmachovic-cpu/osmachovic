-- 040_signature_otps.sql
-- SMS-podpis pre náberové listy a objednávky kupujúcich.
-- Variant A: maklér klikne "Podpis cez SMS" → klient dostane SMS s linkom
-- na verejnú stránku /podpis/{token} kde zadá 6-ciferný kód a podpíše.

BEGIN;

CREATE TABLE IF NOT EXISTS signature_otps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Token pre verejný link (URL-safe, 32 chars). Hashujeme nikdy nedáme plain.
  token_hash    text NOT NULL UNIQUE,
  -- 'naber' alebo 'objednavka'
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  -- Telefón klienta (na ktorý ide SMS)
  telefon       text NOT NULL,
  -- 6-ciferný OTP kód (hashed)
  otp_hash      text NOT NULL,
  -- Audit
  requested_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  -- TTL — default 15 min
  expires_at    timestamptz NOT NULL,
  -- Use-once + max attempts
  used_at       timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  -- Audit po podpise
  signed_at     timestamptz,
  signed_ip     text,
  signed_user_agent text,
  -- SMS provider info
  sms_status    text,  -- 'sent' | 'failed' | 'manual' (provider neviem, ručne)
  sms_provider  text,
  sms_error     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sig_otp_entity ON signature_otps(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sig_otp_expires ON signature_otps(expires_at);

ALTER TABLE signature_otps ENABLE ROW LEVEL SECURITY;
-- Žiadny anon prístup — token je secret, len cez API endpoint (service_role)
CREATE POLICY service_role_all_sig_otps ON signature_otps
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
