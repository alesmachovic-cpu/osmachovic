-- ============================================================
-- 008: Realitný Monitor – tabuľky + RLS
-- ============================================================

-- 1. Monitorované inzeráty (scraped listings)
CREATE TABLE IF NOT EXISTS monitor_inzeraty (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal        TEXT NOT NULL,              -- 'nehnutelnosti.sk', 'reality.sk', 'topreality.sk'
  external_id   TEXT NOT NULL,              -- ID inzerátu na portáli
  url           TEXT NOT NULL,
  nazov         TEXT,
  typ           TEXT,                       -- 'byt', 'dom', 'pozemok', 'iny'
  lokalita      TEXT,
  cena          NUMERIC,
  mena          TEXT DEFAULT 'EUR',
  plocha        NUMERIC,
  izby          INTEGER,
  popis         TEXT,
  foto_url      TEXT,                       -- URL prvej fotky
  predajca_meno TEXT,
  predajca_telefon TEXT,
  predajca_typ  TEXT,                       -- 'sukromny', 'realitka', 'developer'
  raw_data      JSONB DEFAULT '{}',         -- plný scrape pre budúce parsovanie
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portal, external_id)
);

-- Indexy pre rýchle vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_portal ON monitor_inzeraty(portal);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_typ ON monitor_inzeraty(typ);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_lokalita ON monitor_inzeraty(lokalita);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_cena ON monitor_inzeraty(cena);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_first_seen ON monitor_inzeraty(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_active ON monitor_inzeraty(is_active) WHERE is_active = TRUE;

-- 2. Monitorovacie filtre (watche)
CREATE TABLE IF NOT EXISTS monitor_filtre (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nazov         TEXT NOT NULL,              -- "Byty Petržalka do 150k"
  portal        TEXT NOT NULL,              -- portál alebo 'vsetky'
  typ           TEXT,                       -- 'byt', 'dom', 'pozemok' alebo NULL=všetky
  lokalita      TEXT,                       -- fulltextový match na lokalitu
  cena_od       NUMERIC,
  cena_do       NUMERIC,
  plocha_od     NUMERIC,
  plocha_do     NUMERIC,
  izby_od       INTEGER,
  izby_do       INTEGER,
  klucove_slova TEXT,                       -- čiarkami oddelené keywords
  search_url    TEXT,                       -- priamy URL na stránku výsledkov portálu
  notify_email  BOOLEAN DEFAULT TRUE,
  notify_telegram BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  makler_id     UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Log notifikácií
CREATE TABLE IF NOT EXISTS monitor_notifikacie (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inzerat_id    UUID REFERENCES monitor_inzeraty(id) ON DELETE CASCADE,
  filter_id     UUID REFERENCES monitor_filtre(id) ON DELETE SET NULL,
  typ           TEXT NOT NULL,              -- 'email', 'telegram'
  prijemca      TEXT,                       -- email alebo telegram chat_id
  status        TEXT DEFAULT 'sent',        -- 'sent', 'failed', 'pending'
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_notif_inzerat ON monitor_notifikacie(inzerat_id);
CREATE INDEX IF NOT EXISTS idx_monitor_notif_created ON monitor_notifikacie(created_at DESC);

-- 4. Scrape run log (pre monitoring health)
CREATE TABLE IF NOT EXISTS monitor_scrape_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal        TEXT NOT NULL,
  status        TEXT NOT NULL,              -- 'success', 'error', 'timeout'
  total_found   INTEGER DEFAULT 0,
  new_count     INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  duration_ms   INTEGER,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_log_created ON monitor_scrape_log(created_at DESC);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

-- Inzeráty: čítať môže každý autentifikovaný, zapisovať len service_role
ALTER TABLE monitor_inzeraty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitor_inzeraty_select" ON monitor_inzeraty
  FOR SELECT USING (true);

CREATE POLICY "monitor_inzeraty_insert" ON monitor_inzeraty
  FOR INSERT WITH CHECK (
    current_setting('role') = 'service_role'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

CREATE POLICY "monitor_inzeraty_update" ON monitor_inzeraty
  FOR UPDATE USING (
    current_setting('role') = 'service_role'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Filtre: CRUD len pre vlastného maklera (alebo service_role)
ALTER TABLE monitor_filtre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitor_filtre_select" ON monitor_filtre
  FOR SELECT USING (true);

CREATE POLICY "monitor_filtre_insert" ON monitor_filtre
  FOR INSERT WITH CHECK (true);

CREATE POLICY "monitor_filtre_update" ON monitor_filtre
  FOR UPDATE USING (true);

CREATE POLICY "monitor_filtre_delete" ON monitor_filtre
  FOR DELETE USING (true);

-- Notifikácie: len čítanie pre autentifikovaných
ALTER TABLE monitor_notifikacie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitor_notif_select" ON monitor_notifikacie
  FOR SELECT USING (true);

CREATE POLICY "monitor_notif_insert" ON monitor_notifikacie
  FOR INSERT WITH CHECK (
    current_setting('role') = 'service_role'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Scrape log: len service_role zapisuje
ALTER TABLE monitor_scrape_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrape_log_select" ON monitor_scrape_log
  FOR SELECT USING (true);

CREATE POLICY "scrape_log_insert" ON monitor_scrape_log
  FOR INSERT WITH CHECK (
    current_setting('role') = 'service_role'
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );
