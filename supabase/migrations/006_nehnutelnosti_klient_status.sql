-- Pridaj klient_id, status, makler_id do nehnutelnosti
-- Bezpečné spustiť viackrát (IF NOT EXISTS)

ALTER TABLE nehnutelnosti
  ADD COLUMN IF NOT EXISTS klient_id  UUID REFERENCES klienti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'aktivny'
                                      CHECK (status IN ('koncept', 'aktivny', 'predany', 'archivovany')),
  ADD COLUMN IF NOT EXISTS makler_id  TEXT;

CREATE INDEX IF NOT EXISTS nehnutelnosti_klient_id_idx ON nehnutelnosti(klient_id);
CREATE INDEX IF NOT EXISTS nehnutelnosti_makler_id_idx ON nehnutelnosti(makler_id);
CREATE INDEX IF NOT EXISTS nehnutelnosti_status_idx    ON nehnutelnosti(status);
