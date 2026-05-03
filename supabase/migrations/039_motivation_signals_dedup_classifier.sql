-- 039_motivation_signals_dedup_classifier.sql
--
-- Etapa F: vylepšenie monitora podľa CLAUDE.md spec (Vrstvy 1, 2, 3).
--
-- 1) motivation_signals tabuľka — 9 typov signálov ktoré indikujú že
--    predajca je motivovaný (cena klesla, dlho na trhu, relisted, atď).
-- 2) Extra stĺpce na monitor_inzeraty:
--    - motivation_score (0-100, agregát všetkých aktívnych signálov)
--    - canonical_id (FK na primárny inzerát ak je tento dup z iného portálu)
--    - listed_on_n_portals (counter)
--    - predajca_typ_confidence + predajca_typ_method
--      (pre Bayesovskú classification heuristiku)
--    - first_known_cena (na detekciu RELISTED — ak inzerát "vstal z mŕtvych"
--      s nižšou cenou ako pri prvom videní)

BEGIN;

-- 1) Motivation signals
CREATE TABLE IF NOT EXISTS motivation_signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inzerat_id    uuid NOT NULL REFERENCES monitor_inzeraty(id) ON DELETE CASCADE,
  signal_type   text NOT NULL,
    -- PRICE_DROP_SMALL | PRICE_DROP_MEDIUM | PRICE_DROP_LARGE | MULTIPLE_DROPS
    -- LONG_ON_MARKET | VERY_LONG_ON_MARKET | RELISTED | MULTI_PORTAL_BURST
  severity      text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  detected_at   timestamptz NOT NULL DEFAULT now(),
  evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  CONSTRAINT motivation_signal_uniq UNIQUE (inzerat_id, signal_type)
);
CREATE INDEX IF NOT EXISTS idx_motivation_signals_active ON motivation_signals(inzerat_id, is_active);
CREATE INDEX IF NOT EXISTS idx_motivation_signals_type ON motivation_signals(signal_type, severity);
CREATE INDEX IF NOT EXISTS idx_motivation_signals_detected ON motivation_signals(detected_at DESC);

ALTER TABLE motivation_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_motivation_signals ON motivation_signals
  FOR SELECT TO anon USING (true);
CREATE POLICY service_role_all_motivation_signals ON motivation_signals
  TO service_role USING (true) WITH CHECK (true);

-- 2) Extra stĺpce na monitor_inzeraty
ALTER TABLE monitor_inzeraty
  ADD COLUMN IF NOT EXISTS motivation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canonical_id uuid REFERENCES monitor_inzeraty(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listed_on_n_portals integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS predajca_typ_confidence numeric,
  ADD COLUMN IF NOT EXISTS predajca_typ_method text,
    -- 'rule_phone_volume' | 'rule_email_domain' | 'rule_keywords' | 'manual' | 'ml'
  ADD COLUMN IF NOT EXISTS first_known_cena numeric;

CREATE INDEX IF NOT EXISTS idx_monitor_motivation_score ON monitor_inzeraty(motivation_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monitor_canonical ON monitor_inzeraty(canonical_id) WHERE canonical_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitor_predajca_telefon ON monitor_inzeraty(predajca_telefon) WHERE predajca_telefon IS NOT NULL;

-- 3) Backfill first_known_cena — pre existujúce inzeráty použijeme aktuálnu cenu
-- (po prvom snapshote sa to už vie spočítať z monitor_inzeraty_snapshots)
UPDATE monitor_inzeraty
SET first_known_cena = cena
WHERE first_known_cena IS NULL AND cena IS NOT NULL;

COMMIT;
