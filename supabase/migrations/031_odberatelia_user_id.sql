-- ============================================================
-- 031: Odberatelia per-makler
-- ============================================================
-- Doteraz boli odberatelia faktúr zdieľaní medzi všetkými maklérmi —
-- v dropdown-e novej faktúry vyskakovali aj cudzí. Teraz každý maklér
-- vidí iba svojich.
-- ============================================================

ALTER TABLE odberatelia ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_odberatelia_user_id ON odberatelia(user_id);

-- Backfill: existujúce odberatelia bez user_id priraď tomu maklérovi
-- ktorý vystavil faktúru s týmto odberateľom. Ak žiadna faktúra nemá
-- tento odberatel, priraď super_adminovi (aleš).
UPDATE odberatelia o SET user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (f.odberatel_id) f.odberatel_id, f.user_id
  FROM faktury f
  WHERE f.odberatel_id IS NOT NULL AND f.user_id IS NOT NULL
  ORDER BY f.odberatel_id, f.created_at ASC
) sub
WHERE o.id = sub.odberatel_id AND o.user_id IS NULL;

-- Zvyšné (nepoužité) odberatelia priraď Alešovi
UPDATE odberatelia SET user_id = 'ales' WHERE user_id IS NULL;
