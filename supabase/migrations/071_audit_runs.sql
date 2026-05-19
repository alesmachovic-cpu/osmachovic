-- 071_audit_runs.sql
-- Tabuľka pre history audit behov. Umožňuje diff (čo sa NOVÉ pokazilo, čo VYRIEŠENÉ).
-- Owner: Bc. Mária Hlavatá (E023) — Inspector General.

CREATE TABLE IF NOT EXISTS audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT NOW(),
  source text NOT NULL DEFAULT 'daily-cron',  -- 'daily-cron' | 'manual' | 'ci'
  counts jsonb NOT NULL,                       -- {ok: N, warn: N, fail: N}
  results jsonb NOT NULL,                      -- [{name, status, message, detail}, ...]
  email_summary jsonb                          -- {sent: bool, error?: string, sections: {...}}
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_run_at ON audit_runs(run_at DESC);

COMMENT ON TABLE audit_runs IS
  'History audit script behov. Cron daily-audit ukladá snapshot, ďalší beh načíta predošlý a vypočíta diff (resolved / new / persistent).';

-- Retention: 90 dní (uvedené v memory/role-inspector-general.md). Cleanup cron P3 ticket.

-- ============================================================================
-- DOWN MIGRATION:
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_audit_runs_run_at;
-- DROP TABLE IF EXISTS audit_runs;
-- ============================================================================
