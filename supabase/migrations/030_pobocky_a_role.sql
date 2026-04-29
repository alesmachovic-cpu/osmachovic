-- ============================================================
-- 030: Pobočky + rolový model (super_admin / majitel / manazer / makler)
-- ============================================================
-- Účel:
--   Vianema má viacero pobočiek (Bratislava, Púchov, Žilina, Košice).
--   Manažér vidí dáta svojej pobočky, majiteľ vidí všetky pobočky bez
--   privátnych info, super_admin vidí všetko, maklér iba svoje.
--
--   Rola sa odteraz drží v `users.role`:
--     super_admin | majitel | manazer | makler
--   super_admin implicitne má všetky práva nižších rolí.
--
--   Pobočka je FK `users.pobocka_id` → `pobocky.id`.
-- ============================================================

-- 1) Tabuľka pobočiek
CREATE TABLE IF NOT EXISTS pobocky (
  id          text PRIMARY KEY,
  nazov       text NOT NULL,
  mesto       text DEFAULT '',
  adresa      text DEFAULT '',
  poznamka    text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION pobocky_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS pobocky_updated_at ON pobocky;
CREATE TRIGGER pobocky_updated_at
  BEFORE UPDATE ON pobocky
  FOR EACH ROW EXECUTE FUNCTION pobocky_set_updated_at();

-- 2) Seed štyroch pobočiek
INSERT INTO pobocky (id, nazov, mesto) VALUES
  ('bratislava', 'Vianema Bratislava', 'Bratislava'),
  ('puchov',     'Vianema Púchov',     'Púchov'),
  ('zilina',     'Vianema Žilina',     'Žilina'),
  ('kosice',     'Vianema Košice',     'Košice')
ON CONFLICT (id) DO NOTHING;

-- 3) users.pobocka_id (FK, nullable — super_admin nemusí byť viazaný na pobočku)
ALTER TABLE users ADD COLUMN IF NOT EXISTS pobocka_id text
  REFERENCES pobocky(id) ON DELETE SET NULL;

-- 4) Backfill rolí
-- Aleš → super_admin (zatiaľ bez pobočky, vidí všetko)
UPDATE users SET role = 'super_admin' WHERE id = 'ales';

-- Ostatní bez explicitnej role → makler (default platí len pre nových,
-- pre existujúcich istota):
UPDATE users SET role = 'makler' WHERE role IS NULL OR role = '';

-- 5) Backfill pobočiek pre existujúcich
-- Slavomír Kollár → Bratislava (default, Aleš môže prehodiť cez UI)
UPDATE users SET pobocka_id = 'bratislava'
WHERE lower(email) = 'kollar@vianema.eu';

-- 6) Index pre rýchle dohľadávanie cez pobočku
CREATE INDEX IF NOT EXISTS idx_users_pobocka_id ON users(pobocka_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
