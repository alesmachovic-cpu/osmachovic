-- 041_classifier_v2.sql
--
-- Vylepšenie klasifikátora súkromník vs RK (predajca_typ).
-- Pridáva:
--   1. monitor_inzeraty.predajca_typ_signals (jsonb) — pole signálov ktoré
--      rozhodli + váhy + raw_score (audit "prečo sa rozhodol takto" pre UI).
--   2. monitor_inzeraty.predajca_typ_override — manuálny override maklérom
--      ('rk' | 'sukromny' | NULL). Ak je nastavené, klasifikátor ho rešpektuje
--      pri budúcich scrape-och.
--   3. Tabuľka rk_directory — adresár známych RK kontaktov (telefón / e-mail /
--      doména / meno + vzor). Slúži ako training signál pre classifier:
--      ďalšie inzeráty s rovnakým telefónom/menom/doménou sa automaticky
--      klasifikujú ako RK s vysokou confidence.
--   4. Backfill: existujúce override-y zo starého predajca_typ_method = 'manual'
--      sa preklopia do predajca_typ_override.

BEGIN;

-- 1) Jsonb pole signálov (klasifikátor v2 vracia ClassifierSignal[])
ALTER TABLE monitor_inzeraty
  ADD COLUMN IF NOT EXISTS predajca_typ_signals jsonb,
  ADD COLUMN IF NOT EXISTS predajca_typ_override text
    CHECK (predajca_typ_override IS NULL OR predajca_typ_override IN ('rk','sukromny'));

CREATE INDEX IF NOT EXISTS idx_monitor_predajca_typ_override
  ON monitor_inzeraty(predajca_typ_override)
  WHERE predajca_typ_override IS NOT NULL;

-- Komentáre pre dokumentáciu
COMMENT ON COLUMN monitor_inzeraty.predajca_typ_signals IS
  'Pole signálov klasifikátora v2: [{id,side,weight,reason,evidence}]. Audit pre UI "prečo bol takto klasifikovaný".';
COMMENT ON COLUMN monitor_inzeraty.predajca_typ_override IS
  'Manuálny override maklérom — má prednosť pred automatickým predajca_typ pri každom prepočte.';

-- 2) RK directory — training signal z manuálnych override-ov
CREATE TABLE IF NOT EXISTS rk_directory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Aspoň jeden z týchto identifikátorov musí byť vyplnený (CHECK)
  telefon       text,
  email_domain  text,    -- napr. "remax.sk", "vianema.eu"
  meno          text,    -- celé meno z bazos / nehnutelnosti
  -- Klasifikácia pre tieto identifikátory
  typ           text NOT NULL CHECK (typ IN ('rk','sukromny')),
  -- Audit
  pridal_user_id text REFERENCES users(id) ON DELETE SET NULL,
  poznamka      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rk_directory_at_least_one_id
    CHECK (telefon IS NOT NULL OR email_domain IS NOT NULL OR meno IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_rk_directory_telefon ON rk_directory(telefon) WHERE telefon IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rk_directory_domain  ON rk_directory(email_domain) WHERE email_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rk_directory_meno    ON rk_directory(meno) WHERE meno IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rk_directory_tel ON rk_directory(telefon, typ) WHERE telefon IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rk_directory_dom ON rk_directory(email_domain, typ) WHERE email_domain IS NOT NULL;

ALTER TABLE rk_directory ENABLE ROW LEVEL SECURITY;
-- Anon read pre classifier (volá ho service_role v scrape, ale môže byť aj client-side preview)
CREATE POLICY anon_read_rk_directory ON rk_directory FOR SELECT TO anon USING (true);
-- Write iba service_role (cez /api/monitor/classify-override endpoint)
CREATE POLICY service_role_all_rk_directory ON rk_directory
  TO service_role USING (true) WITH CHECK (true);

-- 3) Backfill: predajca_typ_method = 'manual' → kopíruj do override
UPDATE monitor_inzeraty
SET predajca_typ_override = predajca_typ
WHERE predajca_typ_method = 'manual'
  AND predajca_typ IN ('sukromny','firma')
  AND predajca_typ_override IS NULL;

-- Pre starsi enum 'firma' v override vyžadujeme 'rk' (nový názov)
UPDATE monitor_inzeraty
SET predajca_typ_override = 'rk'
WHERE predajca_typ_override = 'firma';

COMMIT;
