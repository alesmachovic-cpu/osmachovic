-- ============================================================
-- 061: Pridaj company_id na všetky business tabuľky
-- ============================================================
-- Vianema UUID z migrácie 060:
--   a0000000-0000-0000-0000-000000000001
--
-- Postup pre každú tabuľku:
--   1. ADD COLUMN company_id UUID (nullable)
--   2. UPDATE — backfill Vianema UUID
--   3. SET NOT NULL
--   4. ADD FK + INDEX
-- ============================================================

DO $$ BEGIN

  -- ── users ──────────────────────────────────────────────
  ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE users SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;

  -- ── klienti ────────────────────────────────────────────
  ALTER TABLE klienti ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE klienti SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE klienti ALTER COLUMN company_id SET NOT NULL;

  -- ── nehnutelnosti ──────────────────────────────────────
  ALTER TABLE nehnutelnosti ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE nehnutelnosti SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE nehnutelnosti ALTER COLUMN company_id SET NOT NULL;

  -- ── naberove_listy ─────────────────────────────────────
  ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE naberove_listy SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE naberove_listy ALTER COLUMN company_id SET NOT NULL;

  -- ── klient_dokumenty ───────────────────────────────────
  ALTER TABLE klient_dokumenty ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE klient_dokumenty SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE klient_dokumenty ALTER COLUMN company_id SET NOT NULL;

  -- ── klient_udalosti ────────────────────────────────────
  ALTER TABLE klient_udalosti ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE klient_udalosti SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE klient_udalosti ALTER COLUMN company_id SET NOT NULL;

  -- ── klienti_history ────────────────────────────────────
  ALTER TABLE klienti_history ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE klienti_history SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE klienti_history ALTER COLUMN company_id SET NOT NULL;

  -- ── obhliadky ──────────────────────────────────────────
  ALTER TABLE obhliadky ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE obhliadky SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE obhliadky ALTER COLUMN company_id SET NOT NULL;

  -- ── obchody ────────────────────────────────────────────
  ALTER TABLE obchody ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE obchody SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE obchody ALTER COLUMN company_id SET NOT NULL;

  -- ── obchod_ulohy ───────────────────────────────────────
  ALTER TABLE obchod_ulohy ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE obchod_ulohy SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE obchod_ulohy ALTER COLUMN company_id SET NOT NULL;

  -- ── faktury ────────────────────────────────────────────
  ALTER TABLE faktury ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE faktury SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE faktury ALTER COLUMN company_id SET NOT NULL;

  -- ── faktura_polozky ────────────────────────────────────
  ALTER TABLE faktura_polozky ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE faktura_polozky SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE faktura_polozky ALTER COLUMN company_id SET NOT NULL;

  -- ── odberatelia ────────────────────────────────────────
  ALTER TABLE odberatelia ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE odberatelia SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE odberatelia ALTER COLUMN company_id SET NOT NULL;

  -- ── pobocky ────────────────────────────────────────────
  ALTER TABLE pobocky ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE pobocky SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE pobocky ALTER COLUMN company_id SET NOT NULL;

  -- ── property_stories ───────────────────────────────────
  ALTER TABLE property_stories ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE property_stories SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE property_stories ALTER COLUMN company_id SET NOT NULL;

  -- ── market_sentiments ──────────────────────────────────
  ALTER TABLE market_sentiments ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE market_sentiments SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE market_sentiments ALTER COLUMN company_id SET NOT NULL;

  -- ── pricing_estimates ──────────────────────────────────
  ALTER TABLE pricing_estimates ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE pricing_estimates SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE pricing_estimates ALTER COLUMN company_id SET NOT NULL;

  -- ── motivation_signals ─────────────────────────────────
  ALTER TABLE motivation_signals ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE motivation_signals SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE motivation_signals ALTER COLUMN company_id SET NOT NULL;

  -- ── monitor_filtre ─────────────────────────────────────
  ALTER TABLE monitor_filtre ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE monitor_filtre SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE monitor_filtre ALTER COLUMN company_id SET NOT NULL;

  -- ── monitor_notifikacie ────────────────────────────────
  ALTER TABLE monitor_notifikacie ADD COLUMN IF NOT EXISTS company_id uuid;
  UPDATE monitor_notifikacie SET company_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE company_id IS NULL;
  ALTER TABLE monitor_notifikacie ALTER COLUMN company_id SET NOT NULL;

  -- ── analyzy_trhu ───────────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analyzy_trhu') THEN
    ALTER TABLE analyzy_trhu ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE analyzy_trhu SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE analyzy_trhu ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── rk_directory ───────────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rk_directory') THEN
    ALTER TABLE rk_directory ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE rk_directory SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE rk_directory ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── produkcia_objednavky ───────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'produkcia_objednavky') THEN
    ALTER TABLE produkcia_objednavky ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE produkcia_objednavky SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE produkcia_objednavky ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── user_invites ───────────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_invites') THEN
    ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE user_invites SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE user_invites ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── in_app_notifications ───────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'in_app_notifications') THEN
    ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE in_app_notifications SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE in_app_notifications ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── makleri ────────────────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'makleri') THEN
    ALTER TABLE makleri ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE makleri SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE makleri ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── makler_dodavatel ───────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'makler_dodavatel') THEN
    ALTER TABLE makler_dodavatel ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE makler_dodavatel SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE makler_dodavatel ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── makler_provizie_pct ────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'makler_provizie_pct') THEN
    ALTER TABLE makler_provizie_pct ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE makler_provizie_pct SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE makler_provizie_pct ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- ── objednavky ─────────────────────────────────────────
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'objednavky') THEN
    ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS company_id uuid;
    UPDATE objednavky SET company_id = 'a0000000-0000-0000-0000-000000000001'
      WHERE company_id IS NULL;
    ALTER TABLE objednavky ALTER COLUMN company_id SET NOT NULL;
  END IF;

END $$;

-- ── FK constraints ─────────────────────────────────────────
ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS fk_users_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE klienti
  ADD CONSTRAINT IF NOT EXISTS fk_klienti_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE nehnutelnosti
  ADD CONSTRAINT IF NOT EXISTS fk_nehnutelnosti_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE naberove_listy
  ADD CONSTRAINT IF NOT EXISTS fk_naberove_listy_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE obhliadky
  ADD CONSTRAINT IF NOT EXISTS fk_obhliadky_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE obchody
  ADD CONSTRAINT IF NOT EXISTS fk_obchody_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE faktury
  ADD CONSTRAINT IF NOT EXISTS fk_faktury_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- ── Indexes pre výkon ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_company_id            ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_klienti_company_id          ON klienti(company_id);
CREATE INDEX IF NOT EXISTS idx_nehnutelnosti_company_id    ON nehnutelnosti(company_id);
CREATE INDEX IF NOT EXISTS idx_naberove_listy_company_id   ON naberove_listy(company_id);
CREATE INDEX IF NOT EXISTS idx_klient_dokumenty_company_id ON klient_dokumenty(company_id);
CREATE INDEX IF NOT EXISTS idx_obhliadky_company_id        ON obhliadky(company_id);
CREATE INDEX IF NOT EXISTS idx_obchody_company_id          ON obchody(company_id);
CREATE INDEX IF NOT EXISTS idx_faktury_company_id          ON faktury(company_id);
CREATE INDEX IF NOT EXISTS idx_odberatelia_company_id      ON odberatelia(company_id);
CREATE INDEX IF NOT EXISTS idx_monitor_filtre_company_id   ON monitor_filtre(company_id);
