-- 036_market_sentiments.sql
--
-- Etapa C z Reality Intelligence: denné agregáty trhu per segment
-- (lokalita + typ + izby). Umožní rýchle dashboard queries bez ťažkých
-- aggregačných SQL pri každom otvorení /analyzy.
--
-- Demand index 0-10 = "ako horúci je tento segment trhu":
--   5 = baseline, +faktory: krátky DOM, viac predajov ako nových ponúk,
--                          rastúce ceny; -faktory: dlhý DOM, klesajúce ceny.
--
-- Cron /api/cron/monitor-daily teraz robí 3 fázy:
--   1. snapshot (Etapa A)
--   2. disappearance detect (Etapa A)
--   3. sentiment update (Etapa C — táto migrácia)

BEGIN;

CREATE TABLE IF NOT EXISTS market_sentiments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sentiment_date  date NOT NULL,
  lokalita        text NOT NULL,
  typ             text NOT NULL,           -- byt | dom | pozemok | ...
  izby            integer,                 -- NULL = všetky izby
  -- Counts
  active_count        integer NOT NULL DEFAULT 0,
  new_count           integer NOT NULL DEFAULT 0,  -- pribudlo dnes
  disappeared_count   integer NOT NULL DEFAULT 0,  -- zmizlo dnes
  -- Pricing aggregates (v tomto segmente, dnes)
  median_cena         numeric,
  median_eur_per_m2   numeric,
  min_cena            numeric,
  max_cena            numeric,
  -- Velocity
  median_dom          numeric,
  avg_dom             numeric,
  -- Trends (vs historické sentiments)
  price_change_30d_pct  numeric,
  supply_change_30d_pct numeric,
  -- Demand index 0-10
  demand_index        numeric NOT NULL DEFAULT 5,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_sentiment_uniq UNIQUE (sentiment_date, lokalita, typ, izby)
);

CREATE INDEX IF NOT EXISTS idx_market_sentiments_date ON market_sentiments(sentiment_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_sentiments_lokalita ON market_sentiments(lokalita);
CREATE INDEX IF NOT EXISTS idx_market_sentiments_demand ON market_sentiments(demand_index DESC);

ALTER TABLE market_sentiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_market_sentiments ON market_sentiments
  FOR SELECT TO anon USING (true);
CREATE POLICY service_role_all_market_sentiments ON market_sentiments
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
