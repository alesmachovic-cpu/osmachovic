-- ============================================================================
-- MIGRATION 014: monitor_filtre — len súkromní predajcovia
-- ============================================================================
-- Flag ktorý pri scrape preskočí realitné kancelárie a uloží len súkromných.
-- Default true (makléri typicky chcú len súkromných).

ALTER TABLE monitor_filtre
  ADD COLUMN IF NOT EXISTS len_sukromni BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN monitor_filtre.len_sukromni IS 'Ak true, scraper uloží iba inzeráty kde predajca_typ=sukromny (preskočí realitné kancelárie).';
