-- ============================================================
-- 015: Web Push subscriptions pre browser notifikacie
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
