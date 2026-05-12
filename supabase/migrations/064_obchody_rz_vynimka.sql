-- 064: obchody — výnimka pre RZ bez výhradnej zmluvy
-- rz_vynimka_poziadana: maklér požiadal manažéra o výnimku
-- rz_vynimka_approved:  manažér výnimku schválil

ALTER TABLE obchody
  ADD COLUMN IF NOT EXISTS rz_vynimka_poziadana BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rz_vynimka_approved  BOOLEAN NOT NULL DEFAULT FALSE;
