-- ============================================================
-- 028: In-App notifikácie — perzistentný notification centre
-- ============================================================
-- Účel: každá dôležitá udalosť (SLA warning, napomenutie, kolízia,
--   prebraj voľného klienta, manažérska akcia) sa zapíše do tejto
--   tabuľky a používateľ ich vidí v Bell v navbare + na /notifikacie
--   page. Doplnok k web push (lib/monitor/push) a emailom (lib/notify),
--   ktoré bývajú mimo aplikácie.
-- ============================================================

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id TEXT NOT NULL,                       -- users.id (TEXT, nie UUID — sledujeme schému users tabuľky)
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info','success','warning','danger','sla','manager','match','kolizia')),
  title TEXT NOT NULL,
  body TEXT,                                              -- voľný text, môže byť prázdne
  url TEXT,                                               -- voliteľná cieľová URL pri kliku (napr. /klienti/abc)
  meta JSONB,                                             -- voľné dodatočné údaje (klient_id, makler_id, ...)
  read_at TIMESTAMPTZ,                                    -- NULL = unread; timestamp = kedy bolo prečítané
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS in_app_notif_recipient_idx ON in_app_notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS in_app_notif_unread_idx ON in_app_notifications(recipient_user_id) WHERE read_at IS NULL;

-- RLS
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_in_app_notif ON in_app_notifications;
CREATE POLICY service_role_all_in_app_notif ON in_app_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_read_in_app_notif ON in_app_notifications;
CREATE POLICY anon_read_in_app_notif ON in_app_notifications
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_update_in_app_notif ON in_app_notifications;
CREATE POLICY anon_update_in_app_notif ON in_app_notifications
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
