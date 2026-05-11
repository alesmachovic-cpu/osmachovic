-- Migration 047 — klient_udalosti: manuálne záznamy aktivít ku klientovi
-- Hovor, poznámka, stretnutie, email + automatické status zmeny

CREATE TABLE IF NOT EXISTS klient_udalosti (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id   UUID NOT NULL REFERENCES klienti(id) ON DELETE CASCADE,
  typ         TEXT NOT NULL CHECK (typ IN ('hovor', 'poznamka', 'stretnutie', 'email', 'status_zmena', 'ine')),
  popis       TEXT NOT NULL,
  autor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_klient_udalosti_klient ON klient_udalosti(klient_id, created_at DESC);

ALTER TABLE klient_udalosti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_klient_udalosti" ON klient_udalosti
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_klient_udalosti" ON klient_udalosti
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_klient_udalosti" ON klient_udalosti
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete_klient_udalosti" ON klient_udalosti
  FOR DELETE TO anon USING (true);

NOTIFY pgrst, 'reload schema';
