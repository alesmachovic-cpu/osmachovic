-- ============================================================
-- 109: Monitor — segmentácia ponuka_typ (predaj / prenájom)
-- ============================================================
-- Cieľ: ukladať VŠETKY inzeráty (predaj aj prenájom, súkromník aj RK) pre
-- trhovú analýzu, ale jasne rozdelené. Pridávame os ponuka_typ.
--
-- ADD COLUMN — nedeštruktívne, žiadne PII. Existujúce riadky = 'predaj'
-- (doteraz sa scrapoval len predaj).
-- ============================================================

-- 1. Inzeráty: predaj | prenajom
ALTER TABLE monitor_inzeraty
  ADD COLUMN IF NOT EXISTS ponuka_typ text NOT NULL DEFAULT 'predaj'
  CHECK (ponuka_typ IN ('predaj', 'prenajom'));

CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_ponuka_typ ON monitor_inzeraty(ponuka_typ);

-- 2. Filtre: ktorý segment scrapovať — predaj | prenajom | oboje
ALTER TABLE monitor_filtre
  ADD COLUMN IF NOT EXISTS ponuka_typ text NOT NULL DEFAULT 'predaj'
  CHECK (ponuka_typ IN ('predaj', 'prenajom', 'oboje'));
