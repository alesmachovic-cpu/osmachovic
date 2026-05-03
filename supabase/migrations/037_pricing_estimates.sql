-- 037_pricing_estimates.sql
--
-- Etapa D: log pre Pricing Engine. Pri každom volaní /api/pricing/estimate
-- ukladáme vstup + výstup (3 stratégie + DOM predikcie + confidence) aby:
--   1. Maklér vedel zobraziť históriu odhadov v UI
--   2. Po zavedení historických disappearance dát môžeme spätne porovnať
--      "predpovedané vs skutočne predané" — backtest pre kalibráciu modelu

BEGIN;

CREATE TABLE IF NOT EXISTS pricing_estimates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vstup
  user_id             text REFERENCES users(id) ON DELETE SET NULL,
  klient_id           uuid REFERENCES klienti(id) ON DELETE SET NULL,
  nehnutelnost_id     uuid REFERENCES nehnutelnosti(id) ON DELETE SET NULL,
  input_params        jsonb NOT NULL,
  -- CMA
  comparable_count    integer NOT NULL DEFAULT 0,
  cma_summary         jsonb,
  -- Odhad ceny
  recommended_price   numeric NOT NULL,
  price_low           numeric NOT NULL,
  price_high          numeric NOT NULL,
  confidence_score    numeric NOT NULL,
  -- 3 stratégie
  aggressive_price    numeric NOT NULL,
  market_price        numeric NOT NULL,
  aspirational_price  numeric NOT NULL,
  -- DOM predikcie (dni na trhu)
  predicted_dom_aggressive    integer,
  predicted_dom_market        integer,
  predicted_dom_aspirational  integer,
  -- Strategia + rarity
  recommended_strategy text NOT NULL,
  rarity_score         integer NOT NULL,
  -- Owner target (ak makler pozná čo si predajca želá)
  owner_target_price   numeric,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_estimates_user ON pricing_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_estimates_klient ON pricing_estimates(klient_id);
CREATE INDEX IF NOT EXISTS idx_pricing_estimates_nehn ON pricing_estimates(nehnutelnost_id);
CREATE INDEX IF NOT EXISTS idx_pricing_estimates_created ON pricing_estimates(created_at DESC);

ALTER TABLE pricing_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_pricing_estimates ON pricing_estimates
  FOR SELECT TO anon USING (true);
CREATE POLICY service_role_all_pricing_estimates ON pricing_estimates
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
