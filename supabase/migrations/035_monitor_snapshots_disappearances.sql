-- 035_monitor_snapshots_disappearances.sql
--
-- Etapa A z "Reality Intelligence" plánu:
-- Implicitná detekcia predajov + denné snímky cien existujúcich monitor_inzeraty.
--
-- 1) monitor_inzeraty_snapshots: denný snímok ceny každého aktívneho inzerátu.
--    Umožní zistiť ako sa cena konkrétneho inzerátu menila v čase.
-- 2) monitor_inzeraty_disappearances: keď scraped inzerát zmizne z feedu 3+ dni,
--    pravdepodobne sa predal/stiahol. Klasifikácia + odhad realizačnej ceny.
--    Toto je kľúč: dáta o REÁLNYCH predajných cenách bez prístupu na ŠÚ SR.
--
-- Cron /api/cron/monitor-daily beží raz za deň (po /api/cron/scrape) — najprv
-- snapshot všetkých active inzerátov, potom detekcia zmiznutí. Migrácia
-- nedotkne existujúce dáta v monitor_inzeraty.

BEGIN;

-- 1) Snapshots — UPSERT-uje sa raz za deň per inzerát
CREATE TABLE IF NOT EXISTS monitor_inzeraty_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inzerat_id    uuid NOT NULL REFERENCES monitor_inzeraty(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  cena          numeric NOT NULL,
  eur_per_m2    numeric,
  was_active    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monitor_snapshot_uniq UNIQUE (inzerat_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_monitor_snapshots_inzerat ON monitor_inzeraty_snapshots(inzerat_id);
CREATE INDEX IF NOT EXISTS idx_monitor_snapshots_date ON monitor_inzeraty_snapshots(snapshot_date DESC);

-- RLS — read open (interné CRM), write iba service_role
ALTER TABLE monitor_inzeraty_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_monitor_snapshots ON monitor_inzeraty_snapshots
  FOR SELECT TO anon USING (true);
CREATE POLICY service_role_all_monitor_snapshots ON monitor_inzeraty_snapshots
  TO service_role USING (true) WITH CHECK (true);

-- 2) Disappearances — detected predaje/stiahnutia
CREATE TABLE IF NOT EXISTS monitor_inzeraty_disappearances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inzerat_id            uuid NOT NULL REFERENCES monitor_inzeraty(id) ON DELETE CASCADE,
  disappeared_on        date NOT NULL,
  last_known_cena       numeric NOT NULL,
  last_known_eur_per_m2 numeric,
  total_days_on_market  integer NOT NULL,
  -- likely_sold | likely_withdrawn | suspicious_relisting
  classification        text NOT NULL DEFAULT 'likely_sold',
  -- 0.0 - 1.0 dôvera v klasifikáciu
  confidence_score      numeric NOT NULL DEFAULT 0.5,
  -- odhadnutá realizačná cena (likely_sold) alebo NULL (withdrawn)
  estimated_sale_price  numeric,
  -- discount od PRVEJ videnej ceny v %
  estimated_discount_pct numeric,
  -- snapshot kompletných dát pri zmiznutí (pre historickú analýzu)
  snapshot              jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monitor_disap_uniq UNIQUE (inzerat_id)
);
CREATE INDEX IF NOT EXISTS idx_monitor_disap_date ON monitor_inzeraty_disappearances(disappeared_on DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_disap_class ON monitor_inzeraty_disappearances(classification);
CREATE INDEX IF NOT EXISTS idx_monitor_disap_inzerat ON monitor_inzeraty_disappearances(inzerat_id);

ALTER TABLE monitor_inzeraty_disappearances ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_monitor_disap ON monitor_inzeraty_disappearances
  FOR SELECT TO anon USING (true);
CREATE POLICY service_role_all_monitor_disap ON monitor_inzeraty_disappearances
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
