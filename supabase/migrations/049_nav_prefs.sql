-- 049_nav_prefs: per-user hidden nav items
-- nav_prefs = JSON array of hidden hrefs, e.g. ["/statistiky", "/faktury"]
-- empty array (default) = show everything (backwards compatible)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nav_prefs JSONB DEFAULT '[]'::jsonb;
