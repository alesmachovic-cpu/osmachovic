-- Vianema · weby maklérov — schéma databázy (Supabase / PostgreSQL)
--
-- Spusti raz v SQL editore Supabase projektu. Tabuľky majú prefix `weby_`,
-- takže projekt môže zdieľať Supabase s inou aplikáciou. Aplikácia pristupuje
-- výhradne cez service_role kľúč na serveri (RLS: anon nemá žiadny prístup).
--
--   weby_users     — prihlásenie do správy (admin = všetky weby, makler = svoj)
--   weby_sites     — jeden web = jeden riadok; draft (rozpracované) / published (verejné)
--   weby_settings  — spoločné texty pobočky
--   weby_leads     — dopyty z formulára „Koľko stojí vaša nehnuteľnosť"
--   bucket weby-fotky — nahrané fotky (verejné čítanie)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS weby_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  name           text NOT NULL,
  role           text NOT NULL DEFAULT 'makler' CHECK (role IN ('admin', 'makler')),
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

CREATE TABLE IF NOT EXISTS weby_settings (
  id          text PRIMARY KEY,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weby_sites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  domain        text UNIQUE,
  typ           text NOT NULL DEFAULT 'makler' CHECK (typ IN ('makler', 'manazer')),
  user_id       uuid REFERENCES weby_users(id) ON DELETE SET NULL,
  poradie       integer NOT NULL DEFAULT 0,
  draft         jsonb NOT NULL DEFAULT '{}'::jsonb,
  published     jsonb,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weby_sites_user ON weby_sites(user_id);

CREATE OR REPLACE FUNCTION weby_sites_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS weby_sites_updated_at ON weby_sites;
CREATE TRIGGER weby_sites_updated_at BEFORE UPDATE ON weby_sites FOR EACH ROW EXECUTE FUNCTION weby_sites_set_updated_at();

CREATE TABLE IF NOT EXISTS weby_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES weby_sites(id) ON DELETE SET NULL,
  site_slug   text NOT NULL,
  data        jsonb NOT NULL,
  ip          text,
  vybavene    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weby_leads_site ON weby_leads(site_id);
CREATE INDEX IF NOT EXISTS idx_weby_leads_created ON weby_leads(created_at DESC);

-- RLS: všetko len cez service_role (server). Anon nemá prístup.
ALTER TABLE weby_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE weby_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weby_sites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE weby_leads    ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  FOR t IN SELECT unnest(ARRAY['weby_users','weby_settings','weby_sites','weby_leads']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', t);
    EXECUTE format('CREATE POLICY service_role_all ON %I TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Fotky (verejné čítanie, zápis len service_role)
INSERT INTO storage.buckets (id, name, public) VALUES ('weby-fotky', 'weby-fotky', true) ON CONFLICT (id) DO NOTHING;

-- Prvý správca. HESLO ZMEŇ hneď po prvom prihlásení (Moje heslo).
INSERT INTO weby_users (email, name, role, password_hash)
VALUES ('machovic@vianema.eu', 'Aleš Machovič', 'admin', crypt('ZmenMaHned2026', gen_salt('bf')))
ON CONFLICT (email) DO NOTHING;

COMMIT;
