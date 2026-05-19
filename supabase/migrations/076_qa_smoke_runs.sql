-- ============================================================================
-- 076_qa_smoke_runs.sql
-- ============================================================================
-- Daily Reality Checker (E027 Zuzana Hladká) — log denného E2E smoke testu.
--
-- Každý beh zapíše riadok so štatusom (ok / warn / failed) + zoznam krokov +
-- diagnostic detaily. Dashboard /admin/audit môže grafovať trend pass-rate.
-- ============================================================================

CREATE TABLE IF NOT EXISTS qa_smoke_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  status       text        NOT NULL CHECK (status IN ('ok', 'warn', 'failed', 'running')),
  duration_ms  integer     NULL,
  steps        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  failed_step  text        NULL,
  error        text        NULL,
  base_url     text        NULL,
  triggered_by text        NULL,
  cleanup_ok   boolean     NULL
);

CREATE INDEX IF NOT EXISTS idx_qa_smoke_runs_started ON qa_smoke_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_smoke_runs_status ON qa_smoke_runs (status, started_at DESC);

COMMENT ON TABLE qa_smoke_runs IS
  'Daily Reality Checker — history denných E2E smoke testov. Drží 90 dní history.';
COMMENT ON COLUMN qa_smoke_runs.steps IS
  'JSON array of {name, status, duration_ms, error?} pre každý krok flow.';
